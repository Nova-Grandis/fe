export type TeamRole = 'Frontend' | 'Backend'

export type TeamMember = {
  id: string
  name: string
  role: TeamRole
  /** GitHub 아이디(@ 없이) */
  handle: string
  github: string
  /** 맡은 기능 — 상세의 WORKED ON 태그 */
  features: string[]
}

// 궤도 가운데 GitHub 버튼이 여는 저장소.
export const REPO = {
  url: 'https://github.com/Grandis-2',
  label: 'Grandis-Nova',
}

// 담당 기능은 저장소(fe·be·mock) PR 기록 기준으로 둘씩만 적는다.
const member = (
  id: string,
  role: TeamRole,
  name: string,
  handle: string,
  features: string[],
): TeamMember => ({
  id,
  name,
  role,
  handle,
  github: `https://github.com/${handle}`,
  features,
})

export const TEAM: TeamMember[] = [
  member('0', 'Backend', '설승환', 'SH-Seol', [
    '결제 승인·복구',
    '실시간 알림',
  ]),
  member('1', 'Backend', '김태중', 'taejoong15', [
    '예약 정합성 검사',
    'Mock 예약 API',
  ]),
  member('2', 'Frontend', '김혜진', 'llmeajinll', [
    '사전예약·대기열·결제 화면',
    '디자인 토큰·공용 UI',
  ]),
  member('3', 'Backend', '유희준', 'UHeeJoon', [
    '사전예약 접수·대기열',
    '입장 속도·용량 조절',
  ]),
  member('4', 'Frontend', '이주현', 'hana03030', [
    '운영 대시보드',
    '예약 현황·외부 예약 대조',
  ]),
  member('5', 'Backend', '이호성', 'leehosss', [
    '외부 예약 Mock 서버',
    '지연·실패 주입',
  ]),
  member('6', 'Backend', '허건', 'HUHGEON', [
    '상품 카탈로그 API',
    '조회 읽기 캐시',
  ]),
]

// 아무도 고르지 않았을 때 상세에 보여 줄 팀원.
export const DEFAULT_MEMBER_ID = '0'
