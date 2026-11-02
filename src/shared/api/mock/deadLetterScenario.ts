import { deadLetterStore } from './fixtures/admin-dead-letter'

import type { DeadLetterDetail, DeadLetterStatus } from '../types'

// 이벤트 DLQ 장애 시나리오 — 주소에 ?mockScenario=dlq 를 붙여 열면 돈다(MSW일 때만). 장애 시간대를
// 거슬러 읽는 동안 새 실패가 계속 쌓이는 상황을 만든다.
//   지난 24시간에 예약 DLQ 600건을 깐다. 그중 대부분은 약 3시간 전 1시간 동안 몰린 장애다.
//   장애는 아직 진행 중이라 5초마다 새 실패(처리 대기)가 2건씩 맨 앞에 쌓인다.
//   &mockCount=3000 처럼 건수를 바꿔 줄이 많을 때를 본다(렌더링 비용 측정).
const DEFAULT_SEED_COUNT = 600
const BURST_SHARE = 0.8
const HOUR = 60 * 60 * 1000
const BURST_START_MS = 3 * HOUR
const BURST_LENGTH_MS = HOUR
const DAY = 24 * HOUR
const ARRIVE_EVERY_MS = 5_000
const ARRIVE_PER_TICK = 2

const eventTypes = [
  'PREORDER_PAYMENT_CONFIRMED',
  'PREORDER_EXPIRY_REQUESTED',
  'EXTERNAL_JOB_SUCCEEDED',
  'PREORDER_PAYMENT_STARTED',
]

// 지난 기록이 대부분이고 손댈 것(처리 대기)은 적다 — 장애 뒤 일괄 되돌리기를 한 번 돌린 모습.
const statusOf = (index: number): DeadLetterStatus => {
  const slot = index % 20
  if (slot < 13) return 'SUCCEEDED'
  if (slot < 16) return 'REDRIVE_FAILED'
  if (slot < 18) return 'DISCARDED'
  return 'OPEN'
}

// 순번이 같으면 늘 같은 줄이 나와, 재고 비교할 때 같은 줄을 다시 찾을 수 있다.
const deadLetterAt = (
  index: number,
  createdMs: number,
  status: DeadLetterStatus,
): DeadLetterDetail => {
  const createdAt = new Date(createdMs).toISOString()
  const id = String(index).padStart(12, '0')
  const eventType = eventTypes[index % eventTypes.length]
  const done = status === 'SUCCEEDED' || status === 'REDRIVE_FAILED'
  return {
    deadLetterId: `e5d1e7e0-4a5b-4c7d-8e9f-${id}`,
    messageId: `scn-msg-${id}`,
    eventId: `e5e1e7e0-4a5b-4c7d-8e9f-${id}`,
    eventType,
    preorderId: null,
    customerId: null,
    failureReason: 'PROCESSING_FAILED',
    receiveCount: 5,
    status,
    redrivable: status === 'OPEN' || status === 'REDRIVE_FAILED',
    redrivenFromId: null,
    sentAt: new Date(createdMs - 60_000).toISOString(),
    updatedAt: createdAt,
    sourceQueue: 'preorder-events',
    aggregateType: 'PREORDER',
    aggregateId: null,
    body: JSON.stringify({ eventId: id, eventType, occurredAt: createdAt }),
    redriveRequestedBy: done ? 'admin' : null,
    redriveStartedAt: done ? createdAt : null,
    redrivenAt: done ? createdAt : null,
    outcomeAt: done ? createdAt : null,
    discardedBy: status === 'DISCARDED' ? 'admin' : null,
    discardedAt: status === 'DISCARDED' ? createdAt : null,
    discardNote:
      status === 'DISCARDED' ? '장애 중 중복 발행분 — 확인 후 버림' : null,
    createdAt,
  }
}

let timer: ReturnType<typeof setInterval> | null = null

export function startDeadLetterScenario(seedCount = DEFAULT_SEED_COUNT) {
  if (timer) return
  const now = Date.now()
  const burst = Math.round(seedCount * BURST_SHARE)
  for (let index = 0; index < seedCount; index += 1) {
    // 장애 구간은 고르게 빽빽하게, 나머지는 하루에 흩는다.
    const agoMs =
      index < burst
        ? BURST_START_MS - (index / burst) * BURST_LENGTH_MS
        : ((index - burst + 1) / (seedCount - burst)) * DAY
    deadLetterStore.push(deadLetterAt(index, now - agoMs, statusOf(index)))
  }
  let next = seedCount
  timer = setInterval(() => {
    for (let count = 0; count < ARRIVE_PER_TICK; count += 1) {
      deadLetterStore.push(deadLetterAt(next, Date.now(), 'OPEN'))
      next += 1
    }
  }, ARRIVE_EVERY_MS)
}
