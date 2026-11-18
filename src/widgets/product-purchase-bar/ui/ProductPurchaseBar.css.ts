import { globalStyle, style } from '@vanilla-extract/css'

import {
  typography,
  color,
  spacing,
  motion,
  breakpoint,
  TAB_BAR_HEIGHT,
  TAB_BAR_OFFSET,
  productDetailBreakpoint,
} from '@shared/config/theme'

// 모바일은 화면 위쪽에 상품명이 이미 있어 바에서는 옵션 줄만 남긴다.
export const productName = style([
  typography.title.mdSemibold,
  { '@media': { [productDetailBreakpoint.mobile]: { display: 'none' } } },
])
export const productOption = style([
  typography.body.sub,
  { color: color.text.tertiary },
])

// 모바일 전용 — 상품명 없이 옵션 줄만 남으니 무엇인지 앞에 붙인다. 데스크톱은 상품명 아래라 필요 없다.
export const optionPrefix = style({
  '@media': { [productDetailBreakpoint.desktop]: { display: 'none' } },
})

// 모바일: 화면 하단에 항상 고정(장바구니/결제하기가 스크롤과 무관하게 늘 보여야 함).
// 바텀시트(sheet)와 같은 flex-column 컨테이너에 넣어서 시트가 항상 바로 위에 딱 붙는다 —
// bottom 오프셋을 픽셀로 직접 계산할 필요가 없어 겹치거나 틈이 생기지 않는다.
// 데스크톱: 이 컨테이너엔 바 하나만 남고(시트는 안 보임), 기존처럼 top 고정.
export const bottomBarGroup = style({
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 3,
  display: 'flex',
  flexDirection: 'column',
  '@media': {
    [productDetailBreakpoint.desktop]: {
      top: 0,
      bottom: 'auto',
      // 안의 orderBar가 translateY로 화면 밖에 숨어 있어도 이 컨테이너의 레이아웃
      // 박스(=orderBar 높이)는 헤더와 같은 자리에 그대로 남아 클릭을 가로챈다 —
      // 평소엔 이벤트를 통과시키고, orderBar가 실제로 보일 때만(bottomBarGroupVisible)
      // 되살린다.
      pointerEvents: 'none',
    },
  },
})

export const bottomBarGroupVisible = style({
  '@media': {
    [productDetailBreakpoint.desktop]: {
      pointerEvents: 'auto',
    },
  },
})

// 평소엔 뷰포트 위로 숨겨뒀다가 이미지/옵션 패널(layout)이 화면에서 사라지면
// isLayoutVisible이 false가 되면서 transform만 바뀌어 위에서 아래로 슬라이드된다 — 데스크톱 전용.
// ProductPageTab(tabBarWrapper)과는 분리 — 탭은 항상 떠 있어야 하고, 이 바만 나타났다 사라진다.
export const orderBar = style({
  // 페이지 바탕(backgroundDark.base)과 같은 색을 섞어야 바 경계에 띠가 안 생긴다.
  background: `color-mix(in srgb, ${color.backgroundDark.base} 42%, transparent)`,
  backdropFilter: 'blur(24px) saturate(180%)',
  '@media': {
    // 모바일 탭바가 바 아래쪽에 떠 있으므로 그만큼 바 배경을 늘려 버튼이 가리지 않게 한다.
    // 탭바는 사이트 모바일(743px 이하)에만 떠서 상품 상세 분기점이 아니라 breakpoint.mobile을 따른다.
    [breakpoint.mobile]: {
      paddingBottom: `calc(${TAB_BAR_HEIGHT} + ${TAB_BAR_OFFSET})`,
    },
    [productDetailBreakpoint.desktop]: {
      borderBottom: `1px solid ${color.border.subtle}`,
      transform: 'translateY(-100%)',
      // 숨어 있어도 결제 버튼 그림자(primaryGlow)가 바 아래로 번져 헤더에 비친다 —
      // 올라가는 슬라이드가 끝난 뒤 visibility로 감춘다.
      visibility: 'hidden',
      transition: [
        `transform ${motion.duration.fast} ${motion.easing.default}`,
        `visibility 0s linear ${motion.duration.fast}`,
      ].join(', '),
    },
  },
})

// 모바일에서는 orderBar가 항상 보이므로 이 클래스가 할 일이 없다 — 데스크톱에서만 슬라이드 인.
export const orderBarVisible = style({
  '@media': {
    [productDetailBreakpoint.desktop]: {
      transform: 'translateY(0)',
      visibility: 'visible',
      transition: `transform ${motion.duration.fast} ${motion.easing.default}`,
    },
  },
})

// 모바일: 수량/가격 줄(orderBarQuantityPrice) 아래에 버튼 줄이 전체 폭으로 놓인다.
// 데스크톱: 기존처럼 1fr(정보) + auto(버튼) 두 칸 그리드.
// 위/아래 선 위치도 바가 붙는 쪽(모바일 위쪽, 데스크톱 아래쪽)에 맞춰 반전.
export const orderBarContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[16],
  borderTop: `1px solid ${color.border.subtle}`,
  '@media': {
    [productDetailBreakpoint.desktop]: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      gap: spacing[16],
      borderTop: 'none',
    },
  },
})

// 모바일 전용 — 순차배송 안내를 옵션 줄 오른쪽에 같이 보여준다(데스크톱은 옵션 패널의 shipmentNotice로 충분).
export const orderBarShipmentNotice = style([
  typography.body.subMedium,
  {
    flexShrink: 0,
    color: color.primary.base,
    textAlign: 'right',
    '@media': {
      [productDetailBreakpoint.desktop]: {
        display: 'none',
      },
    },
  },
])

// 상품명 + 선택한 옵션. 모바일은 상품명을 숨기고(productName) 옵션 줄만 수량/가격 줄 위에 보여준다.
export const orderBarInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[2],
})

// 옵션(왼쪽)과 출고 시작일(오른쪽)을 한 줄에 둔다.
export const orderBarOptionRow = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: spacing[12],
})

// 모바일 전용 — 수량 스테퍼와 가격을 버튼 줄 위에 양 끝으로 보여준다. 데스크톱은 옵션
// 패널(layout)에 같은 줄이 있고 가격은 결제 버튼에 들어가므로 숨긴다.
export const orderBarQuantityPrice = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing[8],
  '@media': {
    [productDetailBreakpoint.desktop]: {
      display: 'none',
    },
  },
})

export const priceGroup = style({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[4],
})

export const breakdownToggle = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  border: 'none',
  borderRadius: '50%',
  background: 'transparent',
  color: color.text.tertiary,
  cursor: 'pointer',
  transition: `background ${motion.duration.fast} ${motion.easing.default}`,
  selectors: {
    '&:hover': { background: color.background.surface },
  },
})

// 모바일 전용 — 수량/가격 줄 위에 가격이 어떻게 나왔는지(기본가 + 옵션 × 수량) 펼친다.
// 바가 화면 아래에 붙어 있어 위로 자란다.
export const breakdown = style({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[8],
  margin: 0,
  padding: `${spacing[12]} ${spacing[14]}`,
  borderRadius: '12px',
  background: color.background.surface,
  '@media': { [productDetailBreakpoint.desktop]: { display: 'none' } },
})

export const breakdownRow = style([
  typography.body.sub,
  {
    display: 'flex',
    justifyContent: 'space-between',
    gap: spacing[12],
    color: color.text.secondary,
  },
])

globalStyle(`${breakdownRow} dd`, { margin: 0, color: color.text.primary })

// 상세 구매 요약(PurchaseSummary)의 혜택 줄과 같은 강조색.
export const discount = style({})
globalStyle(`${breakdownRow} dd${discount}`, { color: color.primary.subtle })

export const breakdownTotal = style([
  breakdownRow,
  typography.body.subSemibold,
  {
    paddingTop: spacing[8],
    borderTop: `1px solid ${color.border.subtle}`,
    color: color.text.primary,
  },
])

// 모바일은 버튼 줄이 전체 폭을 차지, 데스크톱은 내용 크기로.
export const orderBarButtons = style({
  display: 'flex',
  gap: spacing[8],
  width: '100%',
  '@media': {
    [productDetailBreakpoint.desktop]: {
      width: 'auto',
    },
  },
})

// 모바일은 장바구니 버튼을 뺀 나머지 가로를 전부 차지. 데스크톱은 내용 크기.
export const orderBarCheckoutButton = style({
  flex: 1,
  '@media': { [productDetailBreakpoint.desktop]: { flex: 'initial' } },
})

// 결제 버튼 하나로 — 모바일은 "결제하기"만, 데스크톱은 앞에 금액을 붙인다.
export const desktopPrice = style({
  display: 'none',
  '@media': { [productDetailBreakpoint.desktop]: { display: 'inline' } },
})
