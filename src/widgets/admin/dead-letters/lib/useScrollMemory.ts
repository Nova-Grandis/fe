import { useLayoutEffect, useRef } from 'react'

import { scrollParentOf } from '@shared/lib/useScrolledPast'

// 목록 조건(주소)마다 떠날 때의 스크롤 위치. 돌아와 한 번 쓰면 지운다 — 새로 고치면 사라진다.
const positions = new Map<string, number>()

/**
 * 상세에 갔다 돌아오면 보던 자리로. 목록 안을 누를 때(remember) 스크롤 칸의 위치를 적어 두고,
 * 같은 조건으로 다시 열려 줄이 그려지면(ready) 되돌린다. 받은 쪽은 캐시에 남아 줄 수가 같다.
 * 관리자 화면은 창이 아니라 본문 칸이 스크롤돼 라우터의 스크롤 복원이 닿지 않는다.
 */
export function useScrollMemory<T extends HTMLElement>(
  key: string,
  ready: boolean,
) {
  const ref = useRef<T>(null)

  const remember = () => {
    const scroller = ref.current && scrollParentOf(ref.current)
    if (scroller) positions.set(key, scroller.scrollTop)
  }

  // 그리기 전에 옮겨야 맨 위가 한 번 보였다가 튀지 않는다.
  useLayoutEffect(() => {
    const top = positions.get(key)
    const scroller = ref.current && scrollParentOf(ref.current)
    if (!ready || top === undefined || !scroller) return
    positions.delete(key)
    scroller.scrollTop = top
  }, [key, ready])

  return { ref, remember }
}
