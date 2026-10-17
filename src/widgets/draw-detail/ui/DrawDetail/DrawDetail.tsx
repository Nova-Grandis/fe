import { useMemo, useState } from 'react'

import { Info } from 'lucide-react'
import { useNavigate } from 'react-router'

import { useSession } from '@entities/auth'
import {
  DrawCard,
  formatDrawDateTime,
  getDrawEntryState,
  getDrawPhase,
  useDraw,
  useDraws,
  useMyDrawEntry,
  type Draw,
  type DrawEntry,
} from '@entities/draw'
import { useRequireLogin } from '@features/login'
import { startDrawEntryPayment } from '@features/payment'
import { getErrorMessage } from '@shared/api/client'
import { drawPaymentPath, mypagePath } from '@shared/config/routes'
import { formatNumber } from '@shared/lib/formatNumber'
import { useCountdown } from '@shared/lib/useCountdown'
import { showToast } from '@shared/model/toastStore'
import { ActionButton, InlineAlert, PollingNotice } from '@shared/ui'

import { NOTICES, STEPS } from '../../lib/drawDetailCopy'
import { getDrawView } from '../../lib/getDrawAction'

import * as styles from './DrawDetail.css'

const pad = (value: number | string) => String(value).padStart(2, '0')

const COUNTDOWN_LABEL = {
  SCHEDULED: '응모 시작까지',
  OPEN: '응모 마감까지',
  CLOSED: '응모 마감',
} as const

export type DrawDetailProps = {
  drawId: string
}

// 럭키 드로우 상세. 회차 단계(시작 전·응모 중·마감)와 내 응모 단계(응모 전·결제 대기·응모 완료·당첨…)마다
// 뱃지·안내·하단 버튼이 달라진다 — 어떻게 달라지는지는 getDrawView 한 곳에 있다.
export function DrawDetail({ drawId }: DrawDetailProps) {
  const { isLoggedIn } = useSession()
  const draw = useDraw(drawId)
  // 비로그인은 401이라 묻지 않는다. 응모하지 않았으면 data가 null이다.
  const entry = useMyDrawEntry(drawId, { enabled: isLoggedIn })

  if (draw.isError)
    return (
      <InlineAlert status="error" variant="big">
        {getErrorMessage(draw.error, '럭키드로우를 불러오지 못했어요.')}
      </InlineAlert>
    )
  if (!draw.data)
    return (
      <InlineAlert status="info" variant="big" icon={Info}>
        럭키드로우를 불러오는 중이에요.
      </InlineAlert>
    )

  return (
    <DrawDetailBody
      draw={draw.data}
      entry={entry.data}
      isEntryLoading={isLoggedIn && entry.isPending}
      entryPoll={entry}
    />
  )
}

type DrawDetailBodyProps = {
  draw: Draw
  // undefined는 아직 모르는 것, null은 응모하지 않은 것이다.
  entry: DrawEntry | null | undefined
  isEntryLoading: boolean
  // 승인·추첨 결과를 기다리며 다시 묻는 상태(실패·시간 초과 안내용).
  entryPoll: Pick<
    ReturnType<typeof useMyDrawEntry>,
    'fetchStatus' | 'failureCount' | 'timedOut' | 'recheck'
  >
}

// 기다리던 결과를 제한 시간 안에 못 받았을 때의 안내. 결제는 다시 결제하지 않게 막는다.
const TIMEOUT_COPY = {
  payment: {
    title: '결제 결과를 확인하지 못했어요. 응모 내역에서 확인해 주세요.',
    description: '다시 결제하지 마세요.',
  },
  result: {
    title: '결과가 아직 나오지 않았어요.',
    description: '당첨되면 알림으로 알려드려요.',
  },
} as const

function DrawDetailBody({
  draw,
  entry,
  isEntryLoading,
  entryPoll,
}: DrawDetailBodyProps) {
  const navigate = useNavigate()
  const requireLogin = useRequireLogin()
  const others = useDraws()
  const [isPaying, setIsPaying] = useState(false)

  const phase = getDrawPhase(draw)
  const view = getDrawView(phase, getDrawEntryState(entry))

  // 시작 전엔 시작까지, 응모 중엔 마감까지 센다. 매 렌더 새 Date면 useCountdown의 interval이 매초 다시 걸린다.
  const target = phase === 'SCHEDULED' ? draw.opensAt : draw.closesAt
  const targetDate = useMemo(() => new Date(target), [target])
  const countdown = useCountdown(targetDate)
  const isOver = phase === 'CLOSED'
  const parts = [
    { value: isOver ? 0 : countdown.days, unit: '일' },
    { value: isOver ? '00' : pad(countdown.hours), unit: '시간' },
    { value: isOver ? '00' : countdown.minutes, unit: '분' },
    { value: isOver ? '00' : countdown.seconds, unit: '초' },
  ]

  const otherDraws = (others.data?.items ?? [])
    .filter((it) => it.drawId !== draw.drawId && getDrawPhase(it) !== 'CLOSED')
    .slice(0, 4)

  // 응모비 결제 준비 → 토스 결제창. 정상 진행되면 페이지가 결제창으로 넘어간다.
  const pay = async () => {
    setIsPaying(true)
    try {
      await startDrawEntryPayment({ drawId: draw.drawId })
    } catch (caught) {
      showToast(getErrorMessage(caught, '결제를 시작하지 못했어요.'))
    } finally {
      setIsPaying(false)
    }
  }

  const onCta = () => {
    switch (view.cta.kind) {
      case 'enter':
        requireLogin(() => navigate(drawPaymentPath(draw.drawId)))
        return
      case 'pay':
        void pay()
        return
      case 'orders':
        navigate(mypagePath('history'))
        return
      case 'none':
        return
    }
  }

  return (
    <div className={styles.root}>
      <section>
        <div className={styles.hero}>
          <div className={styles.imageBox}>
            {draw.gift.imageUrl && (
              <img src={draw.gift.imageUrl} alt="" className={styles.image} />
            )}
            <span className={styles.imageTag}>LUCKY DRAW</span>
          </div>

          <div className={styles.info}>
            <div className={styles.head}>
              <div className={styles.badges}>
                <span className={styles.badge}>{view.badge}</span>
                <span className={styles.option}>{draw.gift.optionTitle}</span>
              </div>
              <h1 className={styles.title}>{draw.title}</h1>
              <div className={styles.description}>
                증정품 {draw.gift.productTitle}. 응모비를 결제하면 추첨 대상이
                되고, 당첨되면 증정품을 보내드려요.
              </div>
              <div className={styles.fee}>
                <span className={styles.feeLabel}>응모비</span>
                <span className={styles.feeValue}>
                  {formatNumber(draw.entryFee)}
                </span>
                <span className={styles.feeUnit}>원</span>
              </div>
            </div>

            <div className={styles.countdown}>
              <div className={styles.countdownLabel}>
                {COUNTDOWN_LABEL[phase]}
              </div>
              <div className={styles.countdownParts}>
                {parts.map(({ value, unit }) => (
                  <div key={unit} className={styles.countdownPart}>
                    <span
                      className={
                        styles.countdownValue[isOver ? 'over' : 'live']
                      }
                    >
                      {value}
                    </span>
                    <span className={styles.countdownUnit}>{unit}</span>
                  </div>
                ))}
              </div>
            </div>

            <dl className={styles.rows}>
              <div className={styles.row}>
                <dt className={styles.rowLabel}>응모 기간</dt>
                <dd className={styles.rowValue}>
                  {formatDrawDateTime(draw.opensAt)} –{' '}
                  {formatDrawDateTime(draw.closesAt)}
                </dd>
              </div>
              <div className={styles.row}>
                <dt className={styles.rowLabel}>당첨 인원</dt>
                <dd className={styles.rowValue}>
                  {formatNumber(draw.winnerCount)}명 · 1인 1회 응모
                </dd>
              </div>
              <div className={styles.row}>
                <dt className={styles.rowLabel}>당첨 발표</dt>
                <dd className={styles.rowValue}>
                  응모 마감 뒤 추첨 · 이 페이지에서 확인
                </dd>
              </div>
            </dl>

            <PollingNotice
              query={entryPoll}
              timeout={
                entryPoll.timedOut
                  ? {
                      ...TIMEOUT_COPY[entryPoll.timedOut],
                      onRecheck: entryPoll.recheck,
                    }
                  : null
              }
            />
            {view.note && (
              <div className={styles.note[view.note.tone]}>
                <span className={styles.noteTitle}>{view.note.title}</span>
                <span className={styles.noteBody}>{view.note.body}</span>
              </div>
            )}

            <ActionButton
              fullWidth
              // 응모는 결제 화면의 '결제하고 응모하기'에서 한다 — 여기선 이미 한 응모의 결제만 이름을 단다.
              data-faro-user-action-name={
                view.cta.kind === 'pay' ? 'payment-request' : undefined
              }
              disabled={view.cta.kind === 'none' || isEntryLoading || isPaying}
              onClick={onCta}
            >
              {isEntryLoading ? '내 응모를 확인하고 있어요' : view.cta.label}
            </ActionButton>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>참여 방법</h2>
        <ol className={styles.steps}>
          {STEPS.map(({ title, description }, index) => (
            <li key={title} className={styles.step}>
              <span className={styles.stepNumber}>{pad(index + 1)}</span>
              <span className={styles.stepTitle}>{title}</span>
              <span className={styles.stepDescription}>{description}</span>
            </li>
          ))}
        </ol>
      </section>

      {otherDraws.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>다른 럭키드로우</h2>
          <div className={styles.others}>
            {otherDraws.map((it) => (
              <DrawCard key={it.drawId} data={it} />
            ))}
          </div>
        </section>
      )}

      <section className={styles.noticeSection}>
        <h2 className={styles.noticeTitle}>유의사항</h2>
        <ul className={styles.notices}>
          {NOTICES.map((notice) => (
            <li key={notice}>· {notice}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
