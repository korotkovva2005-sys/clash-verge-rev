import { Rule } from 'tauri-plugin-mihomo-api'

export const isRuleDisabled = (rule: Rule) => {
  const extra = rule.extra
  return (
    typeof extra === 'object' &&
    extra !== null &&
    !Array.isArray(extra) &&
    extra.disabled === true
  )
}

export const OTHER_RULE_GROUP = 'other'

const RULE_GROUPS: { name: string; keywords: string[] }[] = [
  {
    name: 'ChatGPT',
    keywords: ['openai', 'chatgpt', 'oaiusercontent', 'oaistatic', 'sora'],
  },
  { name: 'Claude', keywords: ['claude', 'anthropic'] },
  {
    name: 'Gemini',
    keywords: ['gemini', 'bard.google', 'generativelanguage', 'aistudio'],
  },
  { name: 'Telegram', keywords: ['telegram', 't.me', 'tdesktop'] },
  {
    name: 'YouTube',
    keywords: ['youtube', 'ytimg', 'googlevideo', 'youtu.be'],
  },
  { name: 'Spotify', keywords: ['spotify', 'scdn.co'] },
  { name: 'TikTok', keywords: ['tiktok', 'byteoversea', 'musical.ly'] },
  { name: 'Google', keywords: ['google', 'gstatic'] },
]

export const getRuleGroup = (rule: Rule) => {
  const payload = (rule.payload ?? '').toLowerCase()
  return (
    RULE_GROUPS.find((group) =>
      group.keywords.some((keyword) => payload.includes(keyword)),
    )?.name ?? OTHER_RULE_GROUP
  )
}
