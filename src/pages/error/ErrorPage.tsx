import { useEffect } from 'react'

import { faro } from '@grafana/faro-react'
import { Globe } from 'lucide-react'
import { useNavigate, useRouteError } from 'react-router'

import { getTraceId } from '@shared/api/client'
import { HOME_PATH } from '@shared/config/routes'
import { Button, Container, PlanetIcon } from '@shared/ui'

import * as styles from './ErrorPage.css'

// 라우터 에러 경계(errorElement). 화면을 그리다 예외가 나면 흰 화면 대신 이 안내가 뜬다.
// API 실패가 원인이면 문의 코드(traceId)를 보여 준다 — 사용자가 알려 주면 서버 로그를 찾을 수 있다.
export function ErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const traceId = getTraceId(error)

  // errorElement가 잡은 렌더 오류는 전역 오류로 올라가지 않아 Faro가 못 본다 — 직접 보낸다.
  useEffect(() => {
    if (error instanceof Error) faro.api?.pushError(error) // Faro가 꺼져 있으면 api가 없다
  }, [error])

  return (
    <Container>
      <div className={styles.root} role="alert">
        <PlanetIcon size={200} className={styles.illustration} />
        <div className={styles.texts}>
          <div className={styles.title}>문제가 생겼어요</div>
          <div className={styles.description}>
            잠시 후 다시 시도해 주세요.
            {traceId && ' 계속되면 아래 문의 코드를 알려 주세요.'}
          </div>
        </div>
        {traceId && (
          <div className={styles.trace}>
            문의 코드 <span className={styles.traceId}>{traceId}</span>
          </div>
        )}
        <div className={styles.actions}>
          {/* 경계는 렌더링이 다시 성공해야 풀린다 — 같은 주소를 새로 불러온다. */}
          <Button onClick={() => window.location.reload()}>다시 시도</Button>
          <Button
            variant="outline"
            color="secondary"
            icon={Globe}
            onClick={() => void navigate(HOME_PATH)}
          >
            홈으로
          </Button>
        </div>
      </div>
    </Container>
  )
}
