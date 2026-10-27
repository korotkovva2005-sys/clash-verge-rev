use std::time::Duration;

use reqwest::Client;
use tokio::task::JoinSet;

use clash_verge_logging::{Type, logging};

mod chatgpt;
mod claude;
mod gemini;
mod spotify;
mod tiktok;
mod types;
mod utils;
mod youtube;

pub use types::UnlockItem;

const MAX_CONCURRENT_CHECKS: usize = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum UnlockCheck {
    ChatGptWeb,
    Claude,
    Gemini,
    YouTubePremium,
    Spotify,
    TikTok,
}

impl UnlockCheck {
    const ALL: &[Self] = &[
        Self::ChatGptWeb,
        Self::Claude,
        Self::Gemini,
        Self::YouTubePremium,
        Self::Spotify,
        Self::TikTok,
    ];

    fn from_name(name: &str) -> Option<Self> {
        Self::ALL.iter().copied().find(|check| check.name() == name)
    }

    const fn name(self) -> &'static str {
        match self {
            Self::ChatGptWeb => chatgpt::CHATGPT_WEB_NAME,
            Self::Claude => claude::CLAUDE_NAME,
            Self::Gemini => gemini::GEMINI_NAME,
            Self::YouTubePremium => youtube::YOUTUBE_PREMIUM_NAME,
            Self::Spotify => spotify::SPOTIFY_NAME,
            Self::TikTok => tiktok::TIKTOK_NAME,
        }
    }

    async fn check(self, client: &Client) -> UnlockItem {
        match self {
            Self::ChatGptWeb => chatgpt::check_chatgpt(client).await,
            Self::Claude => claude::check_claude(client).await,
            Self::Gemini => gemini::check_gemini(client).await,
            Self::YouTubePremium => youtube::check_youtube_premium(client).await,
            Self::Spotify => spotify::check_spotify(client).await,
            Self::TikTok => tiktok::check_tiktok(client).await,
        }
    }

    async fn check_with_timeout(self, client: &Client) -> UnlockItem {
        tokio::time::timeout(Duration::from_secs(15), self.check(client))
            .await
            .unwrap_or_else(|_| UnlockItem::checked(self.name(), "Failed", None))
    }
}

pub fn default_unlock_items() -> Vec<UnlockItem> {
    UnlockCheck::ALL
        .iter()
        .map(|check| UnlockItem::pending(check.name()))
        .collect()
}

pub async fn check_media_unlock<F>(client: &Client, on_complete: F) -> Vec<UnlockItem>
where
    F: Fn(&UnlockItem) + Send,
{
    let mut tasks = JoinSet::new();
    let mut checks = UnlockCheck::ALL.iter().copied();
    let spawn = |tasks: &mut JoinSet<UnlockItem>, check: UnlockCheck| {
        let client = client.clone();
        tasks.spawn(async move { check.check_with_timeout(&client).await });
    };

    for check in checks.by_ref().take(MAX_CONCURRENT_CHECKS) {
        spawn(&mut tasks, check);
    }

    let mut results = Vec::new();
    while let Some(res) = tasks.join_next().await {
        match res {
            Ok(item) => {
                on_complete(&item);
                results.push(item);
            }
            Err(e) => logging!(error, Type::Network, "任务执行失败: {e}"),
        }

        if let Some(check) = checks.next() {
            spawn(&mut tasks, check);
        }
    }

    results
}

pub async fn check_media_unlock_item(client: &Client, name: &str) -> Result<UnlockItem, String> {
    let check = UnlockCheck::from_name(name).ok_or_else(|| format!("未知的流媒体检测项目: {name}"))?;

    Ok(check.check_with_timeout(client).await)
}
