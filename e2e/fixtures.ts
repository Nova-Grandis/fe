import { test as base, expect } from '@playwright/test'

import type { Page } from '@playwright/test'

export { expect }

// 목 상품 id — fixtures/product.ts의 mockUuid(2, n). 순서가 바뀌면 같이 고친다.
export const productId = (n: number) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const MACBOOK_PRO_14 = productId(1) // 사전예약(오늘 오픈)
export const NOVA_PHONE_1 = productId(2) // 일반 구매, 첫 옵션 실버 / 256GB

// 테스트마다 새 브라우저 컨텍스트라 localStorage가 비어 있다 — 처음 온 사용자로 취급돼
// 홈(/)이 온보딩으로 넘어가지 않게 본 것으로 둔다.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem('nova:onboardingSeen', '1')
    })
    await use(page)
  },
})

export const PROFILE = {
  name: '김테스트',
  email: 'e2e@example.com',
  phoneNumber: '01012345678',
}

/**
 * 가입을 마친 회원으로 로그인한다. 목 인증 DB(nova-auth-mock-db)에 프로필을 미리 채워
 * 회원가입 화면을 건너뛴다 — 가입 흐름 자체는 login.spec.ts가 본다.
 * 회원 전용 경로(path)로 들어가면 홈으로 튕기며 로그인 모달이 뜨고, 로그인 뒤 그 경로로 돌아온다.
 * 공개 화면에서 시작하려면 로그인한 뒤 따로 이동한다.
 */
export async function loginAs(page: Page, path = '/mypage') {
  await page.addInitScript((profile) => {
    // 새로고침마다 다시 심으면 세션 기록을 지우므로 처음 한 번만.
    if (localStorage.getItem('nova-auth-mock-db')) return
    localStorage.setItem(
      'nova-auth-mock-db',
      JSON.stringify({
        sessions: [],
        refreshTokens: [],
        usedCodes: [],
        profile,
      }),
    )
  }, PROFILE)
  await page.goto(path)
  await page
    .getByRole('dialog', { name: '로그인' })
    .getByRole('button', { name: '카카오 로그인' })
    .click()
  await expect(page).toHaveURL(path)
}

/**
 * 토스 결제창 대신 바로 콜백으로 돌려보내는 가짜 SDK. 토스 SDK는 window.TossPayments가
 * 이미 있으면 스크립트를 받지 않고 그걸 쓴다.
 * 결제창에 넘긴 값은 sessionStorage 'e2e:toss-request'에 남긴다.
 * amountOverride를 주면 콜백 금액을 그 값으로 바꿔 보낸다(위조 확인용).
 * failFirst를 주면 첫 결제만 토스가 실패로 돌려보낸 것처럼(failUrl + code·message) 하고,
 * 그다음 결제부터는 성공시킨다(실패 뒤 다시 결제 확인용).
 */
export async function stubTossPayments(
  page: Page,
  {
    amountOverride,
    failFirst,
  }: {
    amountOverride?: number
    failFirst?: { code: string; message: string }
  } = {},
) {
  await page.addInitScript(
    ({ override, failure }) => {
      type PaymentRequest = {
        orderId: string
        orderName: string
        amount: { value: number }
        successUrl: string
        failUrl: string
      }
      const requestPayment = (request: PaymentRequest) => {
        sessionStorage.setItem('e2e:toss-request', JSON.stringify(request))
        const failNow =
          failure !== null && !sessionStorage.getItem('e2e:toss-failed')
        if (failNow) {
          sessionStorage.setItem('e2e:toss-failed', '1')
          const url = new URL(request.failUrl)
          url.searchParams.set('code', failure.code)
          url.searchParams.set('message', failure.message)
          location.href = url.toString()
        } else {
          const url = new URL(request.successUrl)
          url.searchParams.set('paymentKey', 'e2e_payment_key')
          url.searchParams.set('orderId', request.orderId)
          url.searchParams.set(
            'amount',
            String(override ?? request.amount.value),
          )
          location.href = url.toString()
        }
        // 진짜 결제창처럼 페이지를 떠나므로 끝나지 않는다.
        return new Promise(() => {})
      }
      Object.assign(window, {
        TossPayments: () => ({ payment: () => ({ requestPayment }) }),
      })
    },
    { override: amountOverride ?? null, failure: failFirst ?? null },
  )
}

export const readTossRequest = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('e2e:toss-request') ?? 'null'),
  )

export const TEST_ADDRESS = {
  postcode: '06236',
  roadAddress: '서울 강남구 테헤란로 152',
}

/**
 * 다음 우편번호 검색 대신 버튼 하나를 그리는 가짜 스크립트. "테스트 주소 선택"을 누르면
 * TEST_ADDRESS를 고른 것으로 돌려준다.
 */
export async function stubDaumPostcode(page: Page) {
  await page.addInitScript((address) => {
    type Options = {
      oncomplete: (data: {
        zonecode: string
        roadAddress: string
        jibunAddress: string
        userSelectedType: 'R' | 'J'
      }) => void
    }
    class Postcode {
      options: Options
      constructor(options: Options) {
        this.options = options
      }
      open() {}
      embed(element: HTMLElement) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = '테스트 주소 선택'
        button.onclick = () =>
          this.options.oncomplete({
            zonecode: address.postcode,
            roadAddress: address.roadAddress,
            jibunAddress: address.roadAddress,
            userSelectedType: 'R',
          })
        element.replaceChildren(button)
      }
    }
    Object.assign(window, { daum: { Postcode } })
  }, TEST_ADDRESS)
}

/**
 * 요청 모니터의 [장애 내기]와 같다 — 고른 요청이 503으로 실패한다(탭을 닫거나 null로 풀 때까지).
 */
export const setMockFault = (
  page: Page,
  fault: 'all' | 'queue' | 'confirm' | null,
) =>
  page.evaluate((value) => {
    if (value) sessionStorage.setItem('mock-fault', value)
    else sessionStorage.removeItem('mock-fault')
  }, fault)

/** 결제 페이지의 배송지(가짜 우편번호 검색)를 채우고 약관에 모두 동의한다. stubDaumPostcode가 필요하다. */
export async function fillPaymentForm(page: Page) {
  await page.getByRole('button', { name: '주소 찾기' }).click()
  await page.getByRole('button', { name: '테스트 주소 선택' }).click()
  await page.getByLabel('상세 주소').fill('101동 101호')
  await page.getByText('아래 내용에 모두 동의합니다.').click()
}

// ── 장바구니 결제 ─────────────────────────────────────────

// 목 장바구니(fixtures/preorder.ts)는 5줄이다 — 살 수 있는 3줄(스마트폰 1 ×2, 스마트폰 1 보증 포함,
// 노트북 1)과 판매 중지·품절 1줄씩. 살 수 있는 3줄의 합계가 4,593,500원이다.
export const CART_TOTAL = 4_593_500
export const CART_TOTAL_TEXT = '4,593,500원'

/** 로그인해 장바구니에서 살 수 있는 상품을 모두 골라 결제 페이지로 간다. */
export async function openCartPayment(page: Page) {
  await loginAs(page, '/mypage?state=cart')
  await page.getByText('전체 선택').click()
  await page.getByRole('button', { name: '결제하기', exact: true }).click()
  await expect(page).toHaveURL(/\/payment\?cart=/)
}

export const cartPayButton = (page: Page) =>
  page.getByRole('button', { name: `${CART_TOTAL_TEXT} 결제하기` })

// ── 사전예약 ──────────────────────────────────────────────

// 목 홍보 1(handlers/promotion.ts) — 맥북 프로 14와 NOVA 폴더블 1이 묶인 '오늘 오픈' 사전예약.
// 폴더블 1은 이미 예약해 둔 상태로 시드돼 있다(fixtures/preorder.ts).
export const TODAY_PROMOTION = '60000000-0000-4000-8000-000000000001'
export const NOVA_FOLDABLE_1 = productId(15) // 시드: 결제 대기(구매 확정 대기) 예약이 있다
// 시드 예약이 없는 '오늘 오픈' 사전예약 — 단독 홍보(세 번째)로 묶여 있다.
export const NOVA_FOLDABLE_3 = productId(17)
export const FOLDABLE_3_PROMOTION = '60000000-0000-4000-8000-000000000003'

/** 한국 시간 오늘 time(HH:MM:SS)인 Date. */
export const kstToday = (time: string) => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
  }).format(new Date())
  return new Date(`${today}T${time}+09:00`)
}

/**
 * 브라우저 시계를 한국 시간 오늘 time(HH:MM:SS)으로 맞춘다. 첫 이동 전에 부른다.
 * '오늘 오픈' 목 사전예약은 한국 시간 오늘 09:00에 열린다. 시계는 그 시각부터 그대로 흐른다
 * (목 대기열이 시간으로 순번을 줄이므로 멈추면 안 된다).
 */
export async function setKstClock(page: Page, time: string) {
  await page.clock.install({ time: kstToday(time) })
}

/**
 * 사전예약 상세에서 모델을 골라 대기열을 통과해 그 상품 페이지에 도착한다.
 * 목 대기열은 15~40번에서 시작해 초당 3명씩 줄어 15초 가까이 걸린다.
 */
export async function passPreorderQueue(
  page: Page,
  modelName: string,
  modelId: string,
) {
  await page.goto(`/preorder/${TODAY_PROMOTION}`)
  await queueFromPreorderDetail(page, modelName, modelId)
}

/** passPreorderQueue에서 상세 페이지로 가는 것만 뺀 것 — 이미 상세 페이지에 있을 때 쓴다. */
export async function queueFromPreorderDetail(
  page: Page,
  modelName: string,
  modelId: string,
) {
  await page.getByRole('button', { name: '사전예약 하러가기' }).click()

  const sheet = page.getByRole('dialog', { name: '사전예약' })
  const reserveButton = page.getByRole('button', { name: '예약하기' })
  await sheet
    .locator('div')
    .filter({ hasText: modelName })
    .filter({ has: reserveButton })
    .last()
    .getByRole('button', { name: '예약하기' })
    .click()

  await expect(page.getByText(/조금만 기다려주세요/)).toBeVisible()
  await expect(page).toHaveURL(`/products/${modelId}`, { timeout: 30_000 })
}

/** 상품 페이지(데스크톱)의 옵션 패널 쪽 "사전예약하기" 버튼. */
export const preorderSubmitButton = (page: Page) =>
  page.getByRole('button', { name: '사전예약하기', exact: true }).first()

/**
 * 사전예약하기를 누른 뒤 — 상품 페이지가 외부 등록을 5초까지 기다리고, 목은 2초 뒤 등록하므로 그 예약의 결제로 바로 간다.
 */
export async function confirmPreorder(page: Page) {
  await expect(page).toHaveURL(/\/payment\?preorderId=/, { timeout: 15_000 })
}

/**
 * 목 외부 등록에 걸리는 시간(ms)을 바꾼다(탭을 닫거나 null로 풀 때까지). 5초를 넘기면 접수 뒤 결제가 아니라
 * 예약 접수 화면(처리 중 → 구매 확정 가능)으로 간다.
 */
export const setMockRegisterDelay = (page: Page, ms: number | null) =>
  page.evaluate((value) => {
    if (value) sessionStorage.setItem('mock-register-delay-ms', String(value))
    else sessionStorage.removeItem('mock-register-delay-ms')
  }, ms)

/**
 * 사전예약 접수 요청(POST /api/v1/preorders?productId=)을 모은다. MSW가 응답해도 페이지의
 * request 이벤트에는 잡힌다. 멱등키·입장권·본문을 비교할 때 쓴다.
 */
export function collectPreorderSubmits(page: Page) {
  const submits: {
    url: string
    idempotencyKey: string | undefined
    admissionTicket: string | undefined
    body: unknown
  }[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (
      request.method() === 'POST' &&
      url.pathname === '/api/v1/preorders' &&
      url.searchParams.has('productId')
    ) {
      const headers = request.headers()
      submits.push({
        url: request.url(),
        idempotencyKey: headers['idempotency-key'],
        admissionTicket: headers['x-admission-ticket'],
        body: request.postDataJSON(),
      })
    }
  })
  return submits
}

/** 사전예약 내역에 새 예약(목 기준 순번 1,287번)이 딱 하나만 있는지 본다. */
export async function expectSingleNewReservation(page: Page) {
  await page.goto('/mypage?state=preorder-check')
  await expect(page.getByText('예약 순번 1,287번')).toHaveCount(1)
  await expect(page.getByText('예약 순번 1,288번')).toHaveCount(0)
}

// ── 관리자 ────────────────────────────────────────────────

/**
 * 로컬 목 관리자 계정(admin / admin1234)으로 로그인한다. 회원 로그인은 풀린다.
 * search로 목 시나리오를 켠다(예: '?mockScenario=dlq') — 시나리오는 앱을 처음 열 때만 읽는다.
 */
export async function loginAsAdmin(page: Page, search = '') {
  await page.goto(`/admin/login${search}`)
  await page.getByLabel('아이디').fill('admin')
  await page.getByLabel('비밀번호').fill('admin1234')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL('/admin')
}
