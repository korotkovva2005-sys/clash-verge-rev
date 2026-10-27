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
