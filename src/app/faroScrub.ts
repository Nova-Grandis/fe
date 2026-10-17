import { TransportItemType, type TransportItem } from '@grafana/faro-react'

// 결제 콜백(?paymentKey=…&amount=…), 카카오 콜백(?code=…), 관리자 회원 검색(?q=…)의 쿼리가
// 페이지 URL·이벤트·오류 메시지에 그대로 실리므로 브라우저를 떠나기 전에 쿼리·해시를 뗀다.
const stripQuery = (value: string) => value.replace(/[?#][^\s"']*/g, '')
const looksLikeUrl = (value: string) =>
  /^(https?:)?\/\//.test(value) || value.startsWith('/')

function scrubRecord(record?: Record<string, unknown>) {
  if (!record) return
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string' && looksLikeUrl(value)) {
      record[key] = stripQuery(value)
    }
  }
}

export function beforeSend(item: TransportItem): TransportItem | null {
  if (item.meta.page?.url) item.meta.page.url = stripQuery(item.meta.page.url)

  const payload = item.payload as {
    value?: string
    message?: string
    attributes?: Record<string, unknown>
    context?: Record<string, unknown>
  }
  if (item.type === TransportItemType.EXCEPTION && payload.value) {
    payload.value = stripQuery(payload.value)
  }
  if (item.type === TransportItemType.LOG) {
    if (payload.message) payload.message = stripQuery(payload.message)
    scrubRecord(payload.context)
  }
  if (item.type === TransportItemType.EVENT) scrubRecord(payload.attributes)
  return item // null을 돌려주면 그 항목을 보내지 않는다
}
