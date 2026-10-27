import { Box, Button } from '@mui/material'
import { useLockFn } from 'ahooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { closeAllConnections } from 'tauri-plugin-mihomo-api'

import {
  BaseEmpty,
  BasePage,
  BaseSearchBox,
  VirtualList,
  type VirtualListHandle,
} from '@/components/base'
import { ScrollTopButton } from '@/components/layout/scroll-top-button'
import { ProviderButton } from '@/components/rule/provider-button'
import { RuleGroupHeader } from '@/components/rule/rule-group-header'
import RuleItem from '@/components/rule/rule-item'
import {
  getRuleGroup,
  isRuleDisabled,
  OTHER_RULE_GROUP,
} from '@/components/rule/rule-state'
import { useVisibility } from '@/hooks/use-visibility'
import { useAppRefreshers, useRulesData } from '@/providers/app-data-context'
import { setRulesDisabled } from '@/services/cmds'
import { mutate } from '@/services/mutate'

const RulesPage = () => {
  const { t } = useTranslation()
  const { rules = [] } = useRulesData()
  const { refreshRules, refreshRuleProviders } = useAppRefreshers()
  const [match, setMatch] = useState(() => (_: string) => true)
  const [hasSearch, setHasSearch] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(),
  )
  const virtuosoRef = useRef<VirtualListHandle>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const pageVisible = useVisibility()

  // 在组件挂载时和页面获得焦点时刷新规则数据
  useEffect(() => {
    refreshRules()
    refreshRuleProviders()

    if (pageVisible) {
      refreshRules()
      refreshRuleProviders()
    }
  }, [refreshRules, refreshRuleProviders, pageVisible])

  const filteredRules = useMemo(() => {
    const rulesWithLineNo = rules.map((item, index) => ({
      ...item,
      // UI-only derived data; keep app context/SWR data immutable
      lineNo: index + 1,
    }))

    return rulesWithLineNo.filter((item) => match(item.payload ?? ''))
  }, [rules, match])

  const ruleGroups = useMemo(() => {
    const groups = new Map<string, typeof filteredRules>()
    for (const rule of filteredRules) {
      const name = getRuleGroup(rule)
      groups.set(name, [...(groups.get(name) ?? []), rule])
    }
    const other = groups.get(OTHER_RULE_GROUP)
    groups.delete(OTHER_RULE_GROUP)
    if (other) groups.set(OTHER_RULE_GROUP, other)
    return [...groups].map(([name, items]) => ({ name, items }))
  }, [filteredRules])

  const rows = useMemo(
    () =>
      ruleGroups.flatMap((group) => {
        const header = { kind: 'group' as const, group }
        const expanded = hasSearch || expandedGroups.has(group.name)
        if (!expanded) return [header]
        return [
          header,
          ...group.items.map((rule) => ({ kind: 'rule' as const, rule })),
        ]
      }),
    [ruleGroups, expandedGroups, hasSearch],
  )

  const toggleGroupExpanded = useCallback((name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (!next.delete(name)) next.add(name)
      return next
    })
  }, [])

  const updateRules = useLockFn(async (patch: Record<number, boolean>) => {
    try {
      await mutate(() => setRulesDisabled(patch), { id: 'set-rules-disabled' })
    } finally {
      await refreshRules()
    }
  })

  const handleToggle = useCallback(
    (index: number, disabled: boolean) => updateRules({ [index]: disabled }),
    [updateRules],
  )

  const setDisabled = (targets: typeof rules, disabled: boolean) =>
    updateRules(
      Object.fromEntries(
        targets
          .filter((rule) => isRuleDisabled(rule) !== disabled)
          .map((rule) => [rule.index, disabled]),
      ),
    )

  const onCloseConnections = useLockFn(() =>
    mutate(() => closeAllConnections(), {
      id: 'close-all-connections',
      errorNotice: false,
    }),
  )

  const handleScroll = useCallback((e: Event) => {
    setShowScrollTop((e.target as HTMLElement).scrollTop > 100)
  }, [])

  const scrollToTop = () => {
    virtuosoRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <BasePage
      full
      title={t('rules.page.title')}
      contentStyle={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
      header={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" onClick={() => setDisabled(rules, false)}>
            {t('rules.page.actions.enableAll')}
          </Button>
          <Button size="small" onClick={() => setDisabled(rules, true)}>
            {t('rules.page.actions.disableAll')}
          </Button>
          <ProviderButton />
          <Button size="small" variant="contained" onClick={onCloseConnections}>
            <span style={{ whiteSpace: 'nowrap' }}>
              {t('rules.page.actions.closeConnections')}
            </span>
          </Button>
        </Box>
      }
    >
      <Box
        sx={{
          pt: 1,
          mb: 0.5,
          mx: '10px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <BaseSearchBox
          onSearch={(match, state) => {
            setMatch(() => match)
            setHasSearch(state.text.length > 0)
          }}
        />
      </Box>

      {filteredRules && filteredRules.length > 0 ? (
        <>
          <VirtualList
            ref={virtuosoRef}
            count={rows.length}
            estimateSize={40}
            getItemKey={(i) => {
              const row = rows[i]
              return row.kind === 'group'
                ? `group-${row.group.name}`
                : `rule-${row.rule.index}`
            }}
            renderItem={(i) => {
              const row = rows[i]
              if (row.kind === 'rule') {
                return <RuleItem value={row.rule} onToggle={handleToggle} />
              }
              const { name, items } = row.group
              return (
                <RuleGroupHeader
                  name={
                    name === OTHER_RULE_GROUP
                      ? t('rules.page.groups.other')
                      : name
                  }
                  count={items.length}
                  enabled={items.some((rule) => !isRuleDisabled(rule))}
                  expanded={hasSearch || expandedGroups.has(name)}
                  onToggleExpanded={() => toggleGroupExpanded(name)}
                  onToggleEnabled={(enabled) => setDisabled(items, !enabled)}
                />
              )
            }}
            style={{ flex: 1 }}
            onScroll={handleScroll}
          />
          <ScrollTopButton onClick={scrollToTop} show={showScrollTop} />
        </>
      ) : (
        <BaseEmpty />
      )}
    </BasePage>
  )
}

export default RulesPage
