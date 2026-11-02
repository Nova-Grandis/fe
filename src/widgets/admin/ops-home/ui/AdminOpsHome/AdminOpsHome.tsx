import { useState } from 'react'

import { CircleCheck, TriangleAlert } from 'lucide-react'

import { useAdminDraws, useStuckDraws } from '@entities/admin-draw'
import { useAdminOrderCounts } from '@entities/admin-order'
import { useAdminProductCount } from '@entities/admin-product'
import { useReconciliationRuns } from '@entities/admin-reconciliation'
import {
  useReservationStats,
  useSyncJobErrorGroups,
} from '@entities/admin-reservation'
import {
  isBraking,
  useWaitingroomStatusHistory,
  productWaitEstimate,
  productWaitSeconds,
} from '@entities/admin-waitingroom'
import {
  OpenPreorderPicker,
  SLOW_AFTER_MS,
  useOpenPreorders,
} from '@features/open-preorder-picker'
import { getErrorMessage } from '@shared/api/client'
import { pollingError } from '@shared/api/queryPolicy'
import {
  ADMIN_ORDERS_PATH,
  ADMIN_RECONCILIATION_PATH,
  ADMIN_WAITINGROOM_PATH,
  adminReservationsPath,
} from '@shared/config/routes'
import { formatNumber } from '@shared/lib/formatNumber'
import { slopePerSecond } from '@shared/lib/samples'
import { useScrolledPast } from '@shared/lib/useScrolledPast'
import { InlineAlert, RefreshStatus, Skeleton, SkeletonGroup } from '@shared/ui'

import { ORDER_SUMMARY_STEPS } from '../../lib/orderSummary'
import {
  reconcileSummary,
  type ReconcileSummary,
} from '../../lib/reconcileSummary'
import { useReprocessRun } from '../../lib/useReprocessRun'
import { DrawSummaryCard } from '../DrawSummaryCard'
import { OpenPreorderCard } from '../OpenPreorderCard'
import { OpsKpiCard } from '../OpsKpiCard'
import { OpsTaskCard, type OpsTaskCardProps } from '../OpsTaskCard'
import { OrderSummaryCard } from '../OrderSummaryCard'
import { QueueCard } from '../QueueCard'
import { ReprocessBanner } from '../ReprocessBanner'
import { ReprocessModal } from '../ReprocessModal'
import { StuckDrawTask } from '../StuckDrawTask'
import { UrgentBanner, type UrgentItem } from '../UrgentBanner'

import * as styles from './AdminOpsHome.css'

// 집계는 서버가 5초까지 캐시해(명세: "5초 이상이면 충분") 그보다 자주 받아도 같은 값이다.
// 문제를 처음 알아채는 화면이라 그 하한에 맞춘다.
const POLL_INTERVAL_MS = 5_000
// 주문·상품 수, 럭키드로우 단계는 몇 초 사이엔 잘 안 바뀌어 느리게 다시 받는다.
const SLOW_POLL_MS = 30_000
/** 실패 숫자에 나눠 적을 사전예약 수 — 넘으면 '외 N곳'으로 줄인다 */
const BREAKDOWN_MAX = 3
// shortcut: 마감 뒤 하루 안의 회차만 멈췄는지 본다(회차마다 진행을 따로 받아서). 회차가 많아지면 서버 집계로 바꾼다.
const STUCK_LOOKBACK_MS = 24 * 60 * 60 * 1000
// 맨 뒤 예상 대기가 이만큼 길어지면 할 일로 띄운다 — 서버에 기준이 없어 화면에서 정한 값이다.
const LONG_WAIT_SECONDS = 10 * 60

type Task = OpsTaskCardProps & { key: string }

const sum = (values: Record<string, number>) =>
  Object.values(values).reduce((total, value) => total + value, 0)

/** 가장 오래 기다린 것이 몇 분째인지 */
const ageOf = (iso: string | null, now: number) => {
  if (!iso) return null
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
  return minutes < 60 ? `${minutes}분째` : `${Math.floor(minutes / 60)}시간째`
}

export type AdminOpsHomeProps = {
  /** 상품 id → 이름. 대기열 응답엔 id만 있다 */
  productNames: ReadonlyMap<string, string>
}

/**
 * 운영 대시보드 — 오픈 중 운영자가 가장 먼저 보는 한 화면. 맨 위에 결제를 막는 긴급한 일,
 * 그 아래 영역별 숫자(대기열·예약·외부 등록·배송), 처리 흐름과 사전예약별 현황, 마지막으로
 * 할 일 목록과 럭키드로우·주문 요약을 둔다. 숫자마다 처리할 화면으로 가는 링크를 붙인다.
 */
export function AdminOpsHome({ productNames }: AdminOpsHomeProps) {
  const stats = useReservationStats(undefined, POLL_INTERVAL_MS)
  const draws = useAdminDraws(SLOW_POLL_MS)
  const orders = useAdminOrderCounts(ORDER_SUMMARY_STEPS, SLOW_POLL_MS)
  const activeProducts = useAdminProductCount(
    { status: 'ACTIVE' },
    SLOW_POLL_MS,
  )
  const pausedProducts = useAdminProductCount(
    { status: 'PAUSED' },
    SLOW_POLL_MS,
  )

  // 진행 중인 사전예약 — 동시에 여럿 열릴 수 있어 상품별 집계를 함께 받는다.
  const {
    queue,
    openProducts,
    items: openPreorders,
    nameOf,
    statsOf,
    statsQuery,
  } = useOpenPreorders(productNames, POLL_INTERVAL_MS)
  const q = queue.data
  // 대시보드가 보는 범위 — 처음엔 전체(null). 고른 사전예약이 마감돼 목록에서 빠지면 전체로
  // 돌아간다.
  const [picked, setPicked] = useState<string | null>(null)
  const selected = openProducts.some((product) => product.productId === picked)
    ? picked
    : null
  const scoped = selected !== null

  // 예약 숫자와 외부 등록 대기는 진행 중인 사전예약만 센다(고르면 그것만). 상품 없이 받은
  // 집계엔 마감된 회차까지 들어 있어, 하나만 열려 있어도 그 사전예약과 숫자가 달라진다.
  // 외부 등록 실패와 할 일은 마감된 회차에 남은 것도 처리해야 해서 아래 t(전체)로 센다.
  const scopeIds = selected
    ? [selected]
    : openProducts.map((product) => product.productId)
  const scopeStats = scopeIds
    .map(statsOf)
    .filter((value) => value !== undefined)
  // 대기열 현황을 못 받으면 진행 중인 사전예약을 몰라 범위가 비는데, 그걸 0건으로 세지 않는다.
  const scopeLoaded = q !== undefined && scopeStats.length === scopeIds.length
  const scopePending = queue.isPending || statsQuery.isPending
  // 사전예약별 집계가 실패하면 위 숫자가 비거나 멈춘다 — 전체 집계와 따로 알린다.
  const scopeError = pollingError(statsQuery)
  const countOf = (status: keyof (typeof scopeStats)[number]['preorders']) =>
    scopeLoaded
      ? scopeStats.reduce((total, value) => total + value.preorders[status], 0)
      : null
  const received = scopeLoaded
    ? scopeStats.reduce((total, value) => total + sum(value.preorders), 0)
    : null

  const s = stats.data
  // 판정 기준 시각 — 받은 응답의 시각을 써서 렌더마다 흔들리지 않게 한다. 회차 단계는 회차
  // 목록만 와도 정해야 해서 둘 중 늦은 쪽을 쓴다. 둘 다 못 받았으면 0이라 판정하지 않는다.
  const now = Math.max(stats.dataUpdatedAt, draws.dataUpdatedAt)

  // 사전예약을 골랐으면 숫자·할 일도 그 사전예약 집계로 센다.
  const t = selected ? statsOf(selected) : s
  const failures = t ? t.syncJobs.REGISTER.DEAD_LETTER : null

  // 둘 이상 열려 있으면 실패가 어느 사전예약에서 났는지 나눠 적는다(많은 순).
  const failedPreorders = openPreorders
    .filter((item) => item.failures)
    .toSorted((a, b) => (b.failures ?? 0) - (a.failures ?? 0))
  const failureBreakdown =
    !scoped && openPreorders.length > 1
      ? [
          ...failedPreorders
            .slice(0, BREAKDOWN_MAX)
            .map((item) => `${item.name} ${formatNumber(item.failures ?? 0)}`),
          ...(failedPreorders.length > BREAKDOWN_MAX
            ? [`외 ${failedPreorders.length - BREAKDOWN_MAX}곳`]
            : []),
        ]
      : []

  // 대기열 — 고른 사전예약이 있으면 그것만, 없으면 접수 중인 사전예약 합.
  const queueScope = openProducts.filter(
    (product) => selected === null || product.productId === selected,
  )
  const waiting = q
    ? queueScope.reduce((total, product) => total + product.waiting, 0)
    : null
  // 대기 인원 추이 — 관리자 화면을 연 뒤 받은 현황으로 그린다(새로 고치면 처음부터). 그때그때
  // 접수 중이던 사전예약만 더한다(고르면 그것만).
  const queueSamples = useWaitingroomStatusHistory().map(({ at, value }) => ({
    at,
    value: value.products
      .filter(
        (product) =>
          product.phase === 'OPEN' &&
          (selected === null || product.productId === selected),
      )
      .reduce((total, product) => total + product.waiting, 0),
  }))
  const queueSlope = slopePerSecond(queueSamples).at(-1)?.value

  const shipping =
    orders.counts.PREPARING_ITEMS !== null &&
    orders.counts.READY_TO_SHIP !== null
      ? {
          preparing: orders.counts.PREPARING_ITEMS,
          ready: orders.counts.READY_TO_SHIP,
        }
      : null

  // 외부 등록을 기다리는 작업(재처리 필요는 빼고)
  const waitingRegister = t
    ? t.syncJobs.REGISTER.PENDING +
      t.syncJobs.REGISTER.PROCESSING +
      t.syncJobs.REGISTER.RETRY_SCHEDULED
    : 0
  // 등록 작업이 아직 도는 예약만의 시각이라 재처리 필요(실패)가 있어도 밀림을 따로 본다.
  const slowAge =
    t?.oldestInFlightSyncAt &&
    now - Date.parse(t.oldestInFlightSyncAt) > SLOW_AFTER_MS
      ? ageOf(t.oldestInFlightSyncAt, now)
      : null

  // 대기가 긴 사전예약 — 입장이 멈췄는데 줄이 있으면(초당 0) 끝이 없으니 같이 띄운다.
  const longWaits = queueScope.filter(
    (product) =>
      product.waiting > 0 &&
      (product.credit <= 0 ||
        (productWaitSeconds(product) ?? 0) >= LONG_WAIT_SECONDS),
  )

  const reprocessPath = adminReservationsPath(
    'REPROCESS_NEEDED',
    selected ?? undefined,
  )
  // 재처리는 이 화면에서 모달로 한다 — 고른 사전예약이 있으면 그것만, 없으면 전부.
  // 범위와 집계는 실행할 때 고른 상품으로 훅이 고정해 센다.
  const reprocess = useReprocessRun(selected)
  // 재처리 확인 창을 열 때만 실패 원인을 묻는다.
  const causes = useSyncJobErrorGroups(false, {
    status: 'DEAD_LETTER',
    enabled: reprocess.open,
  })
  const reprocessAction = { label: '재처리', onClick: reprocess.show }
  // 모달의 사전예약별 건수 — 마감돼 목록에서 빠진 회차에 남은 실패는 한 줄로 묶는다.
  const breakdownTotal = failedPreorders.reduce(
    (total, item) => total + (item.failures ?? 0),
    0,
  )
  const reprocessBreakdown = scoped
    ? []
    : [
        ...failedPreorders.map((item) => ({
          name: item.name,
          count: item.failures ?? 0,
        })),
        ...(failures !== null && failures > breakdownTotal
          ? [{ name: '마감된 회차', count: failures - breakdownTotal }]
          : []),
      ]

  // 급한 순서대로 쌓는다. 0건인 일은 빼서 이상이 없으면 목록이 비게 한다. 배송 대기는 위
  // 숫자와 주문 카드가 보여 줘 여기엔 두지 않는다.
  const candidates: (Task | false)[] = t
    ? [
        t.syncJobs.REGISTER.DEAD_LETTER > 0 && {
          key: 'register',
          level: 'urgent',
          title: `결제 막힘 · 외부 등록 실패 ${formatNumber(t.syncJobs.REGISTER.DEAD_LETTER)}건`,
          action: reprocessAction,
        },
        t.deadLetters.waiting > 0 && {
          key: 'dead-letters',
          level: 'check',
          // 원인은 메시지 원문을 봐야 알 수 있어 개발팀이 맡는다 — 운영 대시보드는 관리자 화면이라
          // 개발자 기능(이벤트 DLQ)으로 보내지 않는다.
          title: `결제·만료 반영 실패 ${formatNumber(t.deadLetters.waiting)}건`,
        },
        slowAge !== null && {
          key: 'slow',
          level: 'check',
          title: `외부 등록 ${formatNumber(waitingRegister)}건 ${slowAge} 밀림`,
          action: { label: '속도 조절', to: ADMIN_WAITINGROOM_PATH },
        },
        ...longWaits.map((product): Task => ({
          key: `wait-${product.productId}`,
          level: 'check',
          title:
            product.credit <= 0
              ? `${nameOf(product.productId)} 입장 멈춤 · ${formatNumber(product.waiting)}명 대기`
              : `${nameOf(product.productId)} 대기 ${productWaitEstimate(product)}`,
          action: { label: '속도 조절', to: ADMIN_WAITINGROOM_PATH },
        })),
        t.paymentOverdue > 0 && {
          key: 'overdue',
          level: 'todo',
          title: `결제 기한 지난 예약 ${formatNumber(t.paymentOverdue)}건`,
          action: { label: '예약 보기', to: adminReservationsPath('all') },
        },
      ]
    : []
  const tasks = candidates.filter((task) => task !== false)

  // 맨 위 긴급 카드 — 결제를 막는 일. 지금은 외부 등록 실패 하나다.
  const urgentItems: UrgentItem[] =
    t && t.syncJobs.REGISTER.DEAD_LETTER > 0
      ? [
          {
            key: 'register',
            label: '외부 등록 실패',
            count: t.syncJobs.REGISTER.DEAD_LETTER,
            breakdown: failureBreakdown,
            action: { ...reprocessAction, label: '재처리하기' },
          },
        ]
      : []
  // 긴급 띠가 스크롤 영역 위로 사라지면 위에 얇은 한 줄을 띄운다. 띠의 높이를 바꾸지 않고
  // 따로 띄워야 브라우저의 스크롤 위치 보정과 맞물려 깜빡이지 않는다.
  const { ref: urgentRef, past: urgentScrolledPast } =
    useScrolledPast<HTMLDivElement>()

  // 마감 뒤 결과가 나올 시간이 지난 회차만 진행을 받아 본다.
  const stuckCandidates = (draws.data ?? []).filter((draw) => {
    const sinceClose = now - Date.parse(draw.closesAt)
    return sinceClose > 0 && sinceClose < STUCK_LOOKBACK_MS
  })
  const stuckDraws = useStuckDraws(stuckCandidates, now)

  // 대조는 하루 한 번·마감 뒤·요청 때만 돌아 5초 갱신에 넣지 않는다(훅이 1분마다 묻는다).
  const runs = useReconciliationRuns()
  // 처음부터 못 받았으면 '값 없음'과 구분하고, 받은 뒤 실패면 마지막 값이라고 붙인다.
  const summary: ReconcileSummary =
    runs.isError && !runs.data
      ? { value: null, emptyText: '불러오지 못함' }
      : reconcileSummary(runs.data, selected, runs.dataUpdatedAt)
  // 받은 뒤 실패는 백오프하며 다시 묻는 동안 isError가 켜지지 않아 pollingError로 본다.
  const reconcile =
    pollingError(runs) !== null
      ? {
          ...summary,
          caption: summary.caption && `${summary.caption} · 갱신 실패`,
        }
      : summary

  const refresh = () => {
    void runs.refetch()
    void stats.refetch()
    void queue.refetch()
    void statsQuery.refetch()
    void draws.refetch()
    orders.refetch()
    void activeProducts.refetch()
    void pausedProducts.refetch()
  }

  const statsError = pollingError(stats)
  const queueError = pollingError(queue)
  // 느리게 다시 받는 숫자(주문·상품 수, 럭키드로우)도 실패하면 멈춘 값이라고 알린다.
  const slowFailed =
    orders.isError ||
    [activeProducts, pausedProducts, draws].some(
      (query) => pollingError(query) !== null,
    )

  return (
    <div className={styles.root}>
      <header className={styles.topBar}>
        <h1 className={styles.pageTitle}>운영 대시보드</h1>
        <RefreshStatus
          updatedAt={stats.dataUpdatedAt}
          onRefresh={refresh}
          note="5초마다 자동 갱신"
        />
      </header>

      {statsError !== null && (
        <InlineAlert status={s ? 'warning' : 'error'}>
          {getErrorMessage(statsError, '운영 현황을 불러오지 못했어요.')}
          {s && ' 아래 숫자는 마지막으로 받은 값이에요.'}
        </InlineAlert>
      )}
      {scopeError !== null && (
        <InlineAlert status={scopeLoaded ? 'warning' : 'error'}>
          {getErrorMessage(scopeError, '사전예약별 집계를 불러오지 못했어요.')}
          {scopeLoaded && ' 예약 숫자는 마지막으로 받은 값이에요.'}
        </InlineAlert>
      )}
      {slowFailed && (
        <InlineAlert status="warning">
          주문·상품 수나 럭키드로우를 새로 받지 못했어요. 그 숫자는 마지막으로
          받은 값이에요.
        </InlineAlert>
      )}

      {/* 결제를 막는 일은 어디를 보든 먼저 보이게 맨 위에 한 번 더 두고, 띠가 스크롤로
          사라지면 헤더 바로 아래에 얇은 한 줄로 따라온다. */}
      {/* 재처리하는 동안엔 긴급 띠 대신 진행 띠 — 끝나고 실패가 남으면 긴급 띠로 돌아온다. */}
      {reprocess.run && reprocess.running ? (
        <ReprocessBanner
          sent={reprocess.running.sent}
          target={reprocess.run.target}
          remainingSeconds={reprocess.running.remainingSeconds}
          onOpen={reprocess.show}
        />
      ) : (
        urgentItems.length > 0 && (
          <>
            <div ref={urgentRef}>
              <UrgentBanner items={urgentItems} />
            </div>
            <div className={styles.urgentPin}>
              {urgentScrolledPast && (
                <div className={styles.urgentPinned}>
                  <UrgentBanner items={urgentItems} compact />
                </div>
              )}
            </div>
          </>
        )
      )}

      <section className={styles.section} aria-labelledby="ops-open">
        <h2 id="ops-open" className={styles.sectionTitle}>
          진행 중인 사전예약
        </h2>
        {queue.isPending ? (
          <Skeleton height={38} width={320} />
        ) : (
          <OpenPreorderPicker
            items={openPreorders}
            selected={selected}
            onSelect={setPicked}
          />
        )}
        {queueError !== null && (
          <InlineAlert status={q ? 'warning' : 'error'}>
            {getErrorMessage(queueError, '대기열 현황을 불러오지 못했어요.')}
          </InlineAlert>
        )}
      </section>

      <div className={styles.kpis}>
        <OpsKpiCard
          label="대기 인원"
          to={ADMIN_WAITINGROOM_PATH}
          linkLabel="대기열 관리"
          value={waiting}
          unit="명"
          loading={queue.isPending}
        />
        <OpsKpiCard
          label="예약 접수"
          to={adminReservationsPath(undefined, selected ?? undefined)}
          linkLabel="예약 현황"
          value={received}
          unit="건"
          loading={scopePending}
        />
        <OpsKpiCard
          label="외부 등록 실패"
          to={reprocessPath}
          linkLabel={failures ? '재처리하기' : '예약 현황'}
          value={failures}
          unit="건"
          tone={failures ? 'danger' : 'default'}
          loading={stats.isPending}
        />
        <OpsKpiCard
          label="외부 예약 대조"
          to={ADMIN_RECONCILIATION_PATH}
          linkLabel="대조하기"
          value={reconcile.value}
          unit="건"
          emptyText={reconcile.emptyText}
          caption={reconcile.caption}
          loading={runs.isPending}
        />
        <OpsKpiCard
          // 주문은 상품으로 거를 수 없어 고른 사전예약과 상관없이 전체다.
          label={scoped ? '배송 대기 주문 · 전체' : '배송 대기 주문'}
          to={`${ADMIN_ORDERS_PATH}?status=PREPARING_ITEMS`}
          linkLabel="주문 관리"
          value={shipping && shipping.preparing + shipping.ready}
          unit="건"
        />
      </div>

      <div className={styles.mainRow}>
        <QueueCard
          // 고른 사전예약이 바뀌면 그래프를 새로 그린다(선이 다시 그려진다).
          key={selected ?? 'all'}
          waiting={waiting}
          perMinute={queueSlope === undefined ? null : queueSlope * 60}
          history={{
            times: queueSamples.map(({ at }) => at),
            values: queueSamples.map(({ value }) => value),
          }}
          // 브레이크는 대기열 전체에 하나라 고른 사전예약과 상관없이 전체 기준이다.
          braking={isBraking(q?.brakeFactor ?? null)}
          flow={{
            backlog: countOf('PENDING_SYNC'),
            payable: countOf('REGISTERED'),
            reserved: countOf('RESERVED'),
          }}
        />
        <OpenPreorderCard
          items={openPreorders}
          selected={selected}
          onSelect={setPicked}
          loading={queue.isPending}
        />
      </div>

      <div className={styles.bottomRow}>
        <section className={styles.taskPanel} aria-labelledby="ops-todo">
          <div className={styles.panelHeader}>
            <h2 id="ops-todo" className={styles.panelTitle}>
              지금 처리할 일
            </h2>
          </div>
          {stats.isPending ? (
            <SkeletonGroup className={styles.taskSkeleton}>
              {[0, 1].map((row) => (
                <Skeleton key={row} height={52} />
              ))}
            </SkeletonGroup>
          ) : (
            <div>
              {tasks
                .filter((task) => task.level !== 'todo')
                .map(({ key, ...task }) => (
                  <OpsTaskCard key={key} {...task} />
                ))}
              {/* 멈춘 추첨은 '확인' 단계라 실패 뒤, 일상 업무 앞에 둔다. */}
              {stuckDraws.stuck.map((draw) => (
                <StuckDrawTask key={draw.drawId} draw={draw} />
              ))}
              {tasks
                .filter((task) => task.level === 'todo')
                .map(({ key, ...task }) => (
                  <OpsTaskCard key={key} {...task} />
                ))}
              {/* 집계·추첨 진행을 다 받기 전엔 이상 없음이라고 말하지 않는다. */}
              {t &&
                tasks.length === 0 &&
                stuckDraws.stuck.length === 0 &&
                !draws.isPending &&
                !stuckDraws.isPending && (
                  <div className={styles.allClear}>
                    <CircleCheck size={18} aria-hidden="true" />
                    밀린 일이 없어요.
                  </div>
                )}
              {/* 못 받았으면 빈칸으로 두지 않는다 — 비어 있으면 "할 일 없음"으로 읽힌다. */}
              {!t && (
                <div className={styles.allClear}>
                  <TriangleAlert size={18} aria-hidden="true" />
                  현황을 받지 못해 판단할 수 없어요.
                </div>
              )}
            </div>
          )}
        </section>

        <DrawSummaryCard
          draws={draws.data}
          isPending={draws.isPending}
          now={now}
          recentMs={STUCK_LOOKBACK_MS}
        />

        <OrderSummaryCard
          orders={orders.counts}
          products={{
            active: activeProducts.data ?? null,
            paused: pausedProducts.data ?? null,
          }}
        />
      </div>

      <ReprocessModal
        open={reprocess.open}
        onClose={reprocess.close}
        scopeName={selected ? nameOf(selected) : null}
        failures={failures ?? 0}
        breakdown={reprocessBreakdown}
        causes={causes.data}
        causesFailed={causes.isError}
        run={reprocess.run}
        running={reprocess.running}
        result={reprocess.result}
        isPending={reprocess.isPending}
        error={reprocess.error}
        onConfirm={() => reprocess.start(selected)}
        reservationsPath={reprocessPath}
      />
    </div>
  )
}
