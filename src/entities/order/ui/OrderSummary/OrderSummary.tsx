import type { ReactNode } from 'react'

import { typography } from '@shared/config/theme'
import { ActionButton, Button, PriceText } from '@shared/ui'

import * as styles from './OrderSummary.css'

export type OrderSummaryRow = {
  label: string
  value: string
  /** 할인처럼 강조가 필요한 금액 */
  highlight?: boolean
}

export type OrderSummaryProps = {
  title?: string
  rows: OrderSummaryRow[]
  totalLabel?: string
  totalValue: string
  actionLabel: string
  /** 실사용자 모니터링(Faro)에 남길 버튼 동작 이름 — data-faro-user-action-name */
  actionName?: string
  onAction?: () => void
  actionDisabled?: boolean
  /** 어두운 화면(결제 페이지)의 그라데이션 버튼(ActionButton)으로 바꾼다. 장바구니는 아직 밝은 화면이라 기본 Button. */
  darkAction?: boolean
  /** 결제 페이지의 약관 동의가 들어가는 자리. 장바구니에서는 넘기지 않는다. */
  children?: ReactNode
  className?: string
}

export function OrderSummary({
  title = '결제 정보',
  rows,
  totalLabel = '총 결제 금액',
  totalValue,
  actionLabel,
  actionName,
  onAction,
  actionDisabled,
  darkAction,
  children,
  className,
}: OrderSummaryProps) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div className={[typography.title.mdSemibold, styles.title].join(' ')}>
        {title}
      </div>

      <div className={styles.rows}>
        {rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <div className={[typography.body.sub, styles.rowLabel].join(' ')}>
              {row.label}
            </div>
            <div
              className={[
                typography.body.subMedium,
                row.highlight ? styles.rowValueHighlight : styles.rowValue,
              ].join(' ')}
            >
              {row.value}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.totalRow}>
        <div className={[typography.body.subMedium, styles.rowLabel].join(' ')}>
          {totalLabel}
        </div>
        <div className={typography.title.lgSemibold}>
          <PriceText value={totalValue} />
        </div>
      </div>

      {children}

      <div className={styles.actionRow}>
        {darkAction ? (
          <ActionButton
            fullWidth
            data-faro-user-action-name={actionName}
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionLabel}
          </ActionButton>
        ) : (
          <Button
            className={styles.action}
            data-faro-user-action-name={actionName}
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
