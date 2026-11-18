<!-- OPENWIKI:START -->

## OpenWiki

See [AGENTS.md](AGENTS.md) for OpenWiki agent instructions.

<!-- OPENWIKI:END -->

기능 전반의 흐름을 설명하거나 코드 위치를 모를 때는 `openwiki/index.md`부터 확인한다. 위키는 정기 갱신이라 최근 변경이 빠져 있을 수 있으니, 코드를 고칠 땐 소스가 기준이다.

경로별 상세 규칙은 `.claude/rules/`에 있다 — 해당 경로 파일을 다룰 때 자동으로 읽힌다(`styling` → `*.css.ts`, `data-layer` → `entities`/`shared/api`, `routing` → `app`/`header`, `jsx` → `*.tsx`).

## Commands

```bash
npm run dev             # Vite dev server
npm run build            # tsc -b && vite build
npm run analyze          # 번들 크기 트리맵(dist/stats.html)을 브라우저로 연다
npm run lint              # eslint .
npm run lint:fix          # eslint . --fix
npm run storybook         # Storybook dev server on :6006
npm run format:fix        # prettier --write .
npm run test              # vitest unit (src/**/*.test.ts)
npm run test:storybook    # 스토리를 컴포넌트 테스트로 돌림(vitest browser, chromium) — Storybook 화면의 테스트 버튼과 같은 것
npm run e2e               # Playwright E2E (e2e/*.spec.ts) — MSW를 켠 개발 서버를 :5174에 따로 띄운다
```

- `npm run e2e`는 `.env.local`과 무관하게 목(MSW)으로 돈다. 토스 결제창·다음 우편번호는 `e2e/fixtures.ts`의 가짜로 바꾸고, 목 DB는 테스트마다 새 브라우저라 시드에서 시작한다. 처음이면 `npx playwright install chromium`.

- `npm run test`는 순수 로직 단위 테스트(`src/**/*.test.ts`, node)만 돈다 — 결제 승인처럼 돈·재시도가 걸린 로직에 둔다. 화면 검증은 `npm run lint` + `npm run build` + 브라우저 확인.
- 목 결제 승인을 느리게 하려면 `.env.local`에 `VITE_MOCK_CONFIRM_DELAY_MS=15000` — 승인 중 폴링·재전송·새로고침을 재현한다.
- 목 외부 등록(접수 → 구매 확정 가능)은 기본 2초라 접수하면 결제로 바로 간다(상품 페이지가 등록을 5초까지 기다린다). 5초를 넘기는 경로(예약 접수 화면의 처리 중 → 구매 확정 가능, 지연 안내·처리 기록)는 `VITE_MOCK_REGISTER_DELAY_MS=20000`으로 재현한다.
- 커밋 시 husky가 commitlint(`feat:`/`fix:`/`test:` …)와 lint-staged(eslint --fix, prettier)를 돌린다.
- MSW는 dev에서 기본 on이다. 실제 API에 붙이려면 `.env.local`에 `VITE_USE_MSW=false`.

## Architecture

- **Feature-Sliced Design**: `src/app` → `pages` → `widgets` → `features` → `entities` → `shared`. Higher layers may import lower layers, never the reverse — enforced by `import-x/no-restricted-paths` in `eslint.config.js`.
- **Import 경로**: 슬라이스(`features/login`, `entities/product` 등) 밖은 레이어별 별칭(`@app`/`@pages`/`@widgets`/`@features`/`@entities`/`@shared`), 슬라이스 안은 상대경로를 쓴다(`../../lib/usePreorderQueue`, `./Modal.css`). `@/` 같은 src 통째 별칭은 쓰지 않는다. 별칭을 추가·변경할 땐 `tsconfig.app.json`의 `paths`와 `vite.config.ts`의 `alias`를 같이 고친다. 슬라이스 안에서 자기 배럴(`@features/login`)을 import하면 `index.ts` → 컴포넌트 → `index.ts` 순환이 생기므로 파일을 직접 가리킨다 — 배럴은 밖에서 들어오는 문이다.
- **Pages**: 페이지는 라우트 하나에 대응하는 조립만 한다. `pages/<name>/` 아래에 `XxxPage.tsx`(+`.css.ts`)를 평평하게 두고 `ui/`·`index.ts`를 만들지 않는다(라우터가 `@pages/main/MainPage`처럼 파일을 직접 import). 페이지 안에서 쓰는 하위 컴포넌트는 페이지 폴더에 두지 말고 `widgets`/`features`로 뺀다(예: 이미지 슬라이더+미리보기 → `features/product-gallery`). 관리자 전용 페이지·위젯은 `pages/admin/<name>/`, `widgets/admin/<name>/`(예: `pages/admin/products/AdminProductsPage.tsx`, `@widgets/admin/sidebar`)에 모은다 — `admin/`은 정리용 묶음 폴더라 그 바로 아래에 `index.ts`·공용 유틸 같은 코드를 두지 않고, 묶인 슬라이스끼리도 서로 import하지 않는다(두면 `admin`이 슬라이스가 돼 같은 레이어끼리 코드를 나눠 쓰게 된다). 폴더 이름엔 `admin-`을 붙이지 않고, 파일·컴포넌트 이름은 구매자 쪽과 겹치지 않게 `Admin` 접두어를 유지한다. entities는 화면이 아니라 데이터로 나누므로 묶지 않는다(`entities/admin-product` 그대로).
- **Segment**: hook(`useXxx`)은 `model/`에 두지 않는다 — `model/`은 타입·상수·스토어만, hook은 `lib/`에 둔다. TanStack Query 훅은 `entities/*/api/`에 둔다.
- **Feature 이름**: 기능 단위로 짓고 기술명을 쓰지 않는다(`login`, `payment`, `address-search` — `kakao-login`, `toss-payment` X). 슬라이스 안 파일명은 실제 구현을 드러내도 된다(`KakaoLoginModal`).
- **Reuse before adding**: 새 컴포넌트/타입/색상을 만들기 전에 `shared/ui`, 관련 `entities/*` 슬라이스, `shared/config/theme`(특히 `color.*` 토큰)에 이미 있는지부터 확인한다. 실제로 겪은 사례 — 거의 동일한 타입을 두 군데(`ProductColorSwatch`/`ProductColorSwatchItem`)에 따로 선언, 이미 있는 `color.background.surface` 대신 생 hex 값을 하드코딩. 구조가 겹치는 타입(필드 일부만 빠짐/전부 optional/키로 매핑 등)은 새로 손으로 적지 말고 `Pick`/`Omit`/`Partial`/`Record` 같은 유틸리티 타입으로 기존 타입에서 파생시킨다 — 단, 호출부가 하나뿐인데 제네릭을 억지로 붙이는 건 과한 설계다.
- **도메인 객체 props**: `product`/`preorder` 같은 엔티티 모델의 필드를 props로 하나씩 펼쳐 넘기지 않는다 — 객체째 넘기고, 쓰는 필드만 `Pick<Preorder, 'models' | 'opensAt'>`으로 좁혀 받는다(`PreorderModelSheet` 참고). 단, 현재 시각 등으로 계산한 값(`status`)은 받는 쪽에서 다시 구하면 부모와 어긋나므로 따로 넘긴다.
- **컴포넌트 폴더 구조**: `entities/*/ui/`(다른 레이어도 컴포넌트가 여러 개면 동일하게 적용) 안에서 컴포넌트를 `ui/ComponentName.tsx`처럼 평평하게 두지 않는다. 컴포넌트마다 `ui/ComponentName/` 폴더를 만들고 그 안에 `ComponentName.tsx`, `ComponentName.css.ts`, `ComponentName.stories.tsx`와 `export * from './ComponentName'`만 있는 `index.ts`를 넣는다. `index.ts` 덕분에 엔티티 배럴(`entities/*/index.ts`)의 `from './ui/ComponentName'` import는 그대로 유지된다 — 새 컴포넌트를 추가할 때도 처음부터 이 구조로 만든다.

## Error handling

- API 실패는 `apiClient`에서 전부 `ApiRequestError`(`error.code`/`error.message`/`status`)로 정규화된다 — 타임아웃·네트워크는 `status: 0`, JSON이 아닌 응답은 `INVALID_RESPONSE`, 취소는 실패가 아니라 그대로 던진다. 호출부에서 axios 에러를 따로 다루지 않는다.
- `catch`로 받은 값은 `unknown`이다. `.catch((cause: Error) => ...)`처럼 타입을 단언하지 말고, 화면 문구는 `getErrorMessage(caught, '기본 문구')`로 꺼낸다. 분기가 필요하면 `instanceof ApiRequestError`로 좁힌 뒤 `error.code`/`status`를 본다.
- 할 일이 있는 곳에서만 잡는다 — 문구 표시, 롤백, 다른 화면으로 이동. 할 일이 없으면 잡지 말고 위로 던지게 두고, `console.log`만 하고 삼키지 않는다.
- 서버 데이터 **조회**는 `useEffect` + `.then/.catch` + `useState`로 직접 하지 않고 TanStack Query 훅을 쓴다 — 취소(`signal`), 재시도(`queryPolicy`, 4xx는 재시도 안 함), `isError`가 따라온다. 관리자 페이지도 이관을 마쳤다. 예외는 `PaymentCallbackPage`·`DrawPaymentCallbackPage` 둘이다 — 결제 승인은 조회가 아니라 페이지 진입 시 한 번 보내는 명령이고, `signal`로 중간에 끊기면 돈은 빠졌는데 승인 결과를 모르게 된다.
- mutation(변경)은 자동 재시도하지 않는다(같은 요청이 두 번 반영될 수 있음). 진행 중엔 `isPending`으로 버튼을 막아 중복 제출을 막는다. 화면 반영은 기본이 **서버 확인**(`onSuccess`에서 응답으로 캐시 갱신)이고, 틀려도 되돌리면 그만인 값(장바구니 수량·토글)만 낙관적(`onMutate`)으로 한다 — 기준은 `queryPolicy.ts` 아래쪽 주석에 적어 뒀다.
  단, 사전예약 접수는 멱등키가 있어 응답을 못 받은 경우(status 0)만 한 번 다시 보낸다(`useSubmitPreorder`).
- "0건"과 "조회 실패"를 구분한다 — 실패를 빈 배열로 대체하지 말고 `undefined`/`isError`로 남겨 실패 문구를 보여준다(`AdminReservationsPage`의 `reservations` 참고).
