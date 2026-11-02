import { expect, loginAsAdmin, test } from './fixtures'

import type { Page } from '@playwright/test'

// 개발자가 장애 중 이벤트 DLQ 기록을 거슬러 읽는다 — 목 시나리오 dlq(600건 + 5초마다 새 실패 2건).
// 기록 탭은 100건씩 이어 받고, 새 실패는 맨 앞 한 쪽만 물어 알린다. 관리자 목 데이터는 메모리에만
// 있어 화면 사이는 사이드바로 옮긴다(page.goto면 시드로 돌아간다).

const END = /내리면 더 불러와요|더 불러오는 중/
const NEW_FAILURES = /새 실패 .*맨 위로/
const STAMP = /\d{4}\.\d{2}\.\d{2} [\d:]+/

const rows = (page: Page) => page.locator('tbody tr')

async function openHistory(page: Page) {
  await loginAsAdmin(page, '?mockScenario=dlq')
  // 개발 서버에선 요청 모니터가 왼쪽 아래에 떠 사이드바 맨 아래 메뉴(이벤트 DLQ)를 가린다.
  await page.getByRole('button', { name: '접기' }).click()
  await page
    .getByRole('navigation', { name: '관리자 메뉴' })
    .getByRole('link', { name: '이벤트 DLQ' })
    .click()
  await expect(page).toHaveURL(/\/admin\/dead-letters$/)
  // 탭 이름 뒤에 건수가 붙는다('전체 611') — '전체 기간' 같은 다른 버튼과 겹치지 않게 건수까지 본다.
  await page.getByRole('button', { name: /^전체 [\d,]+$/ }).click()
  await expect(rows(page)).toHaveCount(100)
}

/** 표 끝 안내를 화면에 올려 다음 쪽을 받게 하며 count줄 넘게 쌓일 때까지 내린다 */
async function scrollToRows(page: Page, count: number) {
  await expect(async () => {
    await page.getByText(END).first().scrollIntoViewIfNeeded({ timeout: 1_000 })
    expect(await rows(page).count()).toBeGreaterThanOrEqual(count)
  }).toPass({ timeout: 30_000 })
}

/** 자동 갱신을 5초로 — 기다리는 시간을 줄인다(목은 5초마다 새 실패를 쌓는다) */
async function refreshEvery5s(page: Page) {
  await page.getByRole('button', { name: '10초마다', exact: true }).click()
  await page.getByRole('button', { name: '5초마다', exact: true }).click()
}

test('100건 넘게 쌓여도 끝까지 내려 장애가 시작되기 전 기록까지 본다', async ({
  page,
}) => {
  await openHistory(page)

  await expect(async () => {
    const end = page.getByText(END).first()
    if (await end.count()) await end.scrollIntoViewIfNeeded({ timeout: 1_000 })
    await expect(page.getByText(END)).toHaveCount(0, { timeout: 500 })
  }).toPass({ timeout: 30_000 })

  // 시드 600건 + 원래 목 7건 + 그사이 쌓인 새 실패
  expect(await rows(page).count()).toBeGreaterThan(600)
  await expect(rows(page).last()).toContainText('1일 전')
})

test('여러 쪽을 펼쳐도 갱신은 맨 앞 한 쪽만 다시 받고, 같은 줄이 두 번 그려지지 않는다', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const duplicateKeys: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('same key')) duplicateKeys.push(message.text())
  })
  const refetchedPages: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (
      url.pathname.endsWith('/preorders/dead-letters') &&
      url.searchParams.get('size') === '100'
    )
      refetchedPages.push(url.searchParams.get('page') ?? '')
  })

  await openHistory(page)
  await refreshEvery5s(page)
  // 새 실패가 쌓이는 사이사이 다음 쪽을 받는다 — 오프셋 목록이라 그만큼 밀린 줄이 다음 쪽에 또 온다.
  for (const count of [200, 300, 400]) {
    await page.waitForTimeout(5_500)
    await scrollToRows(page, count)
  }

  refetchedPages.length = 0
  await page.waitForTimeout(11_000)
  // 5초 간격이면 11초에 두세 번 — 펼친 4쪽을 다시 받지 않는다.
  expect(refetchedPages.length).toBeGreaterThanOrEqual(2)
  expect(refetchedPages.length).toBeLessThanOrEqual(3)
  expect(new Set(refetchedPages)).toEqual(new Set(['0']))
  expect(duplicateKeys).toEqual([])
})

test('내려가 읽는 중엔 새 실패를 끼우지 않고 알리기만 하고, 누르면 맨 위에 붙인다', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await openHistory(page)
  await refreshEvery5s(page)
  await scrollToRows(page, 300)
  const reading = rows(page).nth(250)
  await reading.scrollIntoViewIfNeeded()
  const stamp = (await reading.innerText()).match(STAMP)![0]
  const before = await rows(page).count()

  const notice = page.getByRole('button', { name: NEW_FAILURES })
  await expect(notice).toBeVisible({ timeout: 15_000 })
  // 끼우지 않았으니 줄 수가 그대로고, 읽던 줄도 화면에 있다.
  expect(await rows(page).count()).toBe(before)
  await expect(rows(page).filter({ hasText: stamp })).toBeInViewport()

  await notice.click()
  await expect(notice).toHaveCount(0)
  await expect.poll(() => rows(page).count()).toBeGreaterThan(before)
  await expect(rows(page).first()).toContainText('처리 대기')
  await expect(rows(page).first()).toBeInViewport()
})

test('상세에 갔다 돌아오면 보던 줄이 그대로 보인다', async ({ page }) => {
  test.setTimeout(60_000)
  await openHistory(page)
  await scrollToRows(page, 300)
  const target = rows(page).nth(250)
  await target.scrollIntoViewIfNeeded()
  const stamp = (await target.innerText()).match(STAMP)![0]

  // 줄 왼쪽(처리 이름)을 누른다 — 가운데엔 관련 예약 링크가 있을 수 있다.
  await target.click({ position: { x: 200, y: 20 } })
  await expect(page).toHaveURL(/\/admin\/dead-letters\/[^/?]+/)
  await page.goBack()

  await expect(rows(page).filter({ hasText: stamp })).toBeInViewport()
  expect(await rows(page).count()).toBeGreaterThanOrEqual(300)
})
