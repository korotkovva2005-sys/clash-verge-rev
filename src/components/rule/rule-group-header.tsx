import ExpandLessRounded from '@mui/icons-material/ExpandLessRounded'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import { Box, IconButton, Switch, Typography } from '@mui/material'

interface Props {
  name: string
  count: number
  enabled: boolean
  expanded: boolean
  onToggleExpanded: () => void
  onToggleEnabled: (enabled: boolean) => void
}

export const RuleGroupHeader = (props: Props) => {
  const { name, count, enabled, expanded, onToggleExpanded, onToggleEnabled } =
    props

  return (
    <Box
      onClick={onToggleExpanded}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        padding: '8px 8px 8px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--divider-color)',
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {count}
      </Typography>
      <Switch
        size="small"
        checked={enabled}
        onClick={(e) => e.stopPropagation()}
        onChange={(_, checked) => onToggleEnabled(checked)}
      />
      <IconButton size="small" aria-expanded={expanded} aria-label={name}>
        {expanded ? <ExpandLessRounded /> : <ExpandMoreRounded />}
      </IconButton>
    </Box>
  )
}
