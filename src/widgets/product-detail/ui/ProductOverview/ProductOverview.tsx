import type { Ref } from 'react'

import {
  ProductColorSwatches,
  ProductOptionSelector,
  type Product,
} from '@entities/product'
import { ProductGallery } from '@features/product-gallery'
import {
  PREORDER_BENEFIT_RATE,
  PurchaseSummary,
  QuantityControl,
  type ProductPurchase,
} from '@features/product-purchase'
import { formatWon } from '@shared/lib/formatNumber'
import { ActionButton, InlineAlert } from '@shared/ui'

import { galleryImages } from '../../lib/productDetail'

import * as styles from './ProductOverview.css'

export type ProductOverviewProps = {
  product: Pick<Product, 'title' | 'modelNumber' | 'saleMode' | 'images'>
  // useProductPurchase() 결과 — 모바일 구매 바와 같은 선택 상태를 같이 쓴다.
  purchase: ProductPurchase
  // 사전예약 출고 안내. 배송 차수를 아직 못 받았으면 비워 둔다.
  shipmentLabel?: string
  onCheckout: () => void
  checkoutDisabled?: boolean
  // 일반 상품의 장바구니 담기(사전예약은 장바구니가 없다).
  onAddToCart: () => void
  addToCartDisabled?: boolean
  // 구매자 상세가 이 영역이 화면에 보이는지 보고 위쪽 주문바를 띄운다.
  ref?: Ref<HTMLDivElement>
}

/**
 * 상품 상세 첫 화면 — 사진 슬라이더와 옵션·수량·결제 금액 패널. 구매자 상세와 관리자
 * 미리보기가 같은 화면을 그리도록 여기 모았다. 결제·장바구니가 무엇을 하는지는 부르는 쪽이 정한다.
 */
export function ProductOverview({
  product,
  purchase,
  shipmentLabel,
  onCheckout,
  checkoutDisabled,
  onAddToCart,
  addToCartDisabled,
  ref,
}: ProductOverviewProps) {
  const { title, modelNumber } = product
  const isPreorder = product.saleMode === 'PREORDER'
  const {
    selections,
    select,
    colorAxis,
    optionAxes,
    unavailableReason,
    quantity,
    setQuantity,
    colorLabel,
    totalPrice,
    benefitAmount,
    payAmount,
  } = purchase
  const selectedColor = colorAxis?.values.find(
    ({ normalizedValue }) => normalizedValue === selections[colorAxis.key],
  )

  return (
    <div className={styles.layout} ref={ref}>
      <div className={styles.imageColumn}>
        <ProductGallery
          images={galleryImages(product, selectedColor?.normalizedValue)}
          productName={title}
        />
      </div>
      <div className={styles.optionPanel}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>{title}</h1>
          {modelNumber && (
            <div className={styles.modelNumber}>{modelNumber}</div>
          )}
        </div>
        {colorAxis && (
          <ProductColorSwatches
            colorName={colorAxis.label}
            size="medium"
            colors={colorAxis.values.map((value) => ({
              hex: value.hex ?? '',
              label: value.value,
              selected: value === selectedColor,
            }))}
            onSelect={(index) =>
              select(colorAxis.key, colorAxis.values[index].normalizedValue)
            }
          />
        )}
        {optionAxes.map((axis) => (
          <ProductOptionSelector
            key={axis.key}
            label={axis.label}
            options={axis.values.map((value) => ({
              label: value.value,
              extraPrice: value.surcharge,
              selected: value.normalizedValue === selections[axis.key],
            }))}
            onSelect={(index) =>
              select(axis.key, axis.values[index].normalizedValue)
            }
          />
        ))}
        {/* 웹에서는 수량도 옵션처럼 제목과 스테퍼를 한 줄에 놓는다(모바일은 하단 구매 바에 있다). */}
        <div className={styles.quantityOption}>
          <div className={styles.quantityLabel}>수량</div>
          <QuantityControl
            isPreorder={isPreorder}
            quantity={quantity}
            onQuantityChange={setQuantity}
            stepperLabel={title}
            stepperSize="medium"
          />
        </div>
        <PurchaseSummary
          options={[
            ...(selectedColor
              ? [{ label: colorLabel, hex: selectedColor.hex ?? undefined }]
              : []),
            ...optionAxes.flatMap((axis) => {
              const value = axis.values.find(
                ({ normalizedValue }) =>
                  normalizedValue === selections[axis.key],
              )
              return value ? [{ label: value.value }] : []
            }),
          ]}
          rows={[
            { label: '상품 금액', value: formatWon(totalPrice) },
            { label: '수량', value: `${quantity}개` },
            ...(isPreorder
              ? [
                  {
                    label: `사전예약 혜택 (${PREORDER_BENEFIT_RATE * 100}%)`,
                    value: `-${formatWon(benefitAmount)}`,
                    accent: true,
                  },
                ]
              : []),
          ]}
          total={{
            label: '총 결제 금액',
            value: formatWon(payAmount),
          }}
          note={isPreorder ? shipmentLabel : undefined}
        >
          {unavailableReason && (
            <InlineAlert status="info">{unavailableReason}</InlineAlert>
          )}
          <div className={styles.actions}>
            {!isPreorder && (
              <ActionButton
                variant="cart"
                fullWidth
                className={styles.cartButton}
                aria-label="장바구니"
                data-faro-user-action-name="cart-add"
                onClick={onAddToCart}
                disabled={addToCartDisabled}
              >
                <span className={styles.cartLabel}>장바구니</span>
              </ActionButton>
            )}
            <ActionButton
              fullWidth
              className={isPreorder ? styles.checkoutFull : undefined}
              // 사전예약은 입장권 유무로 대기열·신청이 갈려 usePreorderSubmit이 이름을 단다.
              data-faro-user-action-name={
                isPreorder ? undefined : 'order-buy-now'
              }
              onClick={onCheckout}
              disabled={checkoutDisabled}
            >
              {isPreorder ? '사전예약하기' : '결제하기'}
            </ActionButton>
          </div>
        </PurchaseSummary>
      </div>
    </div>
  )
}
