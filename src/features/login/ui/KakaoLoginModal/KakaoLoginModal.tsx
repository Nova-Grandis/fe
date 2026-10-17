import { useState } from 'react'

import { typography } from '@shared/config/theme'
import { InlineAlert } from '@shared/ui'

import { getKakaoAuthorizeUrl } from '../../lib/getKakaoAuthorizeUrl'

import * as styles from './KakaoLoginModal.css'

const FALLBACK_ERROR = '로그인을 시작할 수 없습니다. 다시 시도해 주세요.'

// 로그인 모달의 내용. 제목·안내 문구는 Modal이 그린다 — openLoginModal()로 띄운다.
export type KakaoLoginModalProps = {
  /** 로그인 후 돌아갈 경로. 없으면 모달을 연 지금 화면으로 돌아온다. */
  returnTo?: string
}

export function KakaoLoginModal({ returnTo }: KakaoLoginModalProps) {
  const [error, setError] = useState<string | null>(null)

  return (
    <div className={styles.content}>
      {error && <InlineAlert status="error">{error}</InlineAlert>}
      <button
        type="button"
        data-faro-user-action-name="login-kakao"
        className={[typography.button.mdBold, styles.kakaoButton].join(' ')}
        onClick={() => {
          try {
            window.location.href = getKakaoAuthorizeUrl(returnTo)
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : FALLBACK_ERROR)
          }
        }}
      >
        {/* 카카오 말풍선 심볼 — lucide에 없는 브랜드 심볼이라 카카오 제공 에셋의 path를 옮겼다. */}
        <svg className={styles.symbol} viewBox="13 14 22 21" aria-hidden="true">
          <path d="M24.0014 14C17.9241 14 13 18.0219 13 22.9825C13 26.1711 15.0368 28.9728 18.1057 30.5656L17.0681 34.5677C17.0295 34.6871 17.0598 34.8151 17.1424 34.9033C17.2029 34.9659 17.2855 35 17.3653 35C17.4341 35 17.5029 34.9772 17.5607 34.9289L22.0196 31.8171C22.661 31.911 23.3215 31.9622 23.9986 31.9622C30.0732 31.9622 35 27.9403 35 22.9797C35 18.0191 30.0759 14 24.0014 14Z" />
        </svg>
        {/* 카카오 로그인 디자인 가이드의 버튼 문구 그대로 쓴다. */}
        카카오 로그인
      </button>
    </div>
  )
}
