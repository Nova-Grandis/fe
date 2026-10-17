/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
import path from 'node:path'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
const dirname = import.meta.dirname

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react(), vanillaExtractPlugin()],
  // Faro에 보내는 앱 버전 — Vercel 빌드 커밋. 로컬 빌드는 'local'.
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    ),
  },
  resolve: {
    alias: {
      // FSD 레이어별 별칭 — tsconfig.app.json의 paths와 같이 고친다.
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@widgets': fileURLToPath(new URL('./src/widgets', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // ^ 로 시작하면 정규식 키 — /api 와 /external(외부 예약 Mock) 둘 다 백엔드로 보낸다
      '^/(api|external)(/|$)': {
        target: 'https://api.grandis-nova.link',
        changeOrigin: true, // Host 를 api.grandis-nova.link 로
        cookieDomainRewrite: 'localhost', // 응답 쿠키(refresh_token)를 localhost 에 저장
        configure: (proxy) => {
          proxy.on('proxyReq', (req) => {
            // 앱의 CORS · 재발급 Origin 검사를 운영 프런트로 통과시킨다 (개발 서버에서만)
            req.setHeader('origin', 'https://www.grandis-nova.link')
            // localhost 의 다른 쿠키(IDE, Auth.js 등)는 넘기지 않는다 — WAF 가 차단한 원인.
            // 관리자 리프레시는 admin_refresh_token 이라 이름을 같이 받는다 — 빼면
            // 관리자 세션이 새로고침마다 끊긴다.
            const keep = String(req.getHeader('cookie') ?? '')
              .split(/;\s*/)
              .filter((c) => /^(admin_)?refresh_token=/.test(c))
            keep.length
              ? req.setHeader('cookie', keep.join('; '))
              : req.removeHeader('cookie')
          })
        },
      },
    },
  },
  test: {
    projects: [
      // 순수 로직(결제 승인 재시도·폴링 등) 단위 테스트 — 브라우저 없이 node에서 돈다.
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
  },
})
