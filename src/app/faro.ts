import {
  createReactRouterV7DataOptions,
  getWebInstrumentations,
  initializeFaro,
  ReactIntegration,
} from '@grafana/faro-react'
import { TracingInstrumentation } from '@grafana/faro-web-tracing'
import { matchRoutes } from 'react-router'

import { beforeSend } from './faroScrub'

declare const __APP_VERSION__: string

// 실사용자 모니터링(Grafana Faro). 운영 빌드에 VITE_FARO_URL이 있을 때만 켠다 —
// Vercel Production 환경 변수에만 넣으므로 Preview·로컬·목(MSW) 배포에서는 꺼진다.
// main.tsx에서 가장 먼저 import한다(라우터 모듈이 import될 때 라우터를 만들기 때문).
const url = import.meta.env.VITE_FARO_URL

if (import.meta.env.PROD && url && import.meta.env.VITE_USE_MSW !== 'true') {
  initializeFaro({
    url,
    app: {
      name: 'nova-web',
      version: __APP_VERSION__,
      environment: 'production',
    },
    sessionTracking: { samplingRate: 0.1 },
    beforeSend,
    // 화면을 떠나며 취소한 요청은 오류가 아니다
    ignoreErrors: [/CanceledError/, /AbortError/, /ResizeObserver loop/],
    instrumentations: [
      // 이미지 같은 리소스마다 기록이 생겨 양이 많다. 웹 바이탈·페이지 이동은 그대로 남는다
      ...getWebInstrumentations({ enablePerformanceInstrumentation: false }),
      // 빼면 샘플에서 빠진 90% 세션이 "기록하지 않음" traceparent를 붙여 보내고,
      // 백엔드가 그걸 따라 서버 트레이스·요청 지표의 90%를 버린다.
      new TracingInstrumentation({
        omitTraceContextForUnsampledSessions: true,
      }),
      new ReactIntegration({
        router: createReactRouterV7DataOptions({ matchRoutes }),
      }),
    ],
  })
}
