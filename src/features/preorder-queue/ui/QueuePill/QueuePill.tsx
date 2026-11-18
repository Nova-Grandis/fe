import { useEffect } from 'react'

import { QUEUE_PILL_SPACE_VAR } from '@shared/config/theme'
import { formatNumber } from '@shared/lib/formatNumber'

import * as styles from './QueuePill.css'

import type {
  PreorderQueueState,
  QueueStatus,
} from '../../lib/usePreorderQueue'

export type QueuePillProps = {
  productName: string
  queue: Pick<
    PreorderQueueState,
    'status' | 'myOrder' | 'waitTime' | 'moveIn' | 'checking' | 'reopen'
  >
}

// 내 번호가 이만큼 이하가 되면 '곧 내 차례'로 미리 알린다 — 곧 화면이 넘어갈 수 있다는 예고.
const SOON_ORDER = 10

const MESSAGE: Record<QueueStatus, (myOrder: number | null) => string> = {
  // 진입 응답 전에는 번호를 모른다.
  waiting: (myOrder) =>
    myOrder === null
      ? '내 번호 확인 중'
      : myOrder <= SOON_ORDER
        ? `곧 내 차례예요 · 내 번호 ${formatNumber(myOrder)}번`
        : `내 번호 ${formatNumber(myOrder)}번`,
  mine: () => '내 차례예요 · 곧 예약 페이지로 이동해요',
}

// 대기열 모달을 닫아 둔 동안 위에 떠서 순번을 보여 준다. 누르면 모달이 다시 열린다.
// 닫아 둬도 순번 조회는 계속되므로 자리를 잃지 않는다.
export function QueuePill({ productName, queue }: QueuePillProps) {
  const { status, myOrder, waitTime, moveIn, checking, reopen } = queue

  // 떠 있는 동안 레이아웃이 모바일 콘텐츠를 알약 자리만큼 내리게 한다(MainLayout content).
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty(QUEUE_PILL_SPACE_VAR, styles.QUEUE_PILL_SPACE)
    return () => {
      root.removeProperty(QUEUE_PILL_SPACE_VAR)
    }
  }, [])

  // 대기열을 띄우기 전 서버 답을 기다리는 중 — 누를 것이 없어 버튼이 아니라 상태 표시다.
  if (checking)
    return (
      <div className={[styles.root, styles.border.waiting].join(' ')}>
        <span className={styles.dot.waiting} aria-hidden="true" />
        <span className={styles.desktopOnly}>
          <span className={styles.product}>{productName} 사전예약</span>
          <span className={styles.divider} aria-hidden="true" />
        </span>
        <span className={styles.text} role="status">
          입장 확인 중…
        </span>
      </div>
    )

  return (
    <button
      type="button"
      className={[styles.root, styles.border[status]].join(' ')}
      onClick={reopen}
    >
      <span className={styles.dot[status]} aria-hidden="true" />
      <span className={styles.desktopOnly}>
        <span className={styles.product}>{productName} 사전예약</span>
        <span className={styles.divider} aria-hidden="true" />
      </span>
      {/* 순번·이동 예고가 바뀌면 화면을 보지 않는 사용자에게도 읽어 준다. */}
      <span className={styles.text} aria-live="polite">
        {MESSAGE[status](myOrder)}
      </span>
      {status === 'waiting' && (
        <span className={styles.desktopOnly}>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.text}>
            예상 대기 <span className={styles.strong}>{waitTime}</span>
          </span>
        </span>
      )}
      {/* 내 차례면 이동까지 남은 초를 센다. */}
      {status === 'mine' && (
        <span className={styles.timer}>{moveIn}초 뒤 이동</span>
      )}
    </button>
  )
}
