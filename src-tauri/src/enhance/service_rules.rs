use serde_yaml_ng::{Mapping, Value};

const BUILTIN_POLICIES: &[&str] = &["DIRECT", "REJECT", "REJECT-DROP", "PASS", "PASS-RULE", "COMPATIBLE"];
const LOGIC_RULES: &[&str] = &["AND", "OR", "NOT", "SUB-RULE", "MATCH"];

const TELEGRAM_PROCESS_REGEX: &str = "^Telegram";

const SERVICE_DOMAINS: &[&str] = &[
    // Gemini
    "gemini.google.com",
    "bard.google.com",
    "aistudio.google.com",
    "makersuite.google.com",
    "generativelanguage.googleapis.com",
    "alkalimakersuite-pa.clients6.google.com",
    "proactivebackend-pa.googleapis.com",
    "notebooklm.google",
    "notebooklm.google.com",
    // YouTube
    "youtube.com",
    "youtu.be",
    "yt.be",
    "ytimg.com",
    "googlevideo.com",
    "youtube-nocookie.com",
    "youtubei.googleapis.com",
    "ggpht.com",
    // Spotify
    "spotify.com",
    "spotifycdn.com",
    "scdn.co",
    "pscdn.co",
    "spoti.fi",
    "spotify.design",
    // TikTok
    "tiktok.com",
    "tiktokv.com",
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "byteoversea.com",
    "ibytedtos.com",
    "ibyteimg.com",
    "muscdn.com",
    "musical.ly",
    "ttwstatic.com",
    // Google
    "google.com",
    "googleapis.com",
    "gstatic.com",
    "googleusercontent.com",
    "gvt1.com",
    "gvt2.com",
    "withgoogle.com",
];

/// Routes the built-in service domains through the policy the profile already uses for proxied traffic.
pub fn use_service_rules(mut config: Mapping) -> Mapping {
    let Some(rules) = config.get("rules").and_then(Value::as_sequence) else {
        return config;
    };
    let rules: Vec<&str> = rules.iter().filter_map(Value::as_str).collect();
    let Some(target) = proxied_target(&rules).or_else(|| first_group(&config)) else {
        return config;
    };

    // The regex also covers macOS builds named "Telegram Desktop" or "Telegram Lite".
    let rules: Vec<&str> = rules
        .into_iter()
        .filter(|rule| !rule.starts_with("PROCESS-NAME,Telegram,"))
        .collect();
    let existing: Vec<&str> = rules.iter().filter_map(|rule| rule.split(',').nth(1)).collect();
    let mut merged: Vec<Value> = Vec::new();
    if !existing.contains(&TELEGRAM_PROCESS_REGEX) {
        merged.push(Value::from(format!(
            "PROCESS-NAME-REGEX,{TELEGRAM_PROCESS_REGEX},{target}"
        )));
    }
    merged.extend(
        SERVICE_DOMAINS
            .iter()
            .filter(|domain| !existing.contains(domain))
            .map(|domain| Value::from(format!("DOMAIN-SUFFIX,{domain},{target}"))),
    );
    merged.extend(rules.iter().map(|rule| Value::from(*rule)));
    config.insert("rules".into(), Value::Sequence(merged));
    config
}

fn proxied_target(rules: &[&str]) -> Option<std::string::String> {
    rules.iter().find_map(|rule| {
        let parts: Vec<&str> = rule.split(',').map(str::trim).collect();
        let kind = parts.first()?;
        let target = parts.get(2)?;
        (!LOGIC_RULES.contains(kind) && !BUILTIN_POLICIES.contains(target)).then(|| (*target).to_owned())
    })
}

fn first_group(config: &Mapping) -> Option<std::string::String> {
    config
        .get("proxy-groups")?
        .as_sequence()?
        .iter()
        .find_map(|group| group.get("name")?.as_str().map(str::to_owned))
}
