import { style } from '@vanilla-extract/css'

import { color, shadow, spacing, typography } from '@shared/config/theme'
import { fontWeight } from '@shared/config/theme/tokens/typography/base'

export const root = style({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[16],
})

export const tabLabel = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing[6],
})

export const tabCount = style({
  color: color.text.tertiary,
  fontVariantNumeric: 'tabular-nums',
})

// 처리 대기가 있으면 숫자를 빨갛게 — 평소 0이어야 하는 탭이다.
export const tabCountHot = style([tabCount, { color: color.status.danger }])

export const titleNote = style([
  typography.body.subMedium,
  { color: color.text.secondary },
])

export const selectionBar = style([
  typography.body.sub,
  {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[8],
    padding: `${spacing[10]} ${spacing[16]}`,
    borderRadius: '10px',
    background: color.primary.subtler,
    color: color.primary.focus,
  },
])

export const selectionActions = style({
  display: 'flex',
  gap: spacing[8],
  marginLeft: 'auto',
})

export const stacked = style({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[2],
})

export const inline = style({
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: spacing[8],
})

export const strong = style({ fontWeight: fontWeight.semibold })

export const code = style([
  typography.body.caption,
  {
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: color.text.tertiary,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
])

export const subText = style([
  typography.body.sub,
  { color: color.text.tertiary },
])

// 표·알림·끝 안내 묶음. 맨 위로 옮길 때 이 칸의 위쪽에 맞춘다. 높이 0인 표식·알림 자리에 간격이
// 붙지 않게 gap 없이 쌓는다.
export const list = style({ scrollMarginTop: spacing[16] })

// 새 실패 알림 자리. 높이를 0으로 둬 알림이 나타나고 사라져도 아래 줄을 밀지 않고, 본문 칸 위쪽에
// 붙어 내려가 읽는 동안에도 보인다.
export const newDock = style({
  position: 'sticky',
  top: spacing[16],
  zIndex: 1,
  height: 0,
  display: 'flex',
  justifyContent: 'center',
})

export const newButton = style({ boxShadow: shadow.md })

// 표 끝 안내 — 다음 쪽을 받는 신호를 겸한다.
export const listEnd = style([subText, { paddingTop: spacing[12] }])

export const link = style({
  color: color.primary.base,
  textDecoration: 'underline',
  fontVariantNumeric: 'tabular-nums',
})

export const subLink = style([
  typography.body.sub,
  { color: color.text.tertiary, textDecoration: 'underline' },
])

// 상태 탭은 왼쪽, 서비스 고르기는 오른쪽 끝 — 좁으면 서비스 고르기가 아래로 내려간다.
export const controls = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: spacing[12],
})
