import type { DeadLetter } from './types'

/**
 * 같은 메시지는 처음 받은 것만 남긴다. 목록은 오프셋(page·size)이라, 다음 쪽을 받기 전에 새 실패가
 * 앞에 쌓이면 그만큼 뒤로 밀려 이미 받은 줄이 다음 쪽에 또 온다.
 */
export const uniqueDeadLetters = (items: readonly DeadLetter[]) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.deadLetterId)) return false
    seen.add(item.deadLetterId)
    return true
  })
}

/**
 * 맨 앞 쪽(head) 중 목록 맨 위보다 새로 쌓인 것. 목록 맨 위가 head에 없으면 한 쪽보다 많이 쌓여
 * 사이가 비었다 — 앞에 붙일 수 없어 gap으로 알린다(처음부터 다시 받는다).
 */
export const newDeadLettersOf = (
  head: readonly DeadLetter[],
  list: readonly DeadLetter[],
) => {
  const top = list[0]
  if (!top || head.length === 0) return { pending: [], gap: false }
  const index = head.findIndex((item) => item.deadLetterId === top.deadLetterId)
  return index === -1
    ? { pending: [...head], gap: true }
    : { pending: head.slice(0, index), gap: false }
}
