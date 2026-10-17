import { useId, useState, type RefObject } from 'react'

import { ChevronDown, ChevronUp } from 'lucide-react'

import {
  PREORDER_BENEFIT_RATE,
  PriceDisplay,
  QuantityControl,
  type ProductPurchase,
} from '@features/product-purchase'
import { formatWon } from '@shared/lib/formatNumber'
import { ActionButton, Container } from '@shared/ui'

import * as styles from './ProductPurchaseBar.css'

export type ProductPurchaseBarProps = {
  isPreorder: boolean
  isLayoutVisible: boolean
  orderBarRef: RefObject<HTMLDivElement | null>
  productName: string
  stepperLabel: string
  // useProductPurchase() 결과를 그대로 받는다 — colorLabel/optionLabel/quantity/priceLabel을
  // 낱개 prop으로 풀어 넘기면 5개가 늘어나서, 이미 한 덩어리인 값을 그대로 전달한다.
  purchase: Pick<
    ProductPurchase,
    | 'colorLabel'
    | 'optionLabel'
    | 'quantity'
    | 'setQuantity'
    | 'priceLabel'
    | 'basePrice'
    | 'selectedValues'
    | 'benefitAmount'
  >
  // 사전예약 출고 안내. 배송 차수를 아직 못 받았으면 비워 둔다.
  shipmentLabel?: string
  onCheckout: () => void
  // 상품 조회가 안 끝났거나 실패한 동안 결제/사전예약을 막는다(ProductDetailPage의
  // isCheckoutReady 참고).
  checkoutDisabled?: boolean
  // 일반 상품의 장바구니 담기(사전예약은 장바구니가 없다).
  onAddToCart: () => void
  addToCartDisabled?: boolean
}

// 하단 고정 주문바(데스크톱은 스크롤 시 나타나는 상단 바)를 그린다. 모바일 바는 수량/가격 줄과
// 버튼 줄로 이루어져 있다.
// 옵션 패널의 "장바구니 담기/결제하기" 행동 단위 로직은 features/product-purchase가 들고 있고,
// 이 위젯은 그 상태를 받아 하단바 UI로 그려주기만 한다.
export function ProductPurchaseBar({
  isPreorder,
  isLayoutVisible,
  orderBarRef,
  productName,
  stepperLabel,
  purchase: {
    colorLabel,
    optionLabel,
    quantity,
    setQuantity,
    priceLabel,
    basePrice,
    selectedValues,
    benefitAmount,
  },
  shipmentLabel,
  onCheckout,
  checkoutDisabled,
  onAddToCart,
  addToCartDisabled,
}: ProductPurchaseBarProps) {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)
  const breakdownId = useId()
  // 추가금액이 붙는 옵션만 — 0원 옵션은 가격에 영향이 없다.
  const extras = selectedValues.filter((value) => (value.extraPrice ?? 0) > 0)

  return (
    <>
      <div
        className={[
          styles.bottomBarGroup,
          !isLayoutVisible && styles.bottomBarGroupVisible,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          ref={orderBarRef}
          className={[
            styles.orderBar,
            !isLayoutVisible && styles.orderBarVisible,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Container
            desktopPaddingX={50}
            desktopPaddingY={16}
            mobilePaddingX={20}
            mobilePaddingY={16}
            className={styles.orderBarContent}
          >
            {isPreorder && shipmentLabel && (
              <div className={styles.orderBarShipmentNotice}>
                {shipmentLabel}
              </div>
            )}
            <div className={styles.orderBarInfo}>
              <div className={styles.productName}>{productName}</div>
              <div className={styles.productOption}>
                <span className={styles.optionPrefix}>옵션 : </span>
                {colorLabel} · {optionLabel}
              </div>
            </div>
            {isBreakdownOpen && (
              <dl id={breakdownId} className={styles.breakdown}>
                <div className={styles.breakdownRow}>
                  <dt>기본가</dt>
                  <dd>{formatWon(basePrice)}</dd>
                </div>
                {extras.map((value) => (
                  <div key={value.label} className={styles.breakdownRow}>
                    <dt>{value.label}</dt>
                    <dd>+{formatWon(value.extraPrice ?? 0)}</dd>
                  </div>
                ))}
                <div className={styles.breakdownRow}>
                  <dt>수량</dt>
                  <dd>{quantity}개</dd>
                </div>
                {isPreorder && (
                  <div className={styles.breakdownRow}>
                    <dt>사전예약 혜택 ({PREORDER_BENEFIT_RATE * 100}%)</dt>
                    <dd className={styles.discount}>
                      -{formatWon(benefitAmount)}
                    </dd>
                  </div>
                )}
                <div className={styles.breakdownTotal}>
                  <dt>합계</dt>
                  <dd>{priceLabel}</dd>
                </div>
              </dl>
            )}
            <div className={styles.orderBarQuantityPrice}>
              <QuantityControl
                isPreorder={isPreorder}
                quantity={quantity}
                onQuantityChange={setQuantity}
                stepperLabel={stepperLabel}
              />
              <div className={styles.priceGroup}>
                <PriceDisplay priceLabel={priceLabel} />
                <button
                  type="button"
                  className={styles.breakdownToggle}
                  aria-expanded={isBreakdownOpen}
                  aria-controls={breakdownId}
                  aria-label={
                    isBreakdownOpen ? '가격 내역 닫기' : '가격 내역 보기'
                  }
                  onClick={() => setIsBreakdownOpen((open) => !open)}
                >
                  {isBreakdownOpen ? (
                    <ChevronUp aria-hidden="true" />
                  ) : (
                    <ChevronDown aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            <div className={styles.orderBarButtons}>
              {!isPreorder && (
                <ActionButton
                  variant="cart"
                  size="md"
                  iconOnly
                  aria-label="장바구니"
                  data-faro-user-action-name="cart-add"
                  onClick={onAddToCart}
                  disabled={addToCartDisabled}
                />
              )}
              <ActionButton
                size="md"
                className={styles.orderBarCheckoutButton}
                // 사전예약은 입장권 유무로 대기열·신청이 갈려 usePreorderSubmit이 이름을 단다.
                data-faro-user-action-name={
                  isPreorder ? undefined : 'order-buy-now'
                }
                onClick={onCheckout}
                disabled={checkoutDisabled}
              >
                {isPreorder ? (
                  '사전예약하기'
                ) : (
                  <>
                    <span className={styles.desktopPrice}>{priceLabel}</span>
                    결제하기
                  </>
                )}
              </ActionButton>
            </div>
          </Container>
        </div>
      </div>
    </>
  )
}
