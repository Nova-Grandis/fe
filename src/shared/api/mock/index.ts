// dev는 기본 on(실제 API로 붙어볼 땐 VITE_USE_MSW=false), 배포(prod)는 VITE_USE_MSW=true일 때만 on.
export const isMockEnabled = import.meta.env.DEV
  ? import.meta.env.VITE_USE_MSW !== 'false'
  : import.meta.env.VITE_USE_MSW === 'true'

/**
 * 부하 검증 화면을 보는 동안 목 예약이 저절로 들어오고 처리되게 한다. 목이 꺼져
 * 있으면(실서버) 아무것도 하지 않고, 목 코드도 불러오지 않는다.
 */
export async function setMockLoad(running: boolean) {
  if (!isMockEnabled) return
  const { setLoadSimulation } = await import('./loadSimulation')
  setLoadSimulation(running)
}

export async function startMockWorker() {
  if (!isMockEnabled) return
  const { startWorker } = await import('./browser')
  await startWorker()
  // 주소에 ?mockScenario=open 을 붙여 열면 오픈 상황(사전예약 3개 · 5,000명 · 실패 5%)을 흉내 낸다.
  // ?mockScenario=dlq 는 이벤트 DLQ 장애(지난 24시간 600건 + 5초마다 새 실패 2건). &mockCount=로 건수를 바꾼다.
  // 새로 고치면 목 데이터가 처음으로 돌아가므로 다시 붙여 연다.
  const params = new URLSearchParams(window.location.search)
  const scenario = params.get('mockScenario')
  if (scenario === 'open') {
    const { startOpenScenario } = await import('./openScenario')
    startOpenScenario()
  }
  if (scenario === 'dlq') {
    const { startDeadLetterScenario } = await import('./deadLetterScenario')
    // 손으로 고친 값(0, 음수, 글자)은 기본 건수로 둔다.
    const count = Number(params.get('mockCount'))
    startDeadLetterScenario(
      Number.isInteger(count) && count > 0 ? count : undefined,
    )
  }
}
