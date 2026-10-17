// 실사용자 모니터링은 라우터가 만들어지기 전에 켜야 해서 가장 먼저 import한다.
import './app/faro'
import './app/amplitude'

import { StrictMode } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import './app/styles/index.css'
import './shared/config/theme'
import { queryClient } from './app/queryClient'
import { router } from './app/router'
import { initAuth } from './entities/auth'
import { startMockWorker } from './shared/api/mock'

// worker 등록 전에 첫 요청이 나가면 mocking을 놓치므로 렌더보다 먼저 기다린다.
void startMockWorker().then(() => {
  // 메모리 세션은 새로고침하면 비므로 리프레시 쿠키로 한 번 되살려 본다(11-frontend-guide.md
  // §4). 렌더를 막지 않는다 — 끝나면 세션 스토어 구독자가 알아서 갱신된다.
  void initAuth()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
})
