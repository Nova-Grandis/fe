import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'

import { darkCanvas } from './preview.css'

import type { Preview } from '@storybook/react-vite'
import '../src/app/styles/index.css'
import '../src/shared/config/theme'

// 앱(main.tsx)과 같은 Provider — react-query 훅을 쓰는 컴포넌트가 스토리에서도 동작한다.
// Storybook엔 API 서버도 MSW도 없으니 요청은 실패하고, 재시도하지 않아 바로 에러 상태가 된다.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const preview: Preview = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
    // 경로에 따라 화면이 달라지는 컴포넌트(Header 등)는 스토리에서
    // parameters: { initialEntries: ['/admin'] } 으로 진입 경로를 지정한다.
    (Story, { parameters }) => (
      <MemoryRouter initialEntries={parameters.initialEntries ?? ['/']}>
        <Story />
      </MemoryRouter>
    ),
    // 사용자 페이지(늘 어두움)에 놓이는 컴포넌트는 parameters: { dark: true } 로 어두운 바탕에 그린다.
    (Story, { parameters }) =>
      parameters.dark ? (
        <div data-theme="dark" className={darkCanvas}>
          <Story />
        </div>
      ) : (
        <Story />
      ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'error',
    },
  },
}

export default preview
