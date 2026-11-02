import { useEffect, useState } from 'react'

/** 세로로 스크롤되는 가장 가까운 조상 — 관리자 화면은 본문 영역이 스크롤된다. 없으면 null(창) */
export function scrollParentOf(element: HTMLElement) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return null
}

/**
 * 표식(ref를 단 요소)이 스크롤 영역 위로 다 지나갔는지. 아래쪽으로 벗어난 것은 지나간 게
 * 아니라 false다. 표식이 나중에 생기거나 바뀌어도 다시 관찰하도록 콜백 ref를 돌려준다.
 */
export function useScrolledPast<T extends HTMLElement>() {
  const [marker, setMarker] = useState<T | null>(null)
  const [past, setPast] = useState(false)

  useEffect(() => {
    if (!marker) return
    const observer = new IntersectionObserver(
      ([entry]) =>
        setPast(
          !entry.isIntersecting &&
            entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0),
        ),
      { root: scrollParentOf(marker) },
    )
    observer.observe(marker)
    return () => observer.disconnect()
  }, [marker])

  // 표식이 없어졌으면(긴급 카드가 사라짐) 지난 값을 버린다.
  return { ref: setMarker, past: marker !== null && past }
}
