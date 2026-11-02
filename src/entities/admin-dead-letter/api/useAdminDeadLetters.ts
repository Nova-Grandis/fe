import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { PAGE_SIZE_MAX } from '@shared/api/fetchAllPages'
import { pollEvery, pollingRetry, queryPolicy } from '@shared/api/queryPolicy'
import type {
  DeadLetterDetail,
  DeadLetterListParams,
  DeadLetterStatus,
} from '@shared/api/types'
import type { RefreshInterval } from '@shared/config/refreshInterval'
import { useDeadline } from '@shared/lib/useDeadline'

import {
  deadLetterStatuses,
  isRedriveInFlight,
  type DeadLetterService,
} from '../model/types'

import {
  discardDeadLetter,
  getDeadLetter,
  getDeadLetters,
  getDeadLettersOf,
  redriveDeadLetter,
  redriveDeadLetters,
} from './adminDeadLetter'

const DEAD_LETTERS_KEY = ['admin', 'dead-letters'] as const
// 메시지가 바뀌면 그 서비스의 화면도 같이 바뀐다 — 예약은 집계(DLQ 대기 수)·예약 상세, 결제는
// 주문(환불 상태).
const RELATED_KEY: Record<DeadLetterService, readonly string[]> = {
  preorder: ['admin', 'reservations'],
  payment: ['admin', 'orders'],
}
// 되돌리기 결과를 기다리는 동안만 쓰는 짧은 간격.
const IN_FLIGHT_POLL_MS = 3_000
// 보내기 시작(REDRIVING)·보낸 뒤(REDRIVEN)부터 이만큼 지나도 그대로면 짧은 간격으로 묻기를
// 멈춘다 — 서버는 1분 넘게 멈춘 보내기를 다시 되돌릴 수 있게 열고, 결과는 보통 1분 안에 온다.
const IN_FLIGHT_LIMIT_MS = 2 * 60_000

/** 되돌리기를 기다리기 시작한 때 — 보내는 중이면 보내기 시작, 보냈으면 보낸 시각(ms) */
const inFlightSince = (detail: DeadLetterDetail) => {
  const at =
    detail.status === 'REDRIVING' ? detail.redriveStartedAt : detail.redrivenAt
  return at ? Date.parse(at) : undefined
}

/** 목록 조건. statuses를 주면 그 상태들을 끝까지 받아 합치고(손댈 것만 모은 탭), 아니면 한 쪽만 */
export type DeadLetterQuery = DeadLetterListParams & {
  statuses?: readonly DeadLetterStatus[]
}

/**
 * 메시지 목록. intervalMs를 주면 그 간격으로, 안 주면 되돌리기 결과를 기다리는 행이 있을
 * 때만 다시 받는다.
 */
export const useDeadLetters = (
  service: DeadLetterService,
  params: DeadLetterQuery = {},
  intervalMs?: RefreshInterval,
  enabled = true,
) => {
  const queryClient = useQueryClient()
  const queryKey = [...DEAD_LETTERS_KEY, service, 'list', params] as const
  // 보여 줄 목록이 아직 없으면 폴링 중이 아니다(첫 조회는 한 번만 다시 묻는다).
  const pollMs = (
    data: Awaited<ReturnType<typeof getDeadLetters>> | undefined,
  ) => {
    if (!data) return null
    if (intervalMs !== undefined)
      return intervalMs === false ? null : intervalMs
    return data.items.some((item) => isRedriveInFlight(item.status))
      ? IN_FLIGHT_POLL_MS
      : null
  }
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      const { statuses, ...listParams } = params
      return statuses
        ? getDeadLettersOf(service, statuses, listParams, signal)
        : getDeadLetters(service, listParams, signal)
    },
    enabled,
    ...queryPolicy.live,
    refetchInterval: ({ state: { data } }) => pollMs(data) ?? false,
    ...pollingRetry(() => pollMs(queryClient.getQueryData(queryKey))),
  })
}

/**
 * 기록 탭(처리됨·다시 실패·버림·전체) 목록 — 최신순으로 한 쪽(100건)씩, 끝까지 내리면 다음 쪽을
 * 이어 받는다. 장애 때 실패가 시작된 시각까지 거슬러 읽어야 해서 최근 몇 건으로 자르지 않는다.
 */
// shortcut: 자동 갱신 때 받은 쪽을 모두 다시 받고, 받는 사이 새 실패가 앞에 쌓여 밀린 줄을 거르지 않는다 — 측정 후 고친다.
export const useDeadLetterHistory = (
  service: DeadLetterService,
  params: Omit<DeadLetterListParams, 'page' | 'size'>,
  intervalMs: RefreshInterval,
  enabled: boolean,
) => {
  const queryClient = useQueryClient()
  const queryKey = [...DEAD_LETTERS_KEY, service, 'history', params] as const
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      getDeadLetters(
        service,
        { ...params, page: pageParam, size: PAGE_SIZE_MAX },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: ({ page, size, total }) =>
      (page + 1) * size < total ? page + 1 : undefined,
    // 화면은 쪽 구분 없이 한 목록으로 본다. 전체 건수는 가장 최근에 받은 첫 쪽의 값이다.
    select: ({ pages }) => ({
      items: pages.flatMap((page) => page.items),
      total: pages[0]?.total ?? 0,
    }),
    enabled,
    ...queryPolicy.live,
    ...pollEvery(queryClient, queryKey, intervalMs),
  })
}

/**
 * 상태마다 몇 건인지 — 탭 옆 숫자. 목록 API가 상태 하나씩만 걸러서 상태마다 한 건만
 * 달라고 해 total을 쓴다. 목록과 같은 조건(이벤트·실패 이유)으로 세야 숫자가 보이는 목록과
 * 맞는다. 못 받은 상태는 undefined라 화면이 0과 구분한다.
 */
export const useDeadLetterCounts = (
  service: DeadLetterService,
  filters: Pick<
    DeadLetterListParams,
    'eventType' | 'failureReason' | 'from' | 'to'
  >,
  intervalMs?: RefreshInterval,
) => {
  const queryClient = useQueryClient()
  return useQueries({
    queries: deadLetterStatuses.map((status) => {
      const queryKey = [
        ...DEAD_LETTERS_KEY,
        service,
        'count',
        status,
        filters,
      ] as const
      return {
        queryKey,
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          getDeadLetters(service, { ...filters, status, size: 1 }, signal),
        ...queryPolicy.live,
        ...pollEvery(queryClient, queryKey, intervalMs ?? false),
      }
    }),
    combine: (results) =>
      Object.fromEntries(
        deadLetterStatuses.map((status, index) => [
          status,
          results[index].data?.total,
        ]),
      ) as Record<DeadLetterStatus, number | undefined>,
  })
}

/**
 * 메시지 상세. 되돌리기 결과를 기다리는 동안만 다시 받고 실패하면 백오프한다. 기다린 지 2분이
 * 지나면 멈추고 stalled로 알린다 — 보내기가 멈췄거나 받는 쪽이 늦은 것이다.
 */
export const useDeadLetter = (
  service: DeadLetterService,
  deadLetterId: string,
) => {
  const queryClient = useQueryClient()
  const queryKey = [
    ...DEAD_LETTERS_KEY,
    service,
    'detail',
    deadLetterId,
  ] as const
  const cached = queryClient.getQueryData<DeadLetterDetail>(queryKey)
  const inFlight = cached !== undefined && isRedriveInFlight(cached.status)
  const deadline = useDeadline(
    inFlight,
    IN_FLIGHT_LIMIT_MS,
    inFlight ? inFlightSince(cached) : undefined,
  )
  const pollMs = (data: DeadLetterDetail | undefined) =>
    data && isRedriveInFlight(data.status) && !deadline.passed
      ? IN_FLIGHT_POLL_MS
      : null
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getDeadLetter(service, deadLetterId, signal),
    ...queryPolicy.live,
    refetchInterval: ({ state: { data } }) => pollMs(data) ?? false,
    ...pollingRetry(() => pollMs(queryClient.getQueryData(queryKey)), {
      expired: () => deadline.passed,
    }),
  })
  // 2분 넘게 그대로라 저절로 묻기를 멈췄다 — 손으로 새로 고치면(refetch) 그대로 받는다.
  return { ...query, stalled: deadline.passed }
}

// 메시지 상태와 그 서비스의 화면이 같이 바뀌므로 둘 다 다시 받는다(다른 서비스 DLQ는 그대로).
// 실패해도 다시 받는다(onSettled) — 서버가 메시지를 집어 보내는 중(REDRIVING)으로 바꾼 뒤
// 오류(503 등)를 줄 수 있어, 옛 OPEN 상태로 두면 결과를 모르는 채 되돌리기 버튼이 다시 열린다.
const useInvalidateAfterChange = (service: DeadLetterService) => {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...DEAD_LETTERS_KEY, service],
      }),
      queryClient.invalidateQueries({ queryKey: RELATED_KEY[service] }),
    ])
}

export const useRedriveDeadLetter = (service: DeadLetterService) => {
  const invalidate = useInvalidateAfterChange(service)
  return useMutation({
    mutationFn: (deadLetterId: string) =>
      redriveDeadLetter(service, deadLetterId),
    onSettled: invalidate,
  })
}

export const useRedriveDeadLetters = (service: DeadLetterService) => {
  const invalidate = useInvalidateAfterChange(service)
  return useMutation({
    mutationFn: (deadLetterIds: string[]) =>
      redriveDeadLetters(service, deadLetterIds),
    onSettled: invalidate,
  })
}

export const useDiscardDeadLetter = (service: DeadLetterService) => {
  const invalidate = useInvalidateAfterChange(service)
  return useMutation({
    mutationFn: ({
      deadLetterId,
      note,
    }: {
      deadLetterId: string
      note: string
    }) => discardDeadLetter(service, deadLetterId, { note }),
    onSettled: invalidate,
  })
}
