import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── ANIMATION VARIANTS ───────────────────────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -12 }
}

const cardEnter = {
  initial: { opacity: 0, y: 28, scale: 0.98 },
  animate: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
  }
}

const stagger = (i, base = 0.08) => ({
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1, y: 0,
    transition: { delay: i * base, duration: 0.5, ease: [0.22, 1, 0.36, 1] }
  }
})

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtDate(ds) {
  if (!ds) return '—'
  const [y, m, d] = ds.split('-').map(Number)
  const dt  = new Date(y, m - 1, d)
  const DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${DAY[dt.getDay()]}, ${d} ${MON[m - 1]} ${y}`
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <motion.div
      className="mx-auto mb-4 w-5 h-5 rounded-full border-2"
      style={{
        borderColor: 'rgba(255,255,255,0.1)',
        borderTopColor: 'rgba(255,255,255,0.6)'
      }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.85, ease: 'linear' }}
    />
  )
}

function Hairline() {
  return (
    <div
      className="w-10 h-px mx-auto my-7"
      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }}
    />
  )
}

function DetailRow({ label, value, index }) {
  return (
    <motion.div
      {...stagger(index)}
      className="flex items-baseline justify-between gap-3 mb-2.5 last:mb-0"
    >
      <span
        className="text-[11px] font-medium tracking-[0.06em] whitespace-nowrap"
        style={{ color: 'rgba(255,255,255,0.30)' }}
      >
        {label}
      </span>
      <span
        className="font-light text-right flex-1"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '15px',
          color: 'rgba(255,255,255,0.88)'
        }}
      >
        {value}
      </span>
    </motion.div>
  )
}

function NextItem({ label, children, index }) {
  return (
    <motion.div {...stagger(index, 0.1)} className="flex gap-3.5 mb-3.5 last:mb-0 items-start">
      <motion.div
        className="w-1 h-1 rounded-full flex-shrink-0 mt-2"
        style={{ background: 'rgba(255,255,255,0.40)' }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: index * 0.1 + 0.3, type: 'spring', stiffness: 300 }}
      />
      <div>
        <div
          className="text-[10px] font-bold tracking-[0.08em] uppercase mb-0.5"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          {label}
        </div>
        <div
          className="text-[12.5px] font-normal leading-[1.65]"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          {children}
        </div>
      </div>
    </motion.div>
  )
}

// ─── LOADING STATE ────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <motion.div
      key="loading"
      {...fadeUp}
      transition={{ duration: 0.4 }}
      className="text-center py-10"
      style={{ color: 'rgba(255,255,255,0.30)', fontSize: '12px', letterSpacing: '0.06em' }}
    >
      <Spinner />
      Retrieving your booking…
    </motion.div>
  )
}

// ─── PAGE CONTENT ─────────────────────────────────────────────────────────────
function PageContent({ data }) {
  const date    = data?.date     ? fmtDate(data.date) : '—'
  const time    = data?.time     ? data.time           : '—'
  const service = data?.services ? data.services        : '—'
  const dep     = data?.deposit  ? `R${data.deposit}`  : null
  const ref     = data?.bookingId ? data.bookingId      : ''
  const appBase = data?.appBase  ? data.appBase         : '/'

  return (
    <motion.div
      key="content"
      initial="initial"
      animate="animate"
      variants={{ animate: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* ── Hero ── */}
      <motion.div {...stagger(0)} className="text-center mb-7">
        <div
          className="text-[11px] font-normal italic tracking-[0.22em] uppercase mb-2.5"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            color: 'rgba(255,255,255,0.35)'
          }}
        >
          A date with yourself
        </div>
        <h1
          className="font-light leading-[1.15] mb-2"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '32px',
            color: 'rgba(255,255,255,0.97)',
            letterSpacing: '0.01em'
          }}
        >
          I see you<br />choosing you.
        </h1>
        <p
          className="font-light italic tracking-[0.03em]"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '16px',
            color: 'rgba(255,255,255,0.45)'
          }}
        >
          Your space is officially held.
        </p>
      </motion.div>

      {/* ── Body copy ── */}
      <motion.p
        {...stagger(1)}
        className="text-center text-[13px] font-normal leading-[1.80] mb-7"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        I've received your deposit, and your space in my calendar is now officially held.
        <br /><br />
        This isn't just a booking; it's a promise you've made to yourself to pause,
        and I am so honored to be the one holding that space for you.
      </motion.p>

      {/* ── Booking Details Box ── */}
      <motion.div
        {...stagger(2)}
        className="rounded-2xl p-5 mb-7"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '0.5px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}
      >
        <div
          className="text-[8px] font-bold tracking-[0.28em] uppercase mb-3.5"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Your Appointment
        </div>
        <DetailRow label="Date"    value={date}    index={0} />
        <DetailRow label="Time"    value={time}    index={1} />
        <DetailRow label="Service" value={service} index={2} />
      </motion.div>

      {/* ── Deposit Badge ── */}
      <AnimatePresence>
        {dep && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-between rounded-2xl px-4 py-3.5 mb-5"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '0.5px solid rgba(255,255,255,0.10)'
            }}
          >
            <div>
              <div
                className="text-[10px] font-semibold tracking-[0.06em]"
                style={{ color: 'rgba(255,255,255,0.30)' }}
              >
                Deposit Received ✓
              </div>
            </div>
            <div
              className="font-medium"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: '20px',
                color: 'rgba(255,255,255,0.90)'
              }}
            >
              {dep}
            </div>
            <motion.div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.10)' }}
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 260 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.70)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── What Happens Next ── */}
      <motion.div {...stagger(3)} className="mb-7">
        <div
          className="text-[8px] font-bold tracking-[0.28em] uppercase mb-4"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          What happens next
        </div>
        <NextItem label="The Arrival" index={0}>
          I'll be traveling on{' '}
          <strong style={{ color: 'rgba(255,255,255,0.80)', fontWeight: 600 }}>{date}</strong>
          {' '}at{' '}
          <strong style={{ color: 'rgba(255,255,255,0.80)', fontWeight: 600 }}>{time}</strong>.
        </NextItem>
        <NextItem label="The Space" index={1}>
          No need to overthink it — just find a spot where you feel most at peace, and I'll handle the rest.
        </NextItem>
        <NextItem label="The Intent" index={2}>
          Bring nothing but yourself.
        </NextItem>
      </motion.div>

      {/* ── Closing ── */}
      <motion.div
        {...stagger(4)}
        className="pt-6 mb-7"
        style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}
      >
        <p
          className="text-center text-[12.5px] font-normal leading-[1.80] mb-5"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          We spend so much of our lives pouring into others.<br />
          Thank you for trusting me to pour back into you.
          <br /><br />
          I'm looking forward to our time together.<br />
          Until then, keep choosing yourself in the small moments, too.
        </p>
        <div
          className="text-center font-light italic"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '18px',
            color: 'rgba(255,255,255,0.60)'
          }}
        >
          Toodles. 🌸
        </div>
      </motion.div>

      {/* ── CTA ── */}
      <motion.div {...stagger(5)}>
        <motion.a
          href={appBase}
          className="block w-full text-center rounded-2xl py-3.5 text-[13px] font-semibold tracking-[0.08em] uppercase no-underline"
          style={{
            background: 'linear-gradient(160deg, #1c1c1e 0%, #0a0a0a 100%)',
            color: 'rgba(255,255,255,0.90)',
            boxShadow: '0 0 0 0.5px rgba(255,255,255,0.12) inset, 0 1px 0 rgba(255,255,255,0.08) inset, 0 10px 30px rgba(0,0,0,0.50)'
          }}
          whileHover={{
            translateY: -2,
            boxShadow: '0 0 0 0.5px rgba(255,255,255,0.14) inset, 0 16px 40px rgba(0,0,0,0.60)'
          }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          Book Another Treatment
        </motion.a>
        {ref && (
          <p
            className="text-center mt-4 tracking-[0.04em]"
            style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)' }}
          >
            Booking ref: {ref}
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Thankyou() {
  const [bookingData, setBookingData] = useState(null)
  const [status, setStatus]           = useState('loading') // 'loading' | 'ready'

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search)
    const pRef    = params.get('ref')
    let   attempts = 0
    const MAX = 6, DELAY = 2500

    function tryFetch() {
      if (!pRef) { setBookingData(null); setStatus('ready'); return }
      fetch('/api/check-payment?ref=' + encodeURIComponent(pRef))
        .then(r => r.json())
        .then(data => {
          setBookingData(data)
          setStatus('ready')
          // silent retry if deposit not yet confirmed
          if (data?.depositStatus !== 'Paid' && attempts < MAX) {
            attempts++
            setTimeout(() => {
              fetch('/api/check-payment?ref=' + encodeURIComponent(pRef))
                .then(r => r.json())
                .then(updated => { if (updated?.deposit) setBookingData(updated) })
                .catch(() => {})
            }, DELAY * 2)
          }
        })
        .catch(() => {
          if (attempts < MAX) { attempts++; setTimeout(tryFetch, DELAY) }
          else { setBookingData(null); setStatus('ready') }
        })
    }

    tryFetch()
  }, [])

  return (
    <>
      {/* Google Fonts — matches existing app palette */}
      <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Full-page obsidian background — matches design spec */}
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: [
            'radial-gradient(ellipse at 20%  0%,  rgba(255,255,255,0.065) 0%, transparent 40%)',
            'radial-gradient(ellipse at 80%  0%,  rgba(255,255,255,0.045) 0%, transparent 36%)',
            'radial-gradient(ellipse at 50% 45%,  rgba(255,255,255,0.025) 0%, transparent 50%)',
            'radial-gradient(ellipse at  5% 95%,  rgba(255,255,255,0.055) 0%, transparent 36%)',
            'radial-gradient(ellipse at 95% 95%,  rgba(255,255,255,0.040) 0%, transparent 36%)',
            'radial-gradient(ellipse at 50% 50%,  rgba(30,30,30,0.80)     0%, transparent 70%)',
            '#04040a'
          ].join(', '),
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="w-full min-h-screen flex items-start justify-center px-4 py-8 sm:py-12">

          {/* ── Glass Card ── */}
          <motion.div
            variants={cardEnter}
            initial="initial"
            animate="animate"
            className="relative w-full overflow-hidden"
            style={{
              maxWidth: '480px',
              borderRadius: '28px',
              padding: '36px 28px 40px',
              background: 'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(72px) saturate(200%)',
              WebkitBackdropFilter: 'blur(72px) saturate(200%)',
              boxShadow: [
                '0 0 0 0.5px rgba(255,255,255,0.20) inset',
                '0 1px 0   rgba(255,255,255,0.14) inset',
                '0 0 0 0.5px rgba(255,255,255,0.06)',
                '0 28px 80px rgba(0,0,0,0.70)',
                '0 4px  16px rgba(0,0,0,0.50)'
              ].join(', ')
            }}
          >
            {/* Prismatic top highlight */}
            <div
              className="absolute top-0 left-[8%] right-[8%] h-px pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.50) 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.50) 70%, transparent)'
              }}
            />

            {/* ── Header ── */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Logo */}
              <div
                className="relative w-[68px] h-[68px] rounded-[22px] p-0.5 mx-auto mb-3.5"
                style={{
                  background: 'linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 100%)',
                  boxShadow: '0 0 0 0.5px rgba(255,255,255,0.16) inset, 0 8px 28px rgba(0,0,0,0.60), 0 2px 8px rgba(0,0,0,0.40)'
                }}
              >
                <div
                  className="absolute inset-0 rounded-[22px] pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)' }}
                />
                <img
                  src="https://iili.io/fpiAjBj.jpg"
                  alt="PhenomeBeauty"
                  className="w-full h-full object-cover block"
                  style={{ borderRadius: '19px' }}
                />
              </div>

              <div
                className="text-center mb-1 tracking-[0.01em]"
                style={{
                  fontFamily: "'Abril Fatface', Georgia, serif",
                  fontSize: '20px',
                  fontWeight: 400,
                  color: 'rgba(255,255,255,0.90)'
                }}
              >
                PhenomeBeauty
              </div>
              <div
                className="text-center mb-7"
                style={{
                  fontFamily: "'Jost', sans-serif",
                  fontSize: '8.5px',
                  fontWeight: 600,
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.30)'
                }}
              >
                Mobile Beauty Studio
              </div>
            </motion.div>

            <Hairline />

            {/* ── Dynamic Content ── */}
            <AnimatePresence mode="wait">
              {status === 'loading'
                ? <LoadingState key="loading" />
                : <PageContent  key="content" data={bookingData} />
              }
            </AnimatePresence>

          </motion.div>
        </div>
      </div>
    </>
  )
}
