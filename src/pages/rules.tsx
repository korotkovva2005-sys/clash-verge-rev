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
import RuleItem from '@/components/rule/rule-item'
import { isRuleDisabled } from '@/components/rule/rule-state'
import { useVisibility } from '@/hooks/use-visibility'
import { useAppRefreshers, useRulesData } from '@/providers/app-data-context'
import { setRulesDisabled } from '@/services/cmds'
import { mutate } from '@/services/mutate'

const RulesPage = () => {
  const { t } = useTranslation()
  const { rules = [] } = useRulesData()
  const { refreshRules, refreshRuleProviders } = useAppRefreshers()
  const [match, setMatch] = useState(() => (_: string) => true)
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

  const setAllDisabled = (disabled: boolean) =>
    updateRules(
      Object.fromEntries(
        rules
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
          <Button size="small" onClick={() => setAllDisabled(false)}>
            {t('rules.page.actions.enableAll')}
          </Button>
          <Button size="small" onClick={() => setAllDisabled(true)}>
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
        <BaseSearchBox onSearch={(match) => setMatch(() => match)} />
      </Box>

      {filteredRules && filteredRules.length > 0 ? (
        <>
          <VirtualList
            ref={virtuosoRef}
            count={filteredRules.length}
            estimateSize={40}
            renderItem={(i) => (
              <RuleItem value={filteredRules[i]} onToggle={handleToggle} />
            )}
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
