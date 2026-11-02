// 밖에서는 TanStack Query 훅으로만 들어온다 — 생 API 함수를 내보내면 signal 취소·
// 4xx 재시도 차단을 건너뛰는 길이 열린다.
export {
  useDeadLetter,
  useDeadLetterCounts,
  useDeadLetterHistory,
  useDeadLetters,
  useNewDeadLetters,
  useDiscardDeadLetter,
  useRedriveDeadLetter,
  useRedriveDeadLetters,
} from './api/useAdminDeadLetters'
export {
  DEAD_LETTER_DISCARD_NOTE_MAX,
  deadLetterEventLabel,
  deadLetterEventTypes,
  deadLetterFailureReasonHint,
  deadLetterFailureReasonLabel,
  deadLetterFailureReasonTag,
  deadLetterFailureReasons,
  deadLetterServiceLabel,
  deadLetterTargetLabel,
  deadLetterServices,
  deadLetterStatusColor,
  deadLetterStatuses,
  deadLetterStatusLabel,
  deadLetterStatusLabels,
  deadLetterTabs,
  isRedrivableReason,
  isRedriveInFlight,
  isRefundRequest,
  toDeadLetterService,
} from './model/types'
export { groupDeadLetters } from './model/group'
export type { DeadLetterGroup } from './model/group'
export type {
  DeadLetter,
  DeadLetterFailureReason,
  DeadLetterRecord,
  DeadLetterService,
  DeadLetterStatus,
  DeadLetterTab,
} from './model/types'
