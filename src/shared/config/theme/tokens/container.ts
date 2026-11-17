import { spacing } from './spacing'

export const maxWidth = {
  none: 'none',
  content: '1200px',
  full: '100%',
} as const

// 모바일 하단 플로팅 탭바(widgets/mobile-tab-bar) 크기. 탭바가 가리지 않게 그만큼 비워야 하는
// 곳이 shared(BottomSheet)에도 있어서 widgets가 아니라 여기 둔다.
export const TAB_BAR_HEIGHT = '60px'
// 화면 아래 끝에서 띄우는 간격. iOS 홈 인디케이터 영역만큼 더 띄운다.
export const TAB_BAR_OFFSET = `calc(${spacing[12]} + env(safe-area-inset-bottom))`

// 탭바보다 높은 하단 고정 바(상품 상세 결제 바)가 자기 높이를 적어 두는 CSS 변수.
// 레이아웃이 맨 아래(푸터 밑)를 이만큼 비워 바가 푸터를 가리지 않게 한다.
export const FIXED_BOTTOM_BAR_VAR = '--fixed-bottom-bar-height'

// 모바일에서 대기열 알약(QueuePill)이 떠 있는 동안 자기 자리(높이 + 간격)를 적어 두는 CSS 변수.
// 레이아웃이 콘텐츠 맨 위를 이만큼 내려, 알약이 페이지 제목·상단 버튼을 가리지 않게 한다.
export const QUEUE_PILL_SPACE_VAR = '--queue-pill-space'
