import { style } from '@vanilla-extract/css'

import {
  color,
  breakpoint,
  FIXED_BOTTOM_BAR_VAR,
  QUEUE_PILL_SPACE_VAR,
  TAB_BAR_HEIGHT,
  TAB_BAR_OFFSET,
} from '@shared/config/theme'
import { headerHeight } from '@widgets/header'

// admin 레이아웃(AdminLayout.css.ts)과 같은 이유로 헤더 높이만큼 뺀다 — 콘텐츠가
// 뷰포트보다 짧아도 배경이 끝까지 채워지게 하는 최소 높이일 뿐, 콘텐츠가 더 길면
// 자연스럽게 늘어난다(admin처럼 내부 스크롤로 가두지 않는다).
export const root = style({
  // 콘텐츠가 짧아도 Footer가 화면 맨 아래에 붙게 content가 남는 높이를 채운다.
  display: 'flex',
  flexDirection: 'column',
  minHeight: `calc(100vh - ${headerHeight})`,
  background: color.background.page,
  // 모바일은 하단 플로팅 탭바가 마지막 콘텐츠(푸터)를 가리지 않게 그 높이+띄운 간격만큼 비워 둔다.
  // 탭바보다 높은 고정 바(상품 상세 결제 바)가 있으면 그 높이만큼 비운다.
  '@media': {
    [breakpoint.mobile]: {
      paddingBottom: `max(calc(${TAB_BAR_HEIGHT} + ${TAB_BAR_OFFSET}), var(${FIXED_BOTTOM_BAR_VAR}, 0px))`,
    },
    // 탭바는 없지만 상품 상세가 모바일 배치(744~799px)라 결제 바만 아래에 붙는 경우.
    [breakpoint.desktop]: {
      paddingBottom: `var(${FIXED_BOTTOM_BAR_VAR}, 0px)`,
    },
  },
})

// 페이지를 flex item으로 바로 두면 margin: auto로 가운데 정렬한 페이지(404 등)가 폭이
// 줄어든다 — 블록 래퍼 안에 두어 페이지 쪽 레이아웃은 그대로 둔다.
export const content = style({
  flex: 1,
  // 모바일은 헤더가 낮아(52px) 대기열 알약이 페이지 제목 위에 얹힌다 — 알약이 떠 있는 동안
  // 알약이 적어 둔 높이만큼 콘텐츠를 내린다(QueuePill). 웹은 헤더 아래 여백이 넉넉해 그대로 둔다.
  '@media': {
    [breakpoint.mobile]: { paddingTop: `var(${QUEUE_PILL_SPACE_VAR}, 0px)` },
  },
})

export const baseBackground = style({
  background: color.background.base,
})

export const darkBackground = style({
  background: color.backgroundDark.base,
})

export const transparentBackground = style({
  background: 'transparent',
})

export const withoutHeader = style({
  minHeight: '100vh',
  '@media': {
    [breakpoint.mobile]: {
      paddingBottom: 0,
    },
  },
})
