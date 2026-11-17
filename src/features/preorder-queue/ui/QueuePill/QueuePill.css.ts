import { style, styleVariants } from '@vanilla-extract/css'

import {
  breakpoint,
  color,
  motion,
  onDark,
  spacing,
  statusOnDark,
  typography,
} from '@shared/config/theme'

const tint = (base: string, percent: number) =>
  `color-mix(in srgb, ${base} ${percent}%, transparent)`

const QUEUE_PILL_HEIGHT = '48px'
const QUEUE_PILL_GAP = '8px'
// 모바일에서 콘텐츠를 내릴 높이 — 알약 높이 + 위아래 간격.
export const QUEUE_PILL_SPACE = `calc(${QUEUE_PILL_HEIGHT} + ${QUEUE_PILL_GAP} * 2)`

// 대기열 모달을 닫으면 화면 위에 떠 있는 알림 — 테마와 상관없이 어두운 유리 바탕이다.
export const root = style({
  position: 'fixed',
  top: '84px',
  left: '50%',
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  maxWidth: `calc(100vw - ${spacing[32]})`,
  height: QUEUE_PILL_HEIGHT,
  // 글자로 끝나면 좌우를 같게 둔다 — 타이머 칩으로 끝날 때만 오른쪽을 줄인다(border.mine).
  padding: '0 18px',
  boxSizing: 'border-box',
  border: '1px solid',
  borderRadius: '999px',
  background: tint(color.backgroundDark.base, 78),
  backdropFilter: 'blur(18px) saturate(140%)',
  boxShadow: `0 12px 32px rgba(0, 0, 0, 0.55), 0 0 40px ${tint(color.primary.base, 30)}`,
  color: onDark(92),
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  transform: 'translateX(-50%)',
  transition: [
    `border-color ${motion.duration.fast} ${motion.easing.default}`,
    `opacity ${motion.duration.normal} ${motion.easing.out}`,
    `transform ${motion.duration.normal} ${motion.easing.out}`,
  ].join(', '),
  selectors: {
    '&:hover': { borderColor: color.primary.subtle },
  },
  '@media': {
    // 모바일 헤더(52px) 바로 아래에 붙인다. 이 자리만큼 콘텐츠가 내려간다(QUEUE_PILL_SPACE).
    [breakpoint.mobile]: {
      top: `calc(52px + ${QUEUE_PILL_GAP})`,
      gap: spacing[10],
      padding: `0 ${spacing[14]}`,
    },
  },
  // 모달이 닫히면서 위에서 살짝 내려와 나타난다.
  '@starting-style': {
    opacity: 0,
    transform: 'translate(-50%, -8px)',
  },
})

const dotColor = {
  waiting: color.primary.subtle,
  mine: statusOnDark.success,
}

export const border = styleVariants({
  waiting: { borderColor: tint(color.primary.subtle, 35) },
  // 타이머 칩도 둥근 pill이라 오른쪽을 좁혀 칩이 테두리 곡선에 붙게 한다.
  // root의 모바일 padding이 뒤에 나와 덮으므로 모바일에서도 다시 적는다.
  mine: {
    borderColor: tint(statusOnDark.success, 50),
    paddingRight: spacing[8],
    '@media': { [breakpoint.mobile]: { paddingRight: spacing[8] } },
  },
})

export const dot = styleVariants(dotColor, (dot) => ({
  flex: 'none',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: dot,
  boxShadow: `0 0 10px ${dot}`,
}))

const ellipsis = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const

export const product = style([typography.body.subSemibold, ellipsis])

export const divider = style({
  flex: 'none',
  width: '1px',
  height: '16px',
  background: onDark(14),
})

// 그래도 좁으면(320px대) 문구가 말줄임된다 — 남은 시간(timer)은 줄어들지 않는다.
export const text = style([
  typography.body.sub,
  ellipsis,
  { color: onDark(78) },
])

export const strong = style({ color: onDark(92), fontWeight: 600 })

// 모바일(폴드 커버 화면 344px 등)은 폭이 좁아 상품명·예상 대기 시간을 뺀다 —
// 상품명은 이 페이지 제목에 이미 있고, 예상 대기는 모달을 다시 열면 보인다.
export const desktopOnly = style({
  display: 'contents',
  '@media': { [breakpoint.mobile]: { display: 'none' } },
})

// 내 차례일 때 이동까지 남은 초.
export const timer = style([
  typography.body.subMedium,
  {
    display: 'flex',
    alignItems: 'center',
    flex: 'none',
    height: '32px',
    padding: `0 ${spacing[12]}`,
    borderRadius: '999px',
    fontVariantNumeric: 'tabular-nums',
    background: tint(color.primary.subtle, 14),
    color: onDark(92),
  },
])
