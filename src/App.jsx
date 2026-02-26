import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── SERVICES DATA ───────────────────────────────────────────────────────────
const SERVICES = [
  { id: 1, category: 'Hair', name: 'Blow Dry & Style', duration: '45 min', price: 450, deposit: 150, description: 'Full blow-dry with style finish' },
  { id: 2, category: 'Hair', name: 'Wash & Blow Dry', duration: '30 min', price: 350, deposit: 120, description: 'Cleanse, condition & blowout' },
  { id: 3, category: 'Hair', name: 'Hair Treatment', duration: '60 min', price: 550, deposit: 180, description: 'Deep conditioning treatment' },
  { id: 4, category: 'Makeup', name: 'Full Face Makeup', duration: '60 min', price: 650, deposit: 200, description: 'Flawless full glam application' },
  { id: 5, category: 'Makeup', name: 'Natural Glam', duration: '45 min', price: 500, deposit: 160, description: 'Soft, elevated everyday look' },
  { id: 6, category: 'Makeup', name: 'Bridal Makeup', duration: '90 min', price: 1200, deposit: 400, description: 'Trial + wedding day perfection' },
  { id: 7, category: 'Nails', name: 'Manicure', duration: '45 min', price: 280, deposit: 100, description: 'Shape, buff & polish finish' },
  { id: 8, category: 'Nails', name: 'Gel Manicure', duration: '60 min', price: 380, deposit: 130, description: 'Long-lasting gel colour' },
  { id: 9, category: 'Lashes', name: 'Classic Lash Set', duration: '90 min', price: 550, deposit: 180, description: 'Individual lash extensions' },
  { id: 10, category: 'Lashes', name: 'Volume Lash Set', duration: '120 min', price: 750, deposit: 250, description: 'Full dramatic volume set' },
]

const CATEGORIES = ['All', ...Array.from(new Set(SERVICES.map(s => s.category)))]

const STEPS = ['Services', 'Date & Time', 'Details', 'Payment']

const TOTAL_STEPS = 4

// ─── GLASS VARIANTS ──────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 24, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -16, scale: 0.97, transition: { duration: 0.3, ease: [0.55, 0, 1, 0.45] } }
}

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: i => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] } })
}

// ─── UTILITY ─────────────────────────────────────────────────────────────────
function formatZAR(n) { return `R ${n.toLocaleString('en-ZA')}` }

function getTimes() {
  const slots = []
  for (let h = 8; h <= 18; h++) {
    ['00', '30'].forEach(m => {
      if (h === 18 && m === '30') return
      const ampm = h < 12 ? 'AM' : 'PM'
      const hh = h > 12 ? h - 12 : h === 0 ? 12 : h
      slots.push(`${hh}:${m} ${ampm}`)
    })
  }
  return slots
}

function getDates() {
  const dates = []
  const now = new Date()
  for (let i = 1; i <= 30; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    if (d.getDay() !== 0) dates.push(d)
  }
  return dates
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function GlassShell({ children }) {
  return (
    <div className="glass-shell">
      <div className="shell-spotlight" />
      <div className="shell-inner">{children}</div>
    </div>
  )
}

function ProgressBar({ step }) {
  return (
    <div className="progress-wrap">
      {STEPS.map((label, i) => {
        const state = i + 1 < step ? 'done' : i + 1 === step ? 'active' : 'future'
        return (
          <div key={label} className={`progress-item ${state}`}>
            <div className="progress-track">
              <motion.div
                className="progress-fill"
                initial={{ width: 0 }}
                animate={{ width: state === 'done' ? '100%' : state === 'active' ? '55%' : '0%' }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
              {state === 'active' && (
                <motion.div
                  className="progress-glow"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              )}
            </div>
            <span className="progress-label">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function Header({ step }) {
  return (
    <div className="app-header">
      <div className="logo-ring">
        <span className="logo-letter">P</span>
        <div className="logo-shine" />
      </div>
      <div className="brand-block">
        <span className="brand-name">PhenomeBeauty</span>
        <div className="brand-rule" />
        <span className="brand-tag">Mobile Beauty Studio</span>
      </div>
      <ProgressBar step={step} />
    </div>
  )
}

function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [])
  return (
    <motion.div className="toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      {msg}
    </motion.div>
  )
}

// ── STEP 1: Services ──────────────────────────────────────────────────────────
function StepServices({ selected, onSelect }) {
  const [filter, setFilter] = useState('All')
  const shown = filter === 'All' ? SERVICES : SERVICES.filter(s => s.category === filter)

  return (
    <motion.div {...pageVariants} key="step1">
      <h2 className="step-title">Choose Your Services</h2>
      <p className="step-sub">Select one or more — your cart updates below</p>

      <div className="chip-row">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} className={`chip ${filter === cat ? 'chip-active' : ''}`}>{cat}</button>
        ))}
      </div>

      <div className="service-grid">
        {shown.map((svc, i) => {
          const sel = selected.find(s => s.id === svc.id)
          return (
            <motion.button
              key={svc.id}
              custom={i}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              onClick={() => onSelect(svc)}
              className={`service-card ${sel ? 'service-card-active' : ''}`}
            >
              <div className="card-top">
                <span className="card-name">{svc.name}</span>
                <span className={`card-check ${sel ? 'visible' : ''}`}>✓</span>
              </div>
              <span className="card-category">{svc.category}</span>
              <p className="card-desc">{svc.description}</p>
              <div className="card-meta">
                <span className="card-duration">⏱ {svc.duration}</span>
                <span className="card-price">{formatZAR(svc.price)}</span>
              </div>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

// ── STEP 2: Date & Time ───────────────────────────────────────────────────────
function StepDateTime({ date, time, onDate, onTime }) {
  const dates = getDates()
  const times = getTimes()

  return (
    <motion.div {...pageVariants} key="step2">
      <h2 className="step-title">Pick a Date & Time</h2>
      <p className="step-sub">Available slots — Monday through Saturday</p>

      <div className="date-scroll">
        {dates.map((d, i) => {
          const sel = date && d.toDateString() === date.toDateString()
          return (
            <motion.button
              key={d.toDateString()}
              custom={i}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              onClick={() => onDate(d)}
              className={`date-chip ${sel ? 'date-chip-active' : ''}`}
            >
              <span className="date-day">{DAY_NAMES[d.getDay()]}</span>
              <span className="date-num">{d.getDate()}</span>
              <span className="date-mon">{MON_NAMES[d.getMonth()]}</span>
            </motion.button>
          )
        })}
      </div>

      <h3 className="section-label">Available Times</h3>
      <div className="time-grid">
        {times.map((t, i) => (
          <motion.button
            key={t}
            custom={i}
            variants={cardVariants}
            initial="initial"
            animate="animate"
            onClick={() => onTime(t)}
            className={`time-chip ${time === t ? 'time-chip-active' : ''}`}
          >
            {t}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

// ── STEP 3: Contact Details ───────────────────────────────────────────────────
function StepDetails({ form, onChange }) {
  return (
    <motion.div {...pageVariants} key="step3">
      <h2 className="step-title">Your Details</h2>
      <p className="step-sub">So I know who I'm traveling to</p>

      <div className="form-grid">
        {[
          { id: 'name', label: 'Full Name', type: 'text', placeholder: 'Your name' },
          { id: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com' },
          { id: 'phone', label: 'Phone', type: 'tel', placeholder: '+27 ...' },
          { id: 'address', label: 'Address', type: 'text', placeholder: 'Where I\'ll be coming to' },
        ].map(f => (
          <div key={f.id} className="form-field">
            <label className="form-label" htmlFor={f.id}>{f.label}</label>
            <input
              id={f.id}
              type={f.type}
              value={form[f.id] || ''}
              onChange={e => onChange(f.id, e.target.value)}
              placeholder={f.placeholder}
              className="form-input"
            />
          </div>
        ))}
        <div className="form-field form-field-full">
          <label className="form-label" htmlFor="notes">Special Notes <span className="form-optional">(optional)</span></label>
          <textarea
            id="notes"
            value={form.notes || ''}
            onChange={e => onChange('notes', e.target.value)}
            placeholder="Any special requests or access instructions..."
            className="form-input form-textarea"
            rows={3}
          />
        </div>
      </div>
    </motion.div>
  )
}

// ── STEP 4: Payment ───────────────────────────────────────────────────────────
function StepPayment({ selected, date, time, form, onPay, loading }) {
  const subtotal = selected.reduce((s, x) => s + x.price, 0)
  const deposit = selected.reduce((s, x) => s + x.deposit, 0)
  const dateStr = date ? `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MON_NAMES[date.getMonth()]} ${date.getFullYear()}` : ''

  return (
    <motion.div {...pageVariants} key="step4">
      <h2 className="step-title">Confirm & Pay Deposit</h2>
      <p className="step-sub">A deposit secures your booking</p>

      <div className="summary-card">
        <div className="summary-section">
          <h3 className="summary-heading">Services</h3>
          {selected.map(s => (
            <div key={s.id} className="summary-row">
              <span>{s.name}</span>
              <span>{formatZAR(s.price)}</span>
            </div>
          ))}
          <div className="summary-divider" />
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{formatZAR(subtotal)}</span>
          </div>
        </div>

        <div className="summary-section">
          <h3 className="summary-heading">Appointment</h3>
          <div className="summary-row"><span>Date</span><span>{dateStr}</span></div>
          <div className="summary-row"><span>Time</span><span>{time}</span></div>
          <div className="summary-row"><span>Location</span><span>{form.address || '—'}</span></div>
        </div>

        <div className="deposit-box">
          <div className="deposit-label">Deposit Required Today</div>
          <div className="deposit-amount">{formatZAR(deposit)}</div>
          <div className="deposit-note">Balance of {formatZAR(subtotal - deposit)} due on the day</div>
        </div>
      </div>

      <motion.button
        onClick={onPay}
        disabled={loading}
        className="btn-pay"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {loading ? (
          <span className="btn-loading">Processing<span className="dots">...</span></span>
        ) : (
          <>Pay Deposit · {formatZAR(deposit)}</>
        )}
      </motion.button>

      <p className="pay-note">Secured by Yoco · Your card details are never stored</p>
    </motion.div>
  )
}

// ── CART TRAY ─────────────────────────────────────────────────────────────────
function CartTray({ selected, step }) {
  if (selected.length === 0 || step > 3) return null
  const total = selected.reduce((s, x) => s + x.price, 0)
  const deposit = selected.reduce((s, x) => s + x.deposit, 0)

  return (
    <motion.div
      className="cart-tray"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      <div className="cart-left">
        <span className="cart-count">{selected.length} service{selected.length !== 1 ? 's' : ''}</span>
        <span className="cart-services">{selected.map(s => s.name).join(', ')}</span>
      </div>
      <div className="cart-right">
        <span className="cart-total">{formatZAR(total)}</span>
        <span className="cart-deposit">deposit {formatZAR(deposit)}</span>
      </div>
    </motion.div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState([])
  const [date, setDate] = useState(null)
  const [time, setTime] = useState(null)
  const [form, setForm] = useState({})
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(false)

  function showToast(msg) { setToast(msg) }

  function toggleService(svc) {
    setSelected(prev => {
      const exists = prev.find(s => s.id === svc.id)
      return exists ? prev.filter(s => s.id !== svc.id) : [...prev, svc]
    })
  }

  function canNext() {
    if (step === 1) return selected.length > 0
    if (step === 2) return date && time
    if (step === 3) return form.name && form.email && form.phone && form.address
    return false
  }

  function next() {
    if (!canNext()) { showToast(step === 1 ? 'Please select at least one service' : step === 2 ? 'Please pick a date and time' : 'Please fill in all required fields'); return }
    setStep(s => s + 1)
  }

  function back() { setStep(s => Math.max(1, s - 1)) }

  function updateForm(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  async function handlePay() {
    setLoading(true)
    try {
      const deposit = selected.reduce((s, x) => s + x.deposit, 0)
      const dateStr = `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MON_NAMES[date.getMonth()]} ${date.getFullYear()}`
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: deposit * 100,
          currency: 'ZAR',
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          notes: form.notes,
          date: dateStr,
          time,
          services: selected.map(s => s.name).join(', '),
          serviceDetails: selected
        })
      })
      const data = await res.json()
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        showToast('Payment setup failed. Please try again.')
        setLoading(false)
      }
    } catch {
      showToast('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="app-root">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <GlassShell>
        <Header step={step} />

        <div className="step-content">
          <AnimatePresence mode="wait">
            {step === 1 && <StepServices key={1} selected={selected} onSelect={toggleService} />}
            {step === 2 && <StepDateTime key={2} date={date} time={time} onDate={setDate} onTime={setTime} />}
            {step === 3 && <StepDetails key={3} form={form} onChange={updateForm} />}
            {step === 4 && <StepPayment key={4} selected={selected} date={date} time={time} form={form} onPay={handlePay} loading={loading} />}
          </AnimatePresence>
        </div>

        <div className="action-bar">
          {step > 1 && (
            <motion.button onClick={back} className="btn-back" whileTap={{ scale: 0.97 }}>
              ← Back
            </motion.button>
          )}
          {step < 4 && (
            <motion.button
              onClick={next}
              disabled={!canNext()}
              className={`btn-next ${canNext() ? 'btn-next-active' : 'btn-next-disabled'}`}
              whileHover={canNext() ? { scale: 1.02 } : {}}
              whileTap={canNext() ? { scale: 0.98 } : {}}
            >
              {step === 3 ? 'Review Booking →' : 'Continue →'}
            </motion.button>
          )}
        </div>

        <CartTray selected={selected} step={step} />

        <AnimatePresence>
          {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
        </AnimatePresence>
      </GlassShell>
    </div>
  )
}