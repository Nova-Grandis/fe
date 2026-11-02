import { useEffect, useEffectEvent, useState } from 'react'

import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'

import {
  deadLetterEventLabel,
  deadLetterEventTypes,
  deadLetterFailureReasonLabel,
  deadLetterFailureReasonTag,
  deadLetterFailureReasons,
  deadLetterServiceLabel,
  deadLetterTargetLabel,
  deadLetterServices,
  deadLetterStatusColor,
  deadLetterStatusLabel,
  deadLetterStatusLabels,
  deadLetterTabs,
  groupDeadLetters,
  toDeadLetterService,
  useDeadLetterCounts,
  useDeadLetterHistory,
  useDeadLetters,
  useNewDeadLetters,
  useRedriveDeadLetters,
  type DeadLetter,
  type DeadLetterFailureReason,
  type DeadLetterService,
  type DeadLetterStatus,
  type DeadLetterTab,
} from '@entities/admin-dead-letter'
import { orderNo } from '@entities/admin-order'
import { reservationNo } from '@entities/admin-reservation'
import { getErrorMessage } from '@shared/api/client'
import { pollingError } from '@shared/api/queryPolicy'
import {
  DEFAULT_REFRESH_INTERVAL,
  refreshIntervalOptions,
  type RefreshInterval,
} from '@shared/config/refreshInterval'
import {
  adminDeadLetterPath,
  adminOrderPath,
  adminReservationPath,
  type BackTo,
} from '@shared/config/routes'
import { formatDistance } from '@shared/lib/formatDistance'
import { formatDotDateTime } from '@shared/lib/formatDotDate'
import { formatNumber } from '@shared/lib/formatNumber'
import { periodRange, toPeriodOptions, type Period } from '@shared/lib/period'
import { toggleInSet } from '@shared/lib/toggleInSet'
import { useEndReached } from '@shared/lib/useEndReached'
import { useNow } from '@shared/lib/useNow'
import { useScrolledPast } from '@shared/lib/useScrolledPast'
import { closeModal, openModal } from '@shared/model/modalStore'
import {
  Button,
  Checkbox,
  Dropdown,
  InlineAlert,
  PageHeader,
  Panel,
  RefreshStatus,
  SegmentedTabs,
  Table,
  Tag,
} from '@shared/ui'
import type { DropdownOption, PageHeaderProps, TableColumn } from '@shared/ui'

import { useScrollMemory } from '../../lib/useScrollMemory'
import { DeadLetterGroups } from '../DeadLetterGroups'

import * as styles from './AdminDeadLetterList.css'

// 기록 탭(처리됨·다시 실패·버림·전체)은 끝까지 내리면 다음 쪽을 이어 받는다(useDeadLetterHistory).
// 손댈 것만 모은 탭은 상태마다 끝까지 받는다 — 한 쪽만 보면 오래 멈춘 메시지가 빠지고 원인별
// 묶음 수·묶음째 되돌리기가 일부만 된다.
const COMPLETE_TABS: readonly DeadLetterTab[] = ['open', 'waiting']

// 상세에 갔다 돌아와도 같은 조건이 보이게 주소에 둔다.
const PARAM = {
  service: 'service',
  tab: 'tab',
  eventType: 'event',
  failureReason: 'reason',
  period: 'period',
} as const

// 쌓인 기간 — 하루 단위라 같은 날 안에서는 조회 키가 흔들리지 않는다.
const periods: Period[] = ['all', 'today', 'yesterday', 'week', 'month']
const periodOptions = toPeriodOptions(periods)

const ALL = 'all'

// 처음 열면 손댈 것(처리 대기)부터 보인다.
const DEFAULT_TAB: DeadLetterTab = 'open'

// '멈춘 지'는 분 단위라 1분마다 다시 그리면 충분하다.
const NOW_INTERVAL_MS = 60_000

// 서비스마다 받는 이벤트가 다르다.
const eventOptionsOf = (
  service: DeadLetterService,
): DropdownOption<string>[] => [
  { label: '반영 안 된 처리: 전체', value: ALL },
  ...deadLetterEventTypes[service].map((eventType) => ({
    label: deadLetterEventLabel(eventType),
    value: eventType,
  })),
]

const serviceOptions: DropdownOption<DeadLetterService>[] =
  deadLetterServices.map((service) => ({
    label: `${deadLetterServiceLabel[service]} 서비스`,
    value: service,
  }))

const reasonOptions: DropdownOption<DeadLetterFailureReason | typeof ALL>[] = [
  { label: '실패 이유: 전체', value: ALL },
  ...deadLetterFailureReasons.map((reason) => ({
    label: deadLetterFailureReasonLabel[reason],
    value: reason,
  })),
]

type Feedback = { status: 'success' | 'error'; message: string }

/**
 * 이벤트 DLQ 목록(개발자용). 처리 대기 탭은 같은 원인끼리 묶어 무엇이 멈췄는지 먼저
 * 보여주고, 묶음째 또는 고른 것만 원래 큐로 되돌린다. 버리기는 원문을 보고 판단해야 해서
 * 상세에서만 한다.
 */
export type AdminDeadLetterListProps = {
  /** 페이지 제목 — 마지막 갱신과 같은 줄에 그린다 */
  header: Omit<PageHeaderProps, 'aside'>
}

export function AdminDeadLetterList({ header }: AdminDeadLetterListProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  // 주소 값은 누구나 바꿔 넣을 수 있어 아는 값일 때만 쓰고, 아니면 기본값으로 둔다.
  // 예약 DLQ가 기본이라 ?service=가 없는 옛 주소도 그대로 열린다.
  const service = toDeadLetterService(searchParams.get(PARAM.service))
  const tab =
    deadLetterTabs.find((item) => item.value === searchParams.get(PARAM.tab)) ??
    deadLetterTabs.find((item) => item.value === DEFAULT_TAB)!
  // 서버가 모르는 종류도 거를 수 있어 이벤트만은 그대로 받는다.
  const eventType = searchParams.get(PARAM.eventType) ?? ALL
  const failureReason =
    deadLetterFailureReasons.find(
      (reason) => reason === searchParams.get(PARAM.failureReason),
    ) ?? ALL
  const period =
    periods.find((item) => item === searchParams.get(PARAM.period)) ?? 'all'
  const setParam = (key: string, value: string, fallback: string) =>
    setSearchParams(
      (prev) => {
        if (value === fallback) prev.delete(key)
        else prev.set(key, value)
        return prev
      },
      { replace: true },
    )

  const now = useNow(NOW_INTERVAL_MS).getTime()
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(
    DEFAULT_REFRESH_INTERVAL,
  )
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [feedback, setFeedback] = useState<Feedback>()

  const filters = {
    eventType: eventType === ALL ? undefined : eventType,
    failureReason: failureReason === ALL ? undefined : failureReason,
    ...periodRange(period, now),
  }
  const complete = COMPLETE_TABS.includes(tab.value)
  const statuses: readonly DeadLetterStatus[] = tab.statuses
  // 탭에 맞는 하나만 돈다 — 손댈 탭은 끝까지 한 번에, 기록 탭은 내리는 만큼.
  const completeList = useDeadLetters(
    service,
    { ...filters, statuses },
    refreshInterval,
    complete,
  )
  const historyParams = { ...filters, status: statuses[0] }
  const history = useDeadLetterHistory(service, historyParams, !complete)
  const deadLetters = complete ? completeList : history
  // 기록 탭은 펼친 쪽을 다시 받지 않고, 맨 앞 쪽만 물어 새 실패를 알아챈다.
  const fresh = useNewDeadLetters(
    service,
    historyParams,
    refreshInterval,
    !complete,
    history.data?.items ?? [],
  )
  // 마지막 갱신·새로 고침·갱신 실패 안내는 손댈 탭은 목록, 기록 탭은 새 실패 확인을 따른다.
  const live = complete ? completeList : fresh
  const endRef = useEndReached<HTMLDivElement>(
    // 다음 쪽이 실패하면 멈춘다 — 끝이 보이는 채라 켜 두면 실패하자마자 또 보낸다.
    !complete &&
      history.hasNextPage &&
      !history.isFetchingNextPage &&
      !history.isFetchNextPageError,
    () => void history.fetchNextPage(),
  )

  // 표 맨 위를 지나 내려가 읽는 중이면 새 실패를 끼우지 않고 알리기만 한다 — 끼우면 보던 줄이
  // 밀린다. 맨 위를 보고 있으면 바로 붙인다.
  const { ref: tableTopRef, past: readingBelow } =
    useScrolledPast<HTMLDivElement>()
  const newCount = fresh.pending.length
  const applyNew = useEffectEvent(() => fresh.apply())
  useEffect(() => {
    if (complete || readingBelow || history.isFetchingNextPage) return
    if (newCount > 0 || fresh.gap) applyNew()
  }, [complete, readingBelow, newCount, fresh.gap, history.isFetchingNextPage])

  const { ref: listRef, remember: rememberScroll } =
    useScrollMemory<HTMLDivElement>(
      location.pathname + location.search,
      !complete && history.data !== undefined,
    )
  // 탭 숫자도 같은 이벤트·실패 이유로 센다 — 거른 목록 옆에 거르기 전 숫자가 붙지 않게.
  const counts = useDeadLetterCounts(service, filters, refreshInterval)
  const redrive = useRedriveDeadLetters(service)

  // 서비스를 바꾸면 이벤트 종류가 달라져 그 조건과 고른 것을 비운다.
  // 보내는 중이던 되돌리기도 잊는다 — 늦게 온 결과 안내가 다른 서비스 화면에 뜨지 않게.
  const selectService = (next: DeadLetterService) => {
    setSelected(new Set())
    setFeedback(undefined)
    redrive.reset()
    setSearchParams(
      (prev) => {
        prev.delete(PARAM.eventType)
        if (next === 'preorder') prev.delete(PARAM.service)
        else prev.set(PARAM.service, next)
        return prev
      },
      { replace: true },
    )
  }

  // 처리 대기는 오래 멈춘 것부터, 나머지는 서버 순서(최신순) 그대로.
  const items =
    tab.value === 'open'
      ? deadLetters.data?.items.toSorted((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        )
      : deadLetters.data?.items
  // 손댈 탭이 상한(상태마다 1,000건)에 걸려 일부만 받은 것. 기록 탭은 내리면 더 받으니 해당 없다.
  const partial =
    complete &&
    completeList.data !== undefined &&
    completeList.data.total > completeList.data.items.length
  const groups = tab.value === 'open' ? groupDeadLetters(items ?? []) : []
  const redrivable = (items ?? []).filter((item) => item.redrivable)
  const selectedIds = redrivable
    .filter((item) => selected.has(item.deadLetterId))
    .map((item) => item.deadLetterId)
  const allSelected =
    redrivable.length > 0 &&
    redrivable.every((item) => selected.has(item.deadLetterId))

  const toggle = (ids: string[], checked: boolean) =>
    setSelected((prev) => toggleInSet(prev, ids, checked))

  const countOf = (statusesOfTab: readonly string[]) => {
    const values = (
      statusesOfTab.length > 0 ? statusesOfTab : Object.keys(counts)
    ).map((status) => counts[status as keyof typeof counts])
    return values.some((value) => value === undefined)
      ? undefined
      : values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  }

  const confirmRedrive = (ids: string[]) => {
    openModal({
      theme: 'light',
      title: `${ids.length}건을 되돌릴까요?`,
      description:
        '고른 메시지를 원래 큐로 다시 보냅니다. 원인을 고친 뒤에 보내야 다시 실패하지 않습니다. 초당 20건씩 천천히 보냅니다.',
      confirmLabel: '되돌리기',
      onConfirm: () => {
        closeModal()
        setFeedback(undefined)
        redrive.mutate(ids, {
          onSuccess: ({ targetCount, skippedCount, estimatedSeconds }) => {
            setSelected(new Set())
            setFeedback({
              status: 'success',
              message: [
                `${targetCount}건을 되돌리는 중입니다(약 ${estimatedSeconds}초). 결과 기다림 탭에서 이어서 볼 수 있습니다.`,
                skippedCount > 0 &&
                  `${skippedCount}건은 대기 상태가 아니거나 되돌릴 수 없어 건너뛰었습니다.`,
              ]
                .filter(Boolean)
                .join(' '),
            })
          },
          onError: (caught) =>
            setFeedback({
              status: 'error',
              message: getErrorMessage(caught, '되돌리지 못했습니다.'),
            }),
        })
      },
    })
  }

  // 상세의 '돌아가기'가 지금 고른 조건 그대로의 목록을 가리키게 한다.
  const backTo: BackTo = {
    label: '이벤트 DLQ',
    to: location.pathname + location.search,
  }
  const openDetail = (item: DeadLetter) =>
    navigate(adminDeadLetterPath(item.deadLetterId, service), {
      state: { backTo },
    })

  const columns: TableColumn<DeadLetter>[] = [
    {
      key: 'select',
      header: (
        <Checkbox
          aria-label="되돌릴 수 있는 메시지 모두 선택"
          checked={allSelected}
          disabled={redrivable.length === 0 || redrive.isPending}
          onChange={(event) =>
            toggle(
              redrivable.map((item) => item.deadLetterId),
              event.target.checked,
            )
          }
        />
      ),
      align: 'center',
      width: '56px',
      render: (item) =>
        item.redrivable ? (
          <Checkbox
            aria-label={`${deadLetterEventLabel(item.eventType)} 선택`}
            checked={selected.has(item.deadLetterId)}
            disabled={redrive.isPending}
            // 행 전체가 상세로 가는 버튼이라, 고르기만 하고 머문다.
            onClick={(event) => event.stopPropagation()}
            onChange={(event) =>
              toggle([item.deadLetterId], event.target.checked)
            }
          />
        ) : (
          <span
            className={styles.subText}
            title="원문을 읽을 수 없어 되돌릴 수 없어요"
          >
            —
          </span>
        ),
    },
    {
      key: 'event',
      header: '반영 안 된 처리',
      render: (item) => (
        <span className={styles.stacked}>
          <span className={styles.strong}>
            {item.eventType === null
              ? '알 수 없음'
              : deadLetterEventLabel(item.eventType)}
          </span>
          <span className={styles.code}>
            {item.eventType ?? `원문을 읽지 못함 · ${item.messageId}`}
          </span>
        </span>
      ),
    },
    {
      key: 'reason',
      header: '실패 이유',
      render: (item) => (
        <span className={styles.inline}>
          <Tag size="small" {...deadLetterFailureReasonTag[item.failureReason]}>
            {deadLetterFailureReasonLabel[item.failureReason]}
          </Tag>
          {item.redrivenFromId && (
            <Link
              className={styles.subLink}
              to={adminDeadLetterPath(item.redrivenFromId, service)}
              state={{ backTo }}
              onClick={(event) => event.stopPropagation()}
            >
              이전 실패
            </Link>
          )}
        </span>
      ),
    },
    // 예약 DLQ는 예약, 결제 DLQ는 주문으로 간다.
    {
      key: 'related',
      header: `관련 ${deadLetterTargetLabel[service]}`,
      render: (item) =>
        item.orderId ? (
          <Link
            className={styles.link}
            to={adminOrderPath(item.orderId)}
            state={{ backTo }}
            onClick={(event) => event.stopPropagation()}
          >
            {orderNo(item.orderId)}
          </Link>
        ) : item.preorderId ? (
          <Link
            className={styles.link}
            to={adminReservationPath(item.preorderId)}
            state={{ backTo }}
            onClick={(event) => event.stopPropagation()}
          >
            {reservationNo(item.preorderId)}
          </Link>
        ) : (
          <span className={styles.subText}>
            {deadLetterTargetLabel[service]}과 무관
          </span>
        ),
    },
    {
      key: 'receive',
      header: '받은 횟수',
      align: 'right',
      render: (item) => `${item.receiveCount}회`,
    },
    {
      key: 'at',
      header: '멈춘 지',
      render: (item) => (
        <span className={styles.stacked}>
          {formatDistance(now - Date.parse(item.createdAt))} 전
          <span className={styles.subText}>
            {formatDotDateTime(item.createdAt)}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      render: (item) => (
        <Tag
          variant="subtle"
          size="medium"
          rounded={false}
          color={deadLetterStatusColor[item.status]}
          widthOptions={deadLetterStatusLabels}
        >
          {deadLetterStatusLabel[item.status]}
        </Tag>
      ),
    },
  ]

  return (
    <div className={styles.root}>
      {/* 다른 관리자 화면처럼 제목 줄 오른쪽에 마지막 갱신을 둔다. 갱신은 이 위젯의 조회라
          제목을 받아 같은 줄에 그린다. */}
      <PageHeader
        {...header}
        aside={
          <RefreshStatus
            updatedAt={live.dataUpdatedAt}
            onRefresh={() => void live.refetch()}
          >
            <Dropdown
              label="자동 갱신 간격"
              size="small"
              width="140px"
              options={refreshIntervalOptions}
              value={refreshInterval}
              // 고르는 즉시 한 번 받는다 — 새 간격을 기다리지 않고 지금 값을 보여준다.
              onSelect={(next) => {
                setRefreshInterval(next)
                void live.refetch()
              }}
            />
          </RefreshStatus>
        }
      />

      {/* 서비스마다 DLQ가 따로라 탭 건수·목록이 모두 이 선택을 따른다. */}
      <div className={styles.controls}>
        <SegmentedTabs
          items={deadLetterTabs.map((item) => {
            const count = countOf(item.statuses)
            return {
              value: item.value,
              label: (
                <span className={styles.tabLabel}>
                  {item.label}
                  {count !== undefined && (
                    <span
                      className={
                        item.value === 'open' && count > 0
                          ? styles.tabCountHot
                          : styles.tabCount
                      }
                    >
                      {formatNumber(count)}
                    </span>
                  )}
                </span>
              ),
            }
          })}
          value={tab.value}
          onChange={(next) => {
            setSelected(new Set())
            setParam(PARAM.tab, next, DEFAULT_TAB)
          }}
        />
        <Dropdown
          label="서비스"
          fieldLabel="서비스"
          width="160px"
          options={serviceOptions}
          value={service}
          onSelect={selectService}
        />
      </div>

      {/* 다시 받기가 실패해도 이전 목록은 남는다 — 멈춘 목록을 최신으로 읽지 않게 알린다. */}
      {pollingError(live) !== null && (
        <InlineAlert status={items ? 'warning' : 'error'}>
          {getErrorMessage(pollingError(live), '메시지를 불러오지 못했습니다.')}
          {items && ' 아래 목록은 마지막으로 받은 값입니다.'}
        </InlineAlert>
      )}
      {feedback && (
        <InlineAlert status={feedback.status}>{feedback.message}</InlineAlert>
      )}
      {partial && completeList.data && (
        <InlineAlert status="warning">
          {formatNumber(completeList.data.total)}건 중{' '}
          {formatNumber(completeList.data.items.length)}건만 받았어요. 원인별
          묶음·되돌리기도 받은 것만 셉니다.
        </InlineAlert>
      )}

      {groups.length > 0 && (
        <Panel
          title={
            <>
              무엇이 멈췄나
              <span className={styles.titleNote}>
                처리 대기 {formatNumber(items?.length ?? 0)}건을 같은 원인끼리
                묶었어요
              </span>
            </>
          }
          aside="원인을 고친 뒤 묶음째 되돌리면 한 건씩 고르지 않아도 돼요"
        >
          <DeadLetterGroups
            groups={groups}
            now={now}
            busy={redrive.isPending}
            onRedrive={confirmRedrive}
            onOpen={openDetail}
          />
        </Panel>
      )}

      <Panel
        title={
          <>
            메시지{items && ` ${formatNumber(items.length)}건`}
            <span className={styles.titleNote}>
              {tab.value === 'open' ? '오래 멈춘 것부터' : '최근에 쌓인 것부터'}
            </span>
          </>
        }
        aside={
          <>
            <Dropdown
              label="반영 안 된 처리"
              size="small"
              width="220px"
              options={eventOptionsOf(service)}
              value={eventType}
              onSelect={(next) => setParam(PARAM.eventType, next, ALL)}
            />
            <Dropdown
              label="실패 이유"
              size="small"
              width="180px"
              options={reasonOptions}
              value={failureReason}
              onSelect={(next) => setParam(PARAM.failureReason, next, ALL)}
            />
            <Dropdown
              label="쌓인 기간"
              size="small"
              width="140px"
              options={periodOptions}
              value={period}
              onSelect={(next) => setParam(PARAM.period, next, 'all')}
            />
          </>
        }
      >
        {selectedIds.length > 0 && (
          <div className={styles.selectionBar} role="status">
            <span className={styles.strong}>{selectedIds.length}건 선택</span>
            <span>· 원문을 읽을 수 없는 메시지는 고를 수 없어요</span>
            <div className={styles.selectionActions}>
              <Button
                size="small"
                disabled={redrive.isPending}
                onClick={() => confirmRedrive(selectedIds)}
              >
                {redrive.isPending
                  ? '되돌리는 중…'
                  : `선택 되돌리기 ${selectedIds.length}건`}
              </Button>
              <Button
                size="small"
                variant="outline"
                onClick={() => setSelected(new Set())}
              >
                선택 해제
              </Button>
            </div>
          </div>
        )}

        {/* 표 안을 누를 때(상세·관련 예약으로 갈 때) 스크롤 위치를 적어 둔다. 표식·알림은 표
            밖에 둔다 — 표 칸은 가로 스크롤이라 그 안에선 본문 대신 표 칸을 스크롤 영역으로 잡는다. */}
        <div
          ref={listRef}
          className={styles.list}
          onClickCapture={complete ? undefined : rememberScroll}
        >
          <div ref={tableTopRef} />
          {!complete && readingBelow && (newCount > 0 || fresh.gap) && (
            <div className={styles.newDock}>
              <Button
                size="small"
                className={styles.newButton}
                onClick={() =>
                  listRef.current?.scrollIntoView({ block: 'start' })
                }
              >
                새 실패{' '}
                {fresh.gap ? '100건 넘게' : `${formatNumber(newCount)}건`} · 맨
                위로
              </Button>
            </div>
          )}
          <Table
            columns={columns}
            rows={items ?? []}
            rowKey={(item) => item.deadLetterId}
            // 기록 탭은 쪽을 나누지 않고 내리는 만큼 이어 붙인다.
            pageSize={complete ? 10 : undefined}
            onRowClick={openDetail}
            loading={deadLetters.isPending}
            emptyMessage={
              deadLetters.isError
                ? '메시지를 불러오지 못했습니다.'
                : tab.value === 'open'
                  ? '멈춘 메시지가 없어요. 평소엔 이게 정상이에요.'
                  : '조건에 맞는 메시지가 없습니다.'
            }
          />
          {/* 표 끝이 보이면 다음 쪽을 받는다. */}
          {!complete && history.hasNextPage && (
            <div ref={endRef} className={styles.listEnd} role="status">
              {history.isFetchNextPageError ? (
                <>
                  이전 메시지를 불러오지 못했어요.{' '}
                  <Button
                    size="small"
                    variant="outline"
                    onClick={() => void history.fetchNextPage()}
                  >
                    다시 불러오기
                  </Button>
                </>
              ) : history.isFetchingNextPage ? (
                '이전 메시지를 더 불러오는 중…'
              ) : (
                `전체 ${formatNumber(history.data?.total ?? 0)}건 중 ${formatNumber(items?.length ?? 0)}건 · 내리면 더 불러와요`
              )}
            </div>
          )}
        </div>
      </Panel>

      <div className={styles.subText}>
        받은 횟수 = DLQ로 오기 전까지 서버가 처리하려고 받은 횟수.
      </div>
    </div>
  )
}
