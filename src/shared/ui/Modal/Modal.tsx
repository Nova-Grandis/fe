import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

import { X } from 'lucide-react'

import { Button } from '@shared/ui/Button'

import * as styles from './Modal.css'

export type ModalActionsProps = {
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  /** 입력이 아직 유효하지 않거나 요청이 도는 동안 확인 버튼을 막는다. */
  confirmDisabled?: boolean
}

export type ModalProps = {
  open: boolean
  onClose: () => void
  /** dialog의 접근 가능한 이름(aria-labelledby)이 된다. */
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** 전역 모달은 페이지 테마(data-theme) 밖에 뜨므로 직접 정한다 — 사용자 화면은 어둡고, 관리자 화면만 'light'. */
  theme?: 'dark' | 'light'
  /** 기본은 확인 창 폭(400px). 화면 하나를 담을 땐 wide. */
  size?: 'default' | 'wide'
  /** 오른쪽 위 X 버튼의 이름. 닫아도 진행이 이어지는 창은 그 사실을 이름에 담는다. 기본 '닫기'. */
  closeLabel?: string
} & Partial<ModalActionsProps>

// 확인/취소 버튼 줄. onConfirm을 넘기면 Modal이 직접 그리고, 버튼이 내용의 상태(입력값)에
// 따라 바뀌어야 하면 내용(children)이 자기 상태로 이걸 그린다 — 전역 모달은 연 시점의
// props를 그대로 들고 있어서 Modal 쪽 버튼은 내용의 상태를 따라오지 못한다.
export function ModalActions({
  onConfirm,
  onCancel,
  confirmLabel = '확인',
  cancelLabel = '취소',
  confirmDisabled,
}: ModalActionsProps) {
  return (
    <div className={styles.actions}>
      <Button disabled={confirmDisabled} onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button variant="outline" color="cancel" onClick={onCancel}>
        {cancelLabel}
      </Button>
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  theme = 'dark',
  size = 'default',
  closeLabel = '닫기',
  onConfirm,
  onCancel = onClose,
  ...actions
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  // <dialog>는 항상 마운트해 두고 열림/닫힘은 showModal()/close()로만 바꾼다.
  // CSS의 [open] + @starting-style + allow-discrete가 여닫는 애니메이션을 맡는데,
  // React가 open=false일 때 노드를 통째로 떼어내 버리면 닫히는 애니메이션이 재생될
  // 기회 자체가 없다(트랜지션 도중 언마운트되면 그대로 끊긴다).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-theme={theme}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // dialog 엘리먼트 자체가 클릭됐다면 콘텐츠(자식) 바깥, 즉 backdrop 클릭이다.
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <button
        type="button"
        className={styles.closeButton}
        aria-label={closeLabel}
        title={closeLabel}
        onClick={onClose}
      >
        <X aria-hidden="true" size={18} />
      </button>
      {/* 여백/레이아웃은 dialog가 아니라 이 래퍼에 둔다 — dialog 자신에 display:flex 같은
          스타일이 붙으면 [open] 여부와 무관하게 항상 적용돼 닫힌 상태를 가릴 방법이
          없어진다(예전에 겪은 버그). */}
      <div className={`${styles.content} ${styles.size[size]}`}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description && <div className={styles.description}>{description}</div>}
        {/* 기본 모달은 children을 그대로 둔다 — 감싸면 여러 자식 사이의 gap이 사라진다. */}
        {size === 'wide' ? (
          <div className={styles.scrollBody}>{children}</div>
        ) : (
          children
        )}
        {onConfirm && (
          <ModalActions
            onConfirm={onConfirm}
            onCancel={onCancel}
            {...actions}
          />
        )}
      </div>
    </dialog>
  )
}
