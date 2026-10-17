import { useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { Settings } from 'lucide-react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'

import { useDefaultAddress, type DefaultAddress } from '@entities/address'
import { cartKeys, useCartLines, type CartLine } from '@entities/cart'
import { getDrawPhase, useDraw, useEnterDraw } from '@entities/draw'
import {
  OrderSummary,
  PAID_ORDER_STATUSES,
  usePlaceOrder,
  type CartOrderItem,
} from '@entities/order'
import { useReservation, type ReservationDetail } from '@entities/preorder'
import { useProfile } from '@entities/profile'
import {
  DaumPostcodeSearch,
  type DaumPostcodeAddress,
} from '@features/address-search'
import {
  buyNowKeyFor,
  forgetBuyNowKey,
  linkBuyNowOrder,
  startDrawEntryPayment,
  startOrderPayment,
} from '@features/payment'
import {
  cartLineToDraft,
  drawToDraft,
  OrderItemList,
  reservationToDraft,
  type PurchaseDraft,
} from '@features/product-purchase'
import { terms, TermsAgreement } from '@features/terms-agreement'
import { ApiRequestError, getErrorMessage } from '@shared/api/client'
import {
  drawPath,
  HOME_PATH,
  mypagePath,
  resultPath,
} from '@shared/config/routes'
import { formatWon } from '@shared/lib/formatNumber'
import { formatPhoneInput, toPhoneDigits } from '@shared/lib/formatPhone'
import { useFormFields } from '@shared/lib/useFormFields'
import { showToast } from '@shared/model/toastStore'
import {
  ActionButton,
  Container,
  Input,
  InlineAlert,
  PollingNotice,
} from '@shared/ui'

import * as styles from './PaymentPage.css'

const GENERIC_PAYMENT_ERROR =
  '결제 요청 중 문제가 발생했습니다. 다시 시도해 주세요.'

// 결제할 수 있는 예약 단계. 결제 진행 중(주문만 만들고 결제창을 닫음)이면 같은 주문으로 다시 결제한다.
const PAYABLE: ReservationDetail['displayStatus'][] = [
  'PAYABLE',
  'PAYMENT_IN_PROGRESS',
]

// 결제할 수 없는 예약일 때 안내 문구.
const UNPAYABLE_MESSAGE: Partial<
  Record<ReservationDetail['displayStatus'], string>
> = {
  RECEIVED: '예약을 등록하고 있어요. 결제는 등록이 끝난 뒤에 할 수 있어요.',
  PROCESSING: '예약을 등록하고 있어요. 결제는 등록이 끝난 뒤에 할 수 있어요.',
  PAYMENT_EXPIRED: '결제 기한이 지나 결제할 수 없어요.',
  RESERVED: '이미 결제가 끝난 예약이에요.',
  CANCELING: '취소 중인 예약이라 결제할 수 없어요.',
  CANCELED: '취소된 예약이라 결제할 수 없어요.',
}

// 장바구니 주문이 이 코드로 거절되면 장바구니가 바뀐 것이다 — 다시 받아 지금 값·상태를 보여 준다.
const CART_REFRESH_CODES = [
  'CART_CHANGED',
  'PRICE_CHANGED',
  'STATE_CONFLICT',
  'INSUFFICIENT_STOCK',
]

// 고른 장바구니 줄을 주문 요청 줄로 — 화면에 보여 준 가격을 그대로 옮긴다(다르면 서버가 PRICE_CHANGED).
const toCartOrderItem = (line: CartLine): CartOrderItem => ({
  variantId: line.variantId,
  quantity: line.quantity,
  warranty: line.warranty,
  expectedUnitPrice: line.unitPrice ?? 0,
  ...(line.warranty ? { expectedWarrantyPrice: line.warrantyPrice ?? 0 } : {}),
})

// 상품 상세의 바로 구매가 history state로 넘긴 옵션·수량. 주소로 직접 오면 없다.
const readBuyNowItems = (state: unknown): PurchaseDraft[] | undefined =>
  Array.isArray(state) && state.length > 0
    ? (state as PurchaseDraft[])
    : undefined

// 바로 구매 줄을 주문 요청 줄로 — 상세에서 보여 준 가격을 그대로 옮긴다(다르면 서버가 PRICE_CHANGED).
const toBuyNowOrderItem = (item: PurchaseDraft): CartOrderItem => ({
  variantId: item.variantId,
  quantity: item.quantity,
  warranty: false,
  expectedUnitPrice: item.unitPrice,
})

// 결제할 대상 하나 — 사전예약 하나, 장바구니에서 고른 줄, 바로 구매. 화면은 이 모양만 본다.
type Checkout = {
  items: PurchaseDraft[]
  totalAmount: number
  // 결제할 수 없으면 그 이유. null이면 결제할 수 있다.
  blockedReason: string | null
  dueRow: string | null
}

const formatDueAt = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

// 저장된 기본 배송지가 없을 때의 처리(배송지 등록 유도 등)가 정해지기 전까지는 배송지가
// 있다고 가정하고 이 값으로 채운다.
// ponytail: 목업 — 배송지 없음 처리가 정해지면 지우고 그쪽 흐름으로 바꾼다.
const fallbackAddress: DefaultAddress = {
  name: '홍길동',
  phone: '01012345678',
  postalCode: '06234',
  line1: '서울특별시 강남구 테헤란로 123',
  line2: null,
}

// email을 제외한 나머지가 결제를 막는 필수 입력이다. 우편번호는 칸이 없고 기본 주소와
// 같이 채워지므로(저장된 배송지·주소 찾기) 따로 검사하지 않는다.
const REQUIRED_KEYS = [
  'name',
  'phone',
  'addressLabel',
  'address',
  'addressDetail',
] as const

// 사전예약 하나(?preorderId=), 장바구니에서 고른 줄(?cart=), 상품 상세의 바로 구매(history state)를 결제한다
// (order 명세: 주문 생성 → 결제 준비 → 토스 결제창 → 승인). 결제할 대상 없이 들어오면 홈으로 보낸다.
export function PaymentPage() {
  const [searchParams] = useSearchParams()
  const preorderId = searchParams.get('preorderId') ?? ''
  const cartItemIds = (searchParams.get('cart') ?? '')
    .split(',')
    .filter(Boolean)
  const drawId = searchParams.get('drawId') ?? ''
  const isCart = !preorderId && !drawId && cartItemIds.length > 0
  const location = useLocation()
  const buyNowItems =
    !preorderId && !drawId && !isCart
      ? readBuyNowItems(location.state)
      : undefined
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const reservation = useReservation(preorderId)
  const cart = useCartLines({ enabled: isCart })
  const draw = useDraw(drawId)
  const enterDraw = useEnterDraw()
  const placeOrder = usePlaceOrder()
  const [isStarting, setIsStarting] = useState(false)
  const { data: profile } = useProfile()
  const { data: savedAddress } = useDefaultAddress()
  const [agreedIds, setAgreedIds] = useState<Set<string>>(new Set())
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [addressSearchOpen, setAddressSearchOpen] = useState(false)

  // 회원 프로필과 기본 배송지를 기본값으로 깐다(SignupPage의 프로필 프리필과 같은
  // 패턴). 사용자가 고친 칸이 항상 우선하므로 응답이 늦게 와도 입력 중인 값을
  // 덮어쓰지 않는다(useFormFields). 기본 주소는 직접 입력하지 않고 주소 찾기로만 바꾼다.
  const address = savedAddress ?? fallbackAddress
  const form = useFormFields(
    {
      name: profile?.name || address.name,
      phone: profile?.phoneNumber ?? '',
      email: profile?.email ?? '',
      addressLabel: address.label || '기본 배송지',
      postcode: address.postalCode,
      address: address.line1,
      addressDetail: address.line2 ?? '',
    },
    REQUIRED_KEYS,
  )
  const { field } = form
  // 읽기 전용 칸에 우편번호를 붙여 "기본 주소 (우편번호)"로 한 칸에 보여 준다 — 폼 값은
  // 주소와 우편번호가 따로다.
  const addressDisplay = [
    form.values.address,
    form.values.postcode && `(${form.values.postcode})`,
  ]
    .filter(Boolean)
    .join(' ')

  const detail = reservation.data
  const drawData = draw.data
  const cartLines = isCart
    ? cart.data?.filter(({ cartItemId }) => cartItemIds.includes(cartItemId))
    : undefined
  // 결제 금액은 서버가 정한다 — 사전예약은 예약 접수 당시 단가(수량 1), 장바구니는 지금 가격의 줄 금액 합.
  const checkout: Checkout | null = drawData
    ? {
        items: [drawToDraft(drawData)],
        totalAmount: drawData.entryFee,
        blockedReason:
          getDrawPhase(drawData) === 'OPEN' ? null : '응모 기간이 아니에요.',
        dueRow: `${formatDueAt(drawData.closesAt)}까지`,
      }
    : detail
      ? {
          items: [reservationToDraft(detail)],
          totalAmount: detail.unitPrice,
          blockedReason: PAYABLE.includes(detail.displayStatus)
            ? null
            : (UNPAYABLE_MESSAGE[detail.displayStatus] ??
              '결제할 수 있는 예약이 아니에요.'),
          dueRow: detail.paymentDueAt
            ? `${formatDueAt(detail.paymentDueAt)}까지`
            : null,
        }
      : cartLines
        ? {
            items: cartLines.map(cartLineToDraft),
            totalAmount: cartLines.reduce(
              (sum, line) => sum + (line.lineAmount ?? 0),
              0,
            ),
            blockedReason:
              cartLines.length !== cartItemIds.length
                ? '장바구니가 바뀌었어요. 장바구니에서 다시 골라 주세요.'
                : cartLines.some(({ purchasable }) => !purchasable)
                  ? '지금 살 수 없는 상품이 있어요. 장바구니에서 확인해 주세요.'
                  : null,
            dueRow: '주문 후 10분 안에 결제',
          }
        : buyNowItems
          ? {
              items: buyNowItems,
              totalAmount: buyNowItems.reduce(
                (sum, item) => sum + item.unitPrice * item.quantity,
                0,
              ),
              blockedReason: null,
              dueRow: null,
            }
          : null
  const payable = checkout !== null && checkout.blockedReason === null
  const totalAmount = checkout?.totalAmount ?? 0
  const isPaying = placeOrder.isPending || enterDraw.isPending || isStarting

  const requiredAgreed = terms.every(
    (term) => !term.required || agreedIds.has(term.id),
  )
  // 검색 없이 닫으면 onComplete가 안 불려서 폼은 그대로다. 상세 주소는 이전 주소
  // 기준 값이라 새로 찾은 주소와 안 맞을 수 있어 같이 비운다.
  const handleAddressComplete = ({
    postcode,
    address,
  }: DaumPostcodeAddress) => {
    form.setValues({ postcode, address, addressDetail: '' })
    setAddressSearchOpen(false)
  }

  const toggleAgree = (id: string, checked: boolean) =>
    setAgreedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })

  const toggleAllAgree = (checked: boolean) =>
    setAgreedIds(checked ? new Set(terms.map((term) => term.id)) : new Set())

  // ① 주문 생성(같은 예약이면 기존 주문) → ② 결제 준비(tossOrderId·금액·주문명) → ③ 토스 결제창(카드).
  // 정상 진행되면 브라우저가 successUrl/failUrl로 이동하므로, catch는 결제창이 뜨기 전 오류만 잡는다.
  const handlePayment = async () => {
    form.markSubmitted()
    setPaymentError(null)
    if (!form.requiredFilled || !payable) return

    let buyNowKey: string | undefined
    try {
      const shipTo = {
        name: form.values.name,
        phone: form.values.phone,
        postalCode: form.values.postcode,
        line1: form.values.address,
        line2: form.values.addressDetail || null,
      }
      // 럭키 드로우 — 응모(배송지 저장) → 응모비 결제 준비 → 토스 결제창. 이미 응모한 회차면 서버가 기존 응모를 돌려준다.
      if (drawId) {
        const entry = await enterDraw.mutateAsync({ drawId, shipTo })
        if (entry.status !== 'AWAITING_PAYMENT') {
          showToast(
            entry.status === 'PAID'
              ? '이미 응모한 회차예요.'
              : '응모비 결제를 확인하고 있어요.',
          )
          navigate(drawPath(drawId), { replace: true })
          return
        }
        setIsStarting(true)
        await startDrawEntryPayment({
          drawId,
          customerName: form.values.name,
          customerEmail: form.values.email || undefined,
        })
        return
      }
      const buyNow = buyNowItems && {
        source: 'BUY_NOW' as const,
        items: buyNowItems.map(toBuyNowOrderItem),
        shipTo,
      }
      buyNowKey = buyNow ? buyNowKeyFor(buyNow) : undefined
      const order = await placeOrder.mutateAsync(
        cartLines
          ? {
              source: 'CART',
              items: cartLines.map(toCartOrderItem),
              shipTo,
            }
          : buyNow && buyNowKey
            ? { ...buyNow, idempotencyKey: buyNowKey }
            : { source: 'PREORDER', preorderId, shipTo },
      )
      if (buyNowKey) linkBuyNowOrder(buyNowKey, order.orderId)
      // 기존 주문이 이미 결제됐으면 결제 단계로 가지 않고 결과를 보여 준다.
      if (order.status === 'AUTHORIZING') {
        setPaymentError(
          '결제를 확인하고 있어요. 잠시 뒤 주문 내역에서 결과를 확인해 주세요.',
        )
        return
      }
      if (PAID_ORDER_STATUSES.includes(order.status)) {
        if (buyNowKey) forgetBuyNowKey({ key: buyNowKey })
        navigate(resultPath(preorderId ? 'preorder-paid' : 'paid'), {
          replace: true,
          state: { orderId: order.orderId },
        })
        return
      }
      // 결제 대기만 결제 단계로 간다 — 그사이 취소가 시작됐거나 모르는 상태면 결제 완료로 보이지 않게 막는다.
      if (order.status !== 'AWAITING_PAYMENT') {
        // 같은 키의 바로 구매 주문이 취소됐거나 기한이 지났다 — 다음 시도는 새 키로 새 주문을 만든다.
        if (buyNowKey && order.status === 'CANCELED') {
          forgetBuyNowKey({ key: buyNowKey })
          setPaymentError(
            '이전 주문이 취소됐어요. 다시 결제하면 새로 주문해요.',
          )
          return
        }
        setPaymentError('결제할 수 없는 주문이에요. 주문 내역을 확인해 주세요.')
        return
      }
      setIsStarting(true)
      await startOrderPayment({
        orderId: order.orderId,
        preorderId: preorderId || undefined,
        customerName: form.values.name,
        customerEmail: form.values.email || undefined,
      })
    } catch (caught) {
      if (
        caught instanceof ApiRequestError &&
        CART_REFRESH_CODES.includes(caught.error.code)
      )
        void queryClient.invalidateQueries({ queryKey: cartKeys.all })
      // 같은 키의 처음 주문과 내용이 다르다 — 다음 시도는 새 키로 보낸다.
      if (
        caught instanceof ApiRequestError &&
        caught.error.code === 'KEY_PAYLOAD_MISMATCH' &&
        buyNowKey
      )
        forgetBuyNowKey({ key: buyNowKey })
      setPaymentError(getErrorMessage(caught, GENERIC_PAYMENT_ERROR))
    } finally {
      setIsStarting(false)
    }
  }

  if (!preorderId && !isCart && !drawId && !buyNowItems)
    return <Navigate to={HOME_PATH} replace />

  // 예약·장바구니·회차를 아직 못 받았으면 안내만 보인다.
  const loadQuery = drawId ? draw : isCart ? cart : reservation
  if (!checkout) {
    return (
      <div className={styles.root} data-theme="dark" data-header-theme="dark">
        <Container>
          <div className={styles.title}>주문 / 결제</div>
          <InlineAlert status={loadQuery.isError ? 'error' : 'info'}>
            {loadQuery.isError
              ? getErrorMessage(
                  loadQuery.error,
                  drawId
                    ? '럭키드로우를 불러오지 못했어요.'
                    : isCart
                      ? '장바구니를 불러오지 못했어요.'
                      : '예약을 불러오지 못했어요.',
                )
              : '주문할 상품을 불러오는 중이에요.'}
          </InlineAlert>
        </Container>
      </div>
    )
  }

  return (
    <div className={styles.root} data-theme="dark" data-header-theme="dark">
      <Container>
        <div className={styles.title}>
          {drawId ? '응모 / 결제' : '주문 / 결제'}
        </div>

        {paymentError && (
          <InlineAlert status="error">{paymentError}</InlineAlert>
        )}
        {/* 예약 외부 등록·취소를 기다리며 다시 묻는 중에 실패하고 있으면 알린다. */}
        <PollingNotice query={reservation} />
        {checkout.blockedReason && (
          <InlineAlert status="info">{checkout.blockedReason}</InlineAlert>
        )}

        <div className={styles.layout}>
          <div className={styles.form}>
            <section className={styles.section}>
              <OrderItemList items={checkout.items} />
            </section>

            <section className={styles.section}>
              <div className={styles.sectionTitle}>수령인</div>
              <div className={styles.fieldRow}>
                <Input
                  {...field('name', '이름')}
                  variant="stacked"
                  placeholder="이름"
                />
                <Input
                  {...field('phone', '휴대폰')}
                  value={formatPhoneInput(form.values.phone)}
                  onChange={(event) =>
                    form.setValues({ phone: toPhoneDigits(event.target.value) })
                  }
                  variant="stacked"
                  placeholder="010-1234-5678"
                  inputMode="numeric"
                />
              </div>
              <Input
                {...field('email', '이메일')}
                variant="stacked"
                placeholder="email@example.com"
                inputMode="email"
              />
            </section>

            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>배송지</div>
                  <Link
                    to={mypagePath('address-manage')}
                    className={styles.addressManageLink}
                  >
                    <Settings size={16} aria-hidden="true" />
                    배송지 관리
                  </Link>
                </div>
                <div className={styles.note}>
                  ※ 기본 배송지로 자동 설정되었습니다. 주문 전 주소를 확인해
                  주세요.
                </div>
              </div>

              <Input {...field('addressLabel', '배송지명')} variant="stacked" />
              <div className={styles.addressRow}>
                <Input
                  {...field('address', '기본 주소')}
                  variant="stacked"
                  value={addressDisplay}
                  readOnly
                />
                <ActionButton
                  variant="neutral"
                  className={styles.addressAction}
                  onClick={() => setAddressSearchOpen(true)}
                >
                  주소 찾기
                </ActionButton>
              </div>
              <Input
                {...field('addressDetail', '상세 주소')}
                variant="stacked"
                placeholder="동, 호수"
              />
            </section>
          </div>

          <OrderSummary
            className={styles.summary}
            rows={[
              {
                label: drawId ? '증정품' : '상품 수',
                value: `${checkout.items.reduce((sum, item) => sum + item.quantity, 0)}개`,
              },
              {
                label: drawId ? '응모비' : '주문 금액',
                value: formatWon(totalAmount),
              },
              ...(checkout.dueRow
                ? [
                    {
                      label: drawId ? '응모 마감' : '결제 기한',
                      value: checkout.dueRow,
                      highlight: true,
                    },
                  ]
                : []),
            ]}
            totalLabel="결제 예정 금액"
            totalValue={formatWon(totalAmount)}
            actionLabel={`${formatWon(totalAmount)} ${drawId ? '결제하고 응모하기' : '결제하기'}`}
            actionName={drawId ? 'draw-apply' : 'payment-request'}
            actionDisabled={!requiredAgreed || !payable || isPaying}
            darkAction
            onAction={() => void handlePayment()}
          >
            <TermsAgreement
              agreedIds={agreedIds}
              onToggle={toggleAgree}
              onToggleAll={toggleAllAgree}
            />
          </OrderSummary>
        </div>

        <DaumPostcodeSearch
          open={addressSearchOpen}
          onOpenChange={setAddressSearchOpen}
          onComplete={handleAddressComplete}
        />
      </Container>
    </div>
  )
}
