import { useState } from 'react'
import { useNav } from '../nav'
import { useStore } from '../store'
import { PREMIUM_DEPOSIT, VERIFY_STEPS, money, verifiedCount } from '../utils'
import { Badge, Modal } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import type { VerifyStep } from '../utils'

/* The profile has promised since the beginning that verifying "unlocks
   instant-book on premium gear". Nothing read the flag: every instant-book
   listing booked instantly for everyone, so the promise described a gate that
   did not exist. The gate is real now, which means there has to be somewhere to
   walk through it — and each step has to say what it is actually for, because
   "verify your identity" with no stated payoff is a form nobody fills in. */

const STEPS: { id: VerifyStep; label: string; icon: IconName; why: string; ask: string }[] = [
  {
    id: 'id',
    label: 'Photo ID',
    icon: 'shield',
    why: 'Owners handing over a Rs 150,000 camera want to know who has it.',
    ask: 'CNIC or passport — we check the name matches your profile.',
  },
  {
    id: 'phone',
    label: 'Phone number',
    icon: 'phone',
    why: 'The driver needs a number that reaches you on shoot day.',
    ask: 'We send a code to the number on your profile.',
  },
  {
    id: 'payment',
    label: 'Payment method',
    icon: 'card',
    why: 'Premium gear carries a deposit hold, which needs a card that can take one.',
    ask: 'A small authorization is placed and released immediately.',
  },
]

export default function VerifyView() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()
  const [pending, setPending] = useState<VerifyStep | null>(null)

  const done = verifiedCount(state.profile)
  const all = done === VERIFY_STEPS.length
  const isDone = (id: VerifyStep) =>
    id === 'id' ? Boolean(state.profile.idVerified)
      : id === 'phone' ? Boolean(state.profile.phoneVerified)
        : Boolean(state.profile.paymentVerified)

  return (
    <div className="section">
      <button className="back-btn" onClick={() => go({ name: 'profile' })}>
        <Icon name="chevron-left" size={16} /> Profile
      </button>
      <div className="section-head"><h2><Icon name="shield" className="h-ico" size={18} /> Verification</h2></div>

      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <b style={{ fontSize: 15, flex: 1 }}>{done} of {VERIFY_STEPS.length} done</b>
          {all
            ? <Badge tone="green"><Icon name="check" size={14} /> Fully verified</Badge>
            : <Badge tone="orange">{VERIFY_STEPS.length - done} to go</Badge>}
        </div>
        <div className="histo" style={{ gridTemplateColumns: '1fr', margin: '8px 0 0' }}>
          <div
            className="bar"
            style={{ height: 10 }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={VERIFY_STEPS.length}
            aria-valuenow={done}
            aria-label={`${done} of ${VERIFY_STEPS.length} verification steps complete`}
          ><i style={{ width: `${(done / VERIFY_STEPS.length) * 100}%` }} /></div>
        </div>
        {/* The payoff is stated as a rule with a number in it, not as a vague
            benefit — "premium" means nothing until you can tell which listings
            it covers. */}
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          {all
            ? <>Gear with a deposit over {money(PREMIUM_DEPOSIT)} now books instantly. No waiting on owner approval.</>
            : <>Finish all three and gear with a deposit over {money(PREMIUM_DEPOSIT)} books instantly instead of waiting on owner approval. Everything else already books instantly.</>}
        </p>
      </div>

      {STEPS.map((s) => {
        const complete = isDone(s.id)
        return (
          <div key={s.id} className="panel" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name={complete ? 'check-circle' : s.icon} size={20} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{s.label}</b>
                <div className="muted small">{s.why}</div>
              </div>
              {complete
                ? <Badge tone="green">Verified</Badge>
                : <button className="btn btn-primary btn-sm" onClick={() => setPending(s.id)}>Verify</button>}
            </div>
          </div>
        )
      })}

      <p className="muted small" style={{ marginTop: 14 }}>
        This demo has no real identity checks — verifying is a single tap and nothing is uploaded or sent anywhere.
      </p>

      {pending && (
        <Modal title={STEPS.find((s) => s.id === pending)!.label} onClose={() => setPending(null)}>
          <p className="muted small" style={{ marginTop: 0 }}>{STEPS.find((s) => s.id === pending)!.ask}</p>
          <p className="muted small">
            Nothing is actually collected — this is a demo, so the step completes on tap.
          </p>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 10 }}
            onClick={() => {
              dispatch({ type: 'VERIFY_STEP', step: pending })
              toast(`${STEPS.find((s) => s.id === pending)!.label} verified`)
              setPending(null)
            }}
          >
            Verify {STEPS.find((s) => s.id === pending)!.label.toLowerCase()}
          </button>
        </Modal>
      )}
    </div>
  )
}
