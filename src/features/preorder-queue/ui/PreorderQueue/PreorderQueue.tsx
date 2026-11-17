import { Modal } from '@shared/ui'

import { usePreorderQueue } from '../../lib/usePreorderQueue'
import { PreorderQueueCard } from '../PreorderQueueCard'
import { QueuePill } from '../QueuePill'

import type { PreorderAdmission } from '../../model/preorderQueueStore'

export type PreorderQueueProps = {
  productId: string
  productName: string
  // 내 차례가 오면(모달이 닫혀 있어도) 입장권과 함께 호출된다.
  onComplete: (admission: PreorderAdmission) => void
  // 줄을 설 수 없으면(마감·오픈 전 등) 서버 문구와 함께 호출된다.
  onFail: (message: string) => void
  // 나가기를 누르면 호출된다 — 줄을 비워 다른 상품에 설 수 있게 한다.
  onLeave: () => void
  // 이 모델에 진행 중인 내 예약이 있어 줄을 서지 않았으면 호출된다.
  onExisting: () => void
}

// 대기열 한 번(줄 서기 → 대기 → 이동/나가기). 전역 모달(useModalStore)을 쓰지 않고 자기 Modal을
// 띄운다 — 모달을 닫아도 계속 도는 과정이고, 순번이 바뀔 때마다 내용을 다시 그려야 한다.
// 마운트되는 순간 줄을 서고 모달이 열린다 —
// 새로 줄을 세우려면 여는 쪽이 key를 바꿔 다시 마운트한다.
// 모달을 닫아도(나가기 X) 순번 조회는 계속되고 그동안 QueuePill이 떠 있다.
export function PreorderQueue({
  productId,
  productName,
  onComplete,
  onFail,
  onLeave,
  onExisting,
}: PreorderQueueProps) {
  const queue = usePreorderQueue({
    productId,
    onComplete,
    onFail,
    onLeave,
    onExisting,
  })

  return (
    <>
      <Modal
        open={queue.isOpen && !queue.isHidden}
        onClose={queue.close}
        // '대기열 나가기'(줄에서 빠짐)와 헷갈리지 않게, X는 창만 닫고 자리는 지킨다는 걸 이름에 담는다.
        closeLabel="창 닫기 (순번 유지)"
        // 순번이 한참 남았는데 '곧 이동'이라고 하지 않는다 — 아래 예상 대기('오래 걸림')와 말이 어긋난다.
        title={
          queue.status === 'mine' ? (
            <>
              내 차례예요,
              <br />곧 예약 페이지로 이동합니다.
            </>
          ) : (
            <>
              조금만 기다려주세요,
              <br />
              차례가 오면 예약 페이지로 이동합니다.
            </>
          )
        }
        description={productName}
      >
        <PreorderQueueCard queue={queue} />
      </Modal>
      {/* 모달을 닫아 뒀거나, 대기열을 띄우기 전 답을 기다리는 중이면(입장 확인 중) 알약을 띄운다. */}
      {((!queue.isOpen && !queue.hasLeft) || queue.checking) && (
        <QueuePill productName={productName} queue={queue} />
      )}
    </>
  )
}
