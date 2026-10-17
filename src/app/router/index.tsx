import { withFaroRouterInstrumentation } from '@grafana/faro-react'
import { createBrowserRouter, redirect } from 'react-router'

import { AdminLayout } from '@app/layouts/AdminLayout'
import { MainLayout } from '@app/layouts/MainLayout'
import { RequireAdmin } from '@app/layouts/RequireAdmin'
import { RequireLogin } from '@app/layouts/RequireLogin'
import { RootLayout } from '@app/layouts/RootLayout'
import { KAKAO_CALLBACK_PATH } from '@features/login'
import {
  DRAW_PAYMENT_CALLBACK_PATH,
  PAYMENT_CALLBACK_PATH,
} from '@features/payment'
import { ErrorPage } from '@pages/error/ErrorPage'
import {
  ADMIN_HOME_PATH,
  ADMIN_DEAD_LETTERS_PATH,
  ADMIN_LOAD_TEST_PATH,
  ADMIN_LOGIN_PATH,
  ADMIN_MOCK_SETTINGS_PATH,
  ADMIN_DRAW_NEW_PATH,
  ADMIN_DRAWS_PATH,
  ADMIN_NOTIFICATIONS_PATH,
  ADMIN_PRODUCT_NEW_PATH,
  ADMIN_PRODUCTS_PATH,
  ADMIN_PROMOTION_NEW_PATH,
  ADMIN_PROMOTIONS_PATH,
  ADMIN_ORDERS_PATH,
  ADMIN_RECONCILIATION_PATH,
  ADMIN_RESERVATIONS_PATH,
  ADMIN_WAITINGROOM_PATH,
  adminProductPath,
  adminDeadLetterPath,
  adminReservationPath,
  adminPromotionPath,
  adminDrawPath,
  adminOrderPath,
  DRAW_PATH,
  drawPath,
  HOME_PATH,
  MYPAGE_PATH,
  ONBOARDING_PATH,
  PAYMENT_PATH,
  PREORDER_PATH,
  preorderPath,
  productPath,
  RESULT_PATH,
  REVIEWS_PATH,
  SEARCH_PATH,
  SEARCH_RESULTS_PATH,
  SIGNUP_PATH,
} from '@shared/config/routes'
import { hasSeenOnboarding } from '@widgets/onboarding'

// 페이지는 lazy로 불러온다 — 처음 들어온 화면의 코드만 받고, 나머지는 그 경로로 갈 때 받는다
// (전부 바로 import하면 홈 하나 열 때도 관리자·결제 화면까지 한 번들에 실린다).
// 레이아웃과 ErrorPage는 어느 화면에서든 바로 필요해서 그대로 둔다.
// 첫 진입 때 페이지 코드를 받는 짧은 동안은 아무것도 그리지 않는다(HydrateFallback) —
// 지정하지 않아도 같지만 react-router가 경고를 남긴다.
const browserRouter = createBrowserRouter([
  // 자체 로고·건너뛰기를 가진 전체 화면이라 헤더·탭바를 그리는 RootLayout 밖에 둔다.
  {
    path: ONBOARDING_PATH,
    hydrateFallbackElement: <></>,
    lazy: () =>
      import('@pages/onboarding/OnboardingPage').then((m) => ({
        Component: m.OnboardingPage,
      })),
    errorElement: <ErrorPage />,
  },
  {
    element: <RootLayout />,
    hydrateFallbackElement: <></>,
    // 헤더·레이아웃 자체가 깨지면 헤더 없이 에러 화면만 그린다.
    errorElement: <ErrorPage />,
    children: [
      {
        element: <MainLayout />,
        children: [
          {
            // 페이지가 깨지면 헤더·탭바는 남기고 본문 자리에만 에러 화면을 그린다.
            errorElement: <ErrorPage />,
            children: [
              {
                path: HOME_PATH,
                lazy: () =>
                  import('@pages/main/MainPage').then((m) => ({
                    Component: m.MainPage,
                  })),
                // 처음 온 사용자는 홈 대신 온보딩부터 본다. 상품 링크 등 다른 주소로 바로 들어오면 막지 않는다.
                loader: () =>
                  hasSeenOnboarding() ? null : redirect(ONBOARDING_PATH),
              },
              {
                path: PREORDER_PATH,
                lazy: () =>
                  import('@pages/preorder/PreorderPage').then((m) => ({
                    Component: m.PreorderPage,
                  })),
              },
              {
                path: preorderPath(':preorderId'),
                lazy: () =>
                  import('@pages/preorder-detail/PreorderDetailPage').then(
                    (m) => ({ Component: m.PreorderDetailPage }),
                  ),
              },
              {
                path: productPath(':productId'),
                lazy: () =>
                  import('@pages/product-detail/ProductDetailPage').then(
                    (m) => ({ Component: m.ProductDetailPage }),
                  ),
              },
              {
                path: DRAW_PATH,
                lazy: () =>
                  import('@pages/draw/DrawPage').then((m) => ({
                    Component: m.DrawPage,
                  })),
              },
              {
                path: drawPath(':drawId'),
                lazy: () =>
                  import('@pages/draw-detail/DrawDetailPage').then((m) => ({
                    Component: m.DrawDetailPage,
                  })),
              },
              {
                path: REVIEWS_PATH,
                lazy: () =>
                  import('@pages/reviews/ReviewsPage').then((m) => ({
                    Component: m.ReviewsPage,
                  })),
              },
              // 카테고리 둘러보기(/search)와 키워드 검색(/search/results)은 같은 검색 화면이다.
              {
                path: SEARCH_PATH,
                lazy: () =>
                  import('@pages/search-results/SearchResultsPage').then(
                    (m) => ({ Component: m.SearchResultsPage }),
                  ),
              },
              {
                path: SEARCH_RESULTS_PATH,
                lazy: () =>
                  import('@pages/search-results/SearchResultsPage').then(
                    (m) => ({ Component: m.SearchResultsPage }),
                  ),
              },
              {
                path: SIGNUP_PATH,
                lazy: () =>
                  import('@pages/signup/SignupPage').then((m) => ({
                    Component: m.SignupPage,
                  })),
              },
              {
                path: KAKAO_CALLBACK_PATH,
                lazy: () =>
                  import('@pages/kakao-callback/KakaoCallbackPage').then(
                    (m) => ({ Component: m.KakaoCallbackPage }),
                  ),
              },
              {
                // 사전예약·장바구니·결제는 회원 전용이다.
                element: <RequireLogin />,
                children: [
                  {
                    path: MYPAGE_PATH,
                    lazy: () =>
                      import('@pages/mypage/Mypage').then((m) => ({
                        Component: m.Mypage,
                      })),
                  },
                  {
                    path: PAYMENT_PATH,
                    lazy: () =>
                      import('@pages/payment/PaymentPage').then((m) => ({
                        Component: m.PaymentPage,
                      })),
                  },
                  {
                    path: PAYMENT_CALLBACK_PATH,
                    lazy: () =>
                      import('@pages/payment-callback/PaymentCallbackPage').then(
                        (m) => ({ Component: m.PaymentCallbackPage }),
                      ),
                  },
                  {
                    path: DRAW_PAYMENT_CALLBACK_PATH,
                    lazy: () =>
                      import('@pages/draw-payment-callback/DrawPaymentCallbackPage').then(
                        (m) => ({ Component: m.DrawPaymentCallbackPage }),
                      ),
                  },
                  {
                    path: RESULT_PATH,
                    lazy: () =>
                      import('@pages/result/ResultPage').then((m) => ({
                        Component: m.ResultPage,
                      })),
                  },
                ],
              },
              {
                path: '*',
                lazy: () =>
                  import('@pages/not-found/NotFoundPage').then((m) => ({
                    Component: m.NotFoundPage,
                  })),
              },
            ],
          },
        ],
      },
      // 관리자 로그인은 헤더(로고)는 두고 사이드바는 없다 — AdminLayout·RequireAdmin
      // 밖에 둔다. 헤더의 알림·로그아웃은 로그인 전이라 Header가 이 경로에서 숨긴다.
      {
        path: ADMIN_LOGIN_PATH,
        lazy: () =>
          import('@pages/admin/login/AdminLoginPage').then((m) => ({
            Component: m.AdminLoginPage,
          })),
        errorElement: <ErrorPage />,
      },
      {
        element: <RequireAdmin />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              {
                // 관리자 페이지도 사이드바는 남기고 본문 자리에만 에러 화면을 그린다.
                errorElement: <ErrorPage />,
                children: [
                  // 홈은 다른 용도로 바꿀 예정이라 비워 둔다. 메뉴 목록은 사이드바 한 곳에만 둔다.
                  {
                    path: ADMIN_HOME_PATH,
                    lazy: () =>
                      import('@pages/admin/placeholder/AdminPlaceholderPage').then(
                        (m) => ({
                          element: <m.AdminPlaceholderPage title="관리자 홈" />,
                        }),
                      ),
                  },
                  // 홈을 제외한 나머지는 아직 기능 범위가 안 정해져서 전부 placeholder —
                  // 스코프가 정해지는 대로 각자 전용 페이지로 교체.
                  {
                    path: ADMIN_PRODUCTS_PATH,
                    lazy: () =>
                      import('@pages/admin/products/AdminProductsPage').then(
                        (m) => ({ Component: m.AdminProductsPage }),
                      ),
                  },
                  {
                    path: ADMIN_PRODUCT_NEW_PATH,
                    lazy: () =>
                      import('@pages/admin/product-new/AdminProductNewPage').then(
                        (m) => ({ Component: m.AdminProductNewPage }),
                      ),
                  },
                  {
                    path: adminProductPath(':productId'),
                    lazy: () =>
                      import('@pages/admin/product-detail/AdminProductDetailPage').then(
                        (m) => ({ Component: m.AdminProductDetailPage }),
                      ),
                  },
                  {
                    path: ADMIN_PROMOTIONS_PATH,
                    lazy: () =>
                      import('@pages/admin/promotions/AdminPromotionsPage').then(
                        (m) => ({ Component: m.AdminPromotionsPage }),
                      ),
                  },
                  {
                    path: ADMIN_PROMOTION_NEW_PATH,
                    lazy: () =>
                      import('@pages/admin/promotion-new/AdminPromotionNewPage').then(
                        (m) => ({ Component: m.AdminPromotionNewPage }),
                      ),
                  },
                  {
                    path: adminPromotionPath(':promotionId'),
                    lazy: () =>
                      import('@pages/admin/promotion-edit/AdminPromotionEditPage').then(
                        (m) => ({ Component: m.AdminPromotionEditPage }),
                      ),
                  },
                  {
                    path: ADMIN_DRAWS_PATH,
                    lazy: () =>
                      import('@pages/admin/draws/AdminDrawsPage').then((m) => ({
                        Component: m.AdminDrawsPage,
                      })),
                  },
                  {
                    path: ADMIN_DRAW_NEW_PATH,
                    lazy: () =>
                      import('@pages/admin/draw-new/AdminDrawNewPage').then(
                        (m) => ({ Component: m.AdminDrawNewPage }),
                      ),
                  },
                  {
                    path: adminDrawPath(':drawId'),
                    lazy: () =>
                      import('@pages/admin/draw-detail/AdminDrawDetailPage').then(
                        (m) => ({ Component: m.AdminDrawDetailPage }),
                      ),
                  },
                  {
                    path: ADMIN_ORDERS_PATH,
                    lazy: () =>
                      import('@pages/admin/orders/AdminOrdersPage').then(
                        (m) => ({ Component: m.AdminOrdersPage }),
                      ),
                  },
                  {
                    path: adminOrderPath(':orderId'),
                    lazy: () =>
                      import('@pages/admin/order-detail/AdminOrderDetailPage').then(
                        (m) => ({ Component: m.AdminOrderDetailPage }),
                      ),
                  },
                  {
                    path: ADMIN_RESERVATIONS_PATH,
                    lazy: () =>
                      import('@pages/admin/reservations/AdminReservationsPage').then(
                        (m) => ({ Component: m.AdminReservationsPage }),
                      ),
                  },
                  {
                    path: adminReservationPath(':preorderId'),
                    lazy: () =>
                      import('@pages/admin/reservation-detail/AdminReservationDetailPage').then(
                        (m) => ({ Component: m.AdminReservationDetailPage }),
                      ),
                  },
                  {
                    path: ADMIN_RECONCILIATION_PATH,
                    lazy: () =>
                      import('@pages/admin/reconciliation/AdminReconciliationPage').then(
                        (m) => ({ Component: m.AdminReconciliationPage }),
                      ),
                  },
                  {
                    path: ADMIN_DEAD_LETTERS_PATH,
                    lazy: () =>
                      import('@pages/admin/dead-letters/AdminDeadLettersPage').then(
                        (m) => ({ Component: m.AdminDeadLettersPage }),
                      ),
                  },
                  {
                    path: adminDeadLetterPath(':deadLetterId'),
                    lazy: () =>
                      import('@pages/admin/dead-letter-detail/AdminDeadLetterDetailPage').then(
                        (m) => ({ Component: m.AdminDeadLetterDetailPage }),
                      ),
                  },
                  {
                    path: ADMIN_WAITINGROOM_PATH,
                    lazy: () =>
                      import('@pages/admin/waitingroom/AdminWaitingroomPage').then(
                        (m) => ({ Component: m.AdminWaitingroomPage }),
                      ),
                  },
                  {
                    path: ADMIN_LOAD_TEST_PATH,
                    lazy: () =>
                      import('@pages/admin/load-test/AdminLoadTestPage').then(
                        (m) => ({ Component: m.AdminLoadTestPage }),
                      ),
                  },
                  {
                    path: ADMIN_NOTIFICATIONS_PATH,
                    lazy: () =>
                      import('@pages/admin/placeholder/AdminPlaceholderPage').then(
                        (m) => ({
                          element: (
                            <m.AdminPlaceholderPage title="관리자 알림 내역 확인" />
                          ),
                        }),
                      ),
                  },
                  {
                    path: ADMIN_MOCK_SETTINGS_PATH,
                    lazy: () =>
                      import('@pages/admin/mock-settings/AdminMockSettingsPage').then(
                        (m) => ({ Component: m.AdminMockSettingsPage }),
                      ),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])

// Faro가 페이지 이름을 경로 패턴(/preorders/:preorderId)으로 남기도록 감싼다(Faro가 꺼져 있으면 아무것도 보내지 않는다).
export const router = withFaroRouterInstrumentation(browserRouter)
