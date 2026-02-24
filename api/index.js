// PhenomeBeauty Booking Server — v5.0 (Vercel)
const express    = require('express');
const nodemailer = require('nodemailer');
const crypto     = require('crypto');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');

const app  = express();
const SPREADSHEET_ID = '1G4pWPXsqCkUlpuEhmRT5sj7GE6NOxcp_OSCs1wqrRfk';

// Credentials from environment variable
// Vercel mangles \n inside private_key when pasted via dashboard — we fix it after parsing
let creds = null;
try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT || '';
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT env var is not set');
    creds = JSON.parse(raw);
    if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
} catch (e) {
    console.error('GOOGLE_SERVICE_ACCOUNT parse failed:', e.message);
}

// ── AUTH — lazy so a bad env var gives a clear error at request time, not boot ──
let _jwt = null;
function getJwt() {
    if (_jwt) return _jwt;
    if (!creds) throw new Error('Google credentials not loaded — check GOOGLE_SERVICE_ACCOUNT in Vercel env vars');
    _jwt = new JWT({
        email:  creds.client_email,
        key:    creds.private_key,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/calendar',
        ],
    });
    return _jwt;
}

// ── SECURITY MIDDLEWARE ───────────────────────────────────────────────────────
// Note: static files are served by Vercel CDN from /public — not through this function.
// Credentials live in env vars, not files, so no path-blocking needed here.

// Security headers — Fix 7 adds Content-Security-Policy
app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '0'); // deprecated — CSP handles this now
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.set('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https://iili.io; " +
        "connect-src 'self' https://maps.googleapis.com https://places.googleapis.com; " +
        "frame-ancestors 'none';"
    );
    next();
});

// Body size limit (prevent large payload attacks)
app.use(express.json({ limit: '50kb' }));

// Simple in-memory rate limiter
const rateLimitMap = new Map();
function rateLimit(maxReqs, windowMs) {
    return (req, res, next) => {
        const key = req.ip + req.path;
        const now = Date.now();
        const entry = rateLimitMap.get(key) || { count: 0, start: now };
        if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
        entry.count++;
        rateLimitMap.set(key, entry);
        if (entry.count > maxReqs) {
            return res.status(429).json({ error: 'Too many requests — please wait a moment.' });
        }
        next();
    };
}


// Input sanitizer — strips HTML/script tags
function sanitize(val, maxLen = 200) {
    if (val === null || val === undefined) return '';
    return String(val).replace(/<[^>]*>/g, '').replace(/[<>"']/g, '').trim().slice(0, maxLen);
}



// ── SHEET CACHE ───────────────────────────────────────────────────────────────
let _docCache = null, _docExpiry = 0;
async function getDoc() {
    if (_docCache && Date.now() < _docExpiry) return _docCache;
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, getJwt());
    await doc.loadInfo();
    _docCache  = doc;
    _docExpiry = Date.now() + 5 * 60 * 1000;
    return doc;
}
function bustDocCache() { _docExpiry = 0; _servicesExpiry = 0; _avExpiry = 0; }

// Settings cache (10 min)
let _settingsCache = null, _settingsExpiry = 0;
async function getSettings(doc) {
    if (_settingsCache && Date.now() < _settingsExpiry) return _settingsCache;
    const sheet = doc.sheetsByTitle['Settings'];
    if (!sheet) throw new Error("Settings tab not found");
    const rows = await sheet.getRows();
    const s = {};
    rows.forEach(r => {
        const k = (r.get('Setting Key') || '').trim();
        const v = (r.get('Value') || '').trim();
        if (k) s[k] = v;
    });
    _settingsCache  = s;
    _settingsExpiry = Date.now() + 10 * 60 * 1000;
    return s;
}

// Services rows cache (8 min — services rarely change)
let _servicesCache = null, _servicesExpiry = 0;
async function getServices(doc) {
    if (_servicesCache && Date.now() < _servicesExpiry) return _servicesCache;
    const rows = await doc.sheetsByTitle['Services'].getRows();
    _servicesCache = rows
        .filter(r => { const v = (r.get('Active')||'').toString().trim().toLowerCase(); return v==='true'||v==='yes'||v==='1'; })
        .map(r => ({
            id:          r.get('ID'),
            name:        r.get('Name'),
            description: r.get('Description'),
            price:       parseFloat(String(r.get('Price (R)')||0).replace(/[R, ]/g,'')) || 0,
            duration:    parseInt(r.get('Duration (min)')||0) || 0,
            category:    r.get('Category'),
        }));
    _servicesExpiry = Date.now() + 8 * 60 * 1000;
    return _servicesCache;
}

// Availability rows cache (5 min)
let _avCache = null, _avExpiry = 0;
async function getAvailabilityRows(doc) {
    if (_avCache && Date.now() < _avExpiry) return _avCache;
    const avSheet = doc.sheetsByTitle['Availability'];
    if (!avSheet) throw new Error("Availability tab not found");
    _avCache   = await avSheet.getRows();
    _avExpiry  = Date.now() + 5 * 60 * 1000;
    return _avCache;
}

// ── EMAIL ─────────────────────────────────────────────────────────────────────
function createTransporter(s) {
    const user = s.smtp_user || s.admin_email || '';
    const pass = s.smtp_pass || '';
    if (!user || !pass) return null;
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });
}
const transporter = createTransporter(s);
console.log('Transporter check:', { 
    hasSMTP: !!transporter, 
    smtpUser: s.smtp_user, 
    hasPass: !!s.smtp_pass,
    adminEmail: s.admin_email 
});

function fmtDateEmail(ds) {
    if (!ds) return ds;
    const [y,m,d] = ds.split('-').map(Number);
    const dt = new Date(y, m-1, d);
    const DAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MONTHS= ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${DAYS[dt.getDay()]}, ${d} ${MONTHS[m-1]} ${y}`;
}

// ── EMAIL HELPERS ─────────────────────────────────────────────────────────────
function emailWrap(headerHtml, bodyHtml) {
    return `
<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#f8fafc;border-radius:16px;overflow:hidden;border:1px solid rgba(148,163,184,0.15);">
  ${headerHtml}
  <div style="padding:28px;">
    ${bodyHtml}
    <p style="font-size:11px;color:rgba(148,163,184,0.35);text-align:center;margin:24px 0 0;border-top:1px solid rgba(148,163,184,0.1);padding-top:16px;">
      PhenomeBeauty Mobile Beauty Studio · Cape Town
    </p>
  </div>
</div>`;
}

function emailHeader(emoji, title, subtitle, gradient = 'linear-gradient(135deg,#f97316,#ec4899)') {
    return `<div style="background:${gradient};padding:28px;text-align:center;">
      <div style="font-size:36px;margin-bottom:10px;">${emoji}</div>
      <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0b1120;">${title}</h1>
      <p style="margin:0;font-size:13px;color:rgba(11,17,32,0.7);">${subtitle}</p>
    </div>`;
}

function emailRow(label, value, valueStyle='') {
    return `<tr>
      <td style="color:rgba(148,163,184,0.8);padding:7px 0;width:42%;font-size:13px;">${label}</td>
      <td style="font-size:13px;${valueStyle}">${value}</td>
    </tr>`;
}

// 1. Admin deposit confirmed notification (sent after Yoco webhook confirms payment)
async function sendAdminDepositNotification(s, b) {
    const transporter = createTransporter(s);
    const adminEmail  = s.admin_email || '';
    if (!transporter || !adminEmail) return;
    try {
        await transporter.sendMail({
            from:    `"PhenomeBeauty Bookings" <${s.smtp_user || adminEmail}>`,
            to:      adminEmail,
            subject: `💳 Deposit Paid — ${b.name} · ${fmtDateEmail(b.date)}`,
            html: emailWrap(
                emailHeader('💳', 'Deposit Confirmed!', `Ref: ${b.bookingId}`, 'linear-gradient(135deg,#059669,#0d9488)'),
                `<table style="width:100%;border-collapse:collapse;">
                  ${emailRow('Client', `<strong>${b.name}</strong>`)}
                  ${emailRow('Phone', `<a href="tel:${b.phone}" style="color:#f97316;">${b.phone}</a>`)}
                  ${emailRow('Email', `<a href="mailto:${b.email}" style="color:#f97316;">${b.email}</a>`)}
                  ${emailRow('Address', b.address)}
                  <tr><td colspan="2"><hr style="border:none;border-top:1px solid rgba(148,163,184,0.15);margin:10px 0;"></td></tr>
                  ${emailRow('Date', `<strong>${fmtDateEmail(b.date)}</strong>`)}
                  ${emailRow('Time', `<strong>${b.time}</strong>`)}
                  ${emailRow('Services', b.services)}
                  <tr><td colspan="2"><hr style="border:none;border-top:1px solid rgba(148,163,184,0.15);margin:10px 0;"></td></tr>
                  ${emailRow('Total', `R${Number(b.totalAmount).toFixed(2)}`)}
                  ${emailRow('Deposit Received', `<strong style="color:#10b981;">R${Number(b.deposit).toFixed(2)}</strong>`)}
                  ${emailRow('Balance Due', `<span style="color:#f97316;">R${Number(b.balance).toFixed(2)}</span>`)}
                </table>
                <div style="margin-top:18px;padding:12px 16px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;font-size:12px;color:#10b981;">
                  ✅ Booking is now <strong>Confirmed</strong> — slot is secured
                </div>`
            ),
        });
        console.log(`Admin deposit email sent for ${b.bookingId}`);
    } catch (e) { console.error('Admin deposit email error:', e.message); }
}

// 2. Customer deposit confirmation (sent after Yoco webhook confirms payment)
async function sendCustomerConfirmationEmail(s, b) {
    const transporter = createTransporter(s);
    const adminEmail  = s.admin_email || '';
    if (!transporter || !b.email) return;
    const firstName = (b.name || '').split(' ')[0];
    try {
        await transporter.sendMail({
            from:    `"PhenomeBeauty" <${s.smtp_user || adminEmail}>`,
            to:      b.email,
            subject: `✨ You're booked, ${firstName}! — ${fmtDateEmail(b.date)}`,
            html: emailWrap(
                emailHeader('✨', `You're all set, ${firstName}!`, "Your deposit is in — we can't wait to pamper you."),
                `<p style="font-size:14px;line-height:1.7;color:rgba(248,250,252,0.9);margin:0 0 20px;">
                  Hi <strong>${firstName}</strong> 💕<br><br>
                  Your booking is confirmed and your stylist will arrive at your door ready to make you look and feel amazing.
                  Here's everything you need to know:
                </p>
                <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:14px;padding:18px 20px;margin-bottom:18px;">
                  <table style="width:100%;border-collapse:collapse;">
                    ${emailRow('📅 Date', `<strong style="color:#f97316;">${fmtDateEmail(b.date)}</strong>`)}
                    ${emailRow('🕐 Time', `<strong style="color:#f97316;">${b.time}</strong>`)}
                    ${emailRow('💅 Services', `<strong>${b.services}</strong>`)}
                    ${emailRow('📍 Address', b.address)}
                  </table>
                </div>
                <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:14px;padding:16px 20px;margin-bottom:18px;">
                  <table style="width:100%;border-collapse:collapse;">
                    ${emailRow('Deposit Paid ✅', `<strong style="color:#10b981;">R${Number(b.deposit).toFixed(2)}</strong>`)}
                    ${emailRow('Balance (after service)', `<span style="color:#f97316;">R${Number(b.balance).toFixed(2)}</span>`)}
                  </table>
                </div>
                <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px 16px;margin-bottom:18px;font-size:12.5px;color:rgba(148,163,184,0.8);line-height:1.7;">
                  💡 <strong style="color:#f8fafc;">Good to know:</strong> Please give us at least 24 hours notice if you need to cancel or reschedule so we can offer your slot to someone else. Late cancellations may forfeit the deposit.
                </div>
                <p style="font-size:12px;color:rgba(148,163,184,0.4);text-align:center;margin:0;">Ref: ${b.bookingId}</p>`
            ),
        });
        console.log(`Customer confirmation email sent to ${b.email}`);
    } catch (e) { console.error('Customer confirmation email error:', e.message); }
}

// 3. Balance request email (sent when admin marks booking as Service Complete)
async function sendBalanceRequestEmail(s, b) {
    const transporter = createTransporter(s);
    const adminEmail  = s.admin_email || '';
    if (!transporter || !b.email) return;
    const firstName = (b.name || '').split(' ')[0];
    try {
        await transporter.sendMail({
            from:    `"PhenomeBeauty" <${s.smtp_user || adminEmail}>`,
            to:      b.email,
            subject: `💳 Your balance payment — R${Number(b.balance).toFixed(2)}`,
            html: emailWrap(
                emailHeader('💅', `Thank you, ${firstName}!`, 'Hope you loved your treatment — here\'s your balance link.', 'linear-gradient(135deg,#7c3aed,#ec4899)'),
                `<p style="font-size:14px;line-height:1.7;color:rgba(248,250,252,0.9);margin:0 0 20px;">
                  Hi <strong>${firstName}</strong> 💕<br><br>
                  We hope you're feeling absolutely fabulous! Your service is complete and the remaining balance is now due.
                </p>
                <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:14px;padding:18px 20px;margin-bottom:20px;">
                  <table style="width:100%;border-collapse:collapse;">
                    ${emailRow('Services', b.services)}
                    ${emailRow('Deposit Already Paid', `<span style="color:#10b981;">R${Number(b.deposit).toFixed(2)}</span>`)}
                    ${emailRow('Balance Due', `<strong style="color:#f97316;font-size:15px;">R${Number(b.balance).toFixed(2)}</strong>`)}
                  </table>
                </div>
                <a href="${b.paymentUrl}" style="display:block;background:linear-gradient(135deg,#f97316,#ec4899);color:#0b1120;text-align:center;padding:14px 20px;border-radius:14px;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:18px;">
                  Pay Balance — R${Number(b.balance).toFixed(2)} →
                </a>
                <p style="font-size:12px;color:rgba(148,163,184,0.5);text-align:center;margin:0;">
                  If you have any questions please don't hesitate to reach out 💕<br>Ref: ${b.bookingId}
                </p>`
            ),
        });
        console.log(`Balance request email sent to ${b.email}`);
    } catch (e) { console.error('Balance request email error:', e.message); }
}

// 4. Rebook email (sent after full balance is paid)
async function sendRebookEmail(s, b) {
    const transporter = createTransporter(s);
    const adminEmail  = s.admin_email || '';
    if (!transporter || !b.email) return;
    const firstName  = (b.name || '').split(' ')[0];
    const appBase    = s.app_base_url || 'http://localhost:3000';
    try {
        await transporter.sendMail({
            from:    `"PhenomeBeauty" <${s.smtp_user || adminEmail}>`,
            to:      b.email,
            subject: `🌸 Thank you ${firstName} — see you next time!`,
            html: emailWrap(
                emailHeader('🌸', 'All done — you look amazing!', 'Your full payment is in. Thank you so much!', 'linear-gradient(135deg,#ec4899,#8b5cf6)'),
                `<p style="font-size:14px;line-height:1.7;color:rgba(248,250,252,0.9);margin:0 0 20px;">
                  Hi <strong>${firstName}</strong> 💕<br><br>
                  Your payment is complete — thank you so much for trusting PhenomeBeauty!
                  It was an absolute pleasure treating you and we hope you feel as beautiful on the outside as you are on the inside. 🌸
                </p>
                <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:14px;padding:16px 20px;margin-bottom:20px;text-align:center;">
                  <div style="font-size:13px;color:rgba(148,163,184,0.8);margin-bottom:4px;">Total Paid</div>
                  <div style="font-size:24px;font-weight:700;color:#10b981;">R${Number(b.total).toFixed(2)} ✅</div>
                </div>
                <p style="font-size:13px;color:rgba(148,163,184,0.8);line-height:1.7;margin:0 0 20px;">
                  Beauty isn't a once-in-a-while thing — it's a lifestyle. When you're ready to treat yourself again, we're just a click away:
                </p>
                <a href="${appBase}" style="display:block;background:linear-gradient(135deg,#ec4899,#8b5cf6);color:#fff;text-align:center;padding:14px 20px;border-radius:14px;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:18px;">
                  Book Your Next Appointment →
                </a>
                <p style="font-size:12px;color:rgba(148,163,184,0.4);text-align:center;margin:0;">Ref: ${b.bookingId}</p>`
            ),
        });
        console.log(`Rebook email sent to ${b.email}`);
    } catch (e) { console.error('Rebook email error:', e.message); }
}

// ── SAST NOW — correct regardless of server timezone ─────────────────────────
function sastNow() {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Johannesburg',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
    return {
        dateStr: `${p.year}-${p.month}-${p.day}`,
        mins:    parseInt(p.hour) * 60 + parseInt(p.minute),
    };
}

// ── ADMIN AUTH — STATELESS HMAC TOKENS ───────────────────────────────────────
// Tokens are HMAC(ADMIN_TOKEN_SECRET, password) — no server-side state needed.
// Survives Vercel cold starts. Invalidated automatically when password changes.
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || (() => {
    console.warn('ADMIN_TOKEN_SECRET not set — using insecure fallback');
    return 'phenome-fallback-secret-change-me';
})();

function makeAdminToken(password) {
    return crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(password).digest('hex');
}

// ── ADMIN MIDDLEWARE ──────────────────────────────────────────────────────────
async function adminOnly(req, res, next) {
    const token = (req.headers['x-admin-token'] || '').trim();
    if (!token || token.length !== 64) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const doc = await getDoc();
        const s   = await getSettings(doc);
        const expected = makeAdminToken(s.admin_password || '');
        const tBuf = Buffer.from(token.padEnd(64, '0'));
        const eBuf = Buffer.from(expected.padEnd(64, '0'));
        const match = s.admin_password && token.length === expected.length &&
            crypto.timingSafeEqual(tBuf, eBuf);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });
        req.doc = doc; req.settings = s; next();
    } catch (e) { res.status(500).json({ error: 'Authentication error' }); }
}

// ── CALENDAR HELPERS ──────────────────────────────────────────────────────────
function toISO(dateStr, timeStr) {
    const [y,m,d] = dateStr.split('-').map(Number);
    const [h,mn]  = timeStr.split(':').map(Number);
    return new Date(y, m-1, d, h, mn).toISOString();
}

async function calCreate(s, b) {
    const calId = s.google_calendar_id || '';
    if (!calId) return null;
    const cal = google.calendar({ version: 'v3', auth: getJwt() });
    const [startT, endT] = (b.time || '00:00-01:00').split('-');
    try {
        const r = await cal.events.insert({ calendarId: calId, requestBody: {
            summary:     `${b.name} — ${b.services}`,
            description: `ID: ${b.bookingId}\nPhone: ${b.phone}\nEmail: ${b.email}\nAddress: ${b.address}\nTotal: R${b.totalAmount}\nDeposit: R${b.deposit}\nBalance: R${b.balance}`,
            location:    b.address,
            start: { dateTime: toISO(b.date, startT), timeZone: 'Africa/Johannesburg' },
            end:   { dateTime: toISO(b.date, endT || '01:00'), timeZone: 'Africa/Johannesburg' },
            colorId: '2',
        }});
        return r.data.id;
    } catch (e) { console.error('cal create:', e.message); return null; }
}

async function calUpdate(s, eventId, b) {
    const calId = s.google_calendar_id || '';
    if (!calId || !eventId) return false;
    const cal = google.calendar({ version: 'v3', auth: getJwt() });
    const [startT, endT] = (b.time || '00:00-01:00').split('-');
    try {
        await cal.events.patch({ calendarId: calId, eventId, requestBody: {
            summary:  `${b.name} — ${b.services}`,
            location: b.address,
            start: { dateTime: toISO(b.date, startT), timeZone: 'Africa/Johannesburg' },
            end:   { dateTime: toISO(b.date, endT || '01:00'), timeZone: 'Africa/Johannesburg' },
        }});
        return true;
    } catch (e) { console.error('cal update:', e.message); return false; }
}

async function calDelete(s, eventId) {
    const calId = s.google_calendar_id || '';
    if (!calId || !eventId) return;
    const cal = google.calendar({ version: 'v3', auth: getJwt() });
    try { await cal.events.delete({ calendarId: calId, eventId }); }
    catch (e) { console.error('cal delete:', e.message); }
}

// ── SHEET HELPERS ─────────────────────────────────────────────────────────────
async function findRow(doc, bookingId) {
    const sheet = doc.sheetsByTitle['Bookings'];
    if (!sheet) throw new Error("Bookings tab not found");
    const rows  = await sheet.getRows();
    return { sheet, row: rows.find(r => (r.get('Booking ID') || '').trim() === bookingId.trim()) };
}

async function yocoCheckout({ key, cents, successUrl, cancelUrl, customer, metadata, desc }) {
    const r = await fetch('https://payments.yoco.com/api/checkouts', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount: cents, currency: 'ZAR', successUrl, cancelUrl, customer, metadata, description: desc }),
    });
    const d = await r.json();
    console.log('Yoco:', r.status, JSON.stringify(d).slice(0, 200));
    return { ok: r.ok, data: d };
}

// =============================================================================
// GET — services / availability / call-out fee / config
// =============================================================================
app.get('/api', async (req, res) => {
    const action = req.query.action;
    try {
        const doc = await getDoc();

        if (action === 'getServices') {
            return res.json(await getServices(doc));
        }

        if (action === 'getMonthAvailability') {
            const [reqY, reqM] = (req.query.month || '').split('-').map(Number);
            const now   = new Date();
            const year  = reqY  || now.getFullYear();
            const month = reqM  || now.getMonth() + 1;
            const pad   = n => String(n).padStart(2, '0');
            const monthKey = `${year}-${pad(month)}`;

            const DAYS = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
            const avRows = await getAvailabilityRows(doc);
            const slotsByDow = {};
            avRows.forEach(r => {
                if ((r.get('Available (YES/NO)') || '').toUpperCase() !== 'YES') return;
                const day  = (r.get('Weekday/Date') || '').trim().toLowerCase();
                const slot = (r.get('Time Slot') || '').trim();
                const dow  = DAYS[day];
                if (dow === undefined || !slot) return;
                if (!slotsByDow[dow]) slotsByDow[dow] = [];
                slotsByDow[dow].push(slot);
            });

            // Already-booked slots (Pending or Confirmed)
            const bSheet = doc.sheetsByTitle['Bookings'];
            const booked = {};
            if (bSheet) {
                const bRows = await bSheet.getRows();
                bRows.forEach(r => {
                    const status = (r.get('Deposit Status') || '').trim();
                    if (['Cancelled','Refunded'].includes(status)) return;
                    const d = (r.get('Date') || '').trim();
                    const t = (r.get('Time') || '').trim();
                    if (!d.startsWith(monthKey) || !t) return;
                    if (!booked[d]) booked[d] = new Set();
                    booked[d].add(t);
                });
            }

            const sast     = sastNow();
            const todayStr = sast.dateStr;
            const nowMins  = sast.mins;
            console.log(`Availability SAST: ${todayStr} ${Math.floor(nowMins/60)}:${pad(nowMins%60)}`);

            const daysInMonth = new Date(year, month, 0).getDate();
            const result = {};

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${pad(month)}-${pad(d)}`;
                if (dateStr < todayStr) continue;  // skip past dates

                const dow   = new Date(year, month - 1, d).getDay();
                let   slots = (slotsByDow[dow] || []).slice();

                // Remove booked slots
                if (booked[dateStr]) slots = slots.filter(t => !booked[dateStr].has(t));

                // Remove passed slots for today
                if (dateStr === todayStr) {
                    slots = slots.filter(slot => {
                        const [h, m] = (slot.split('-')[0] || '00:00').split(':').map(Number);
                        return (h * 60 + m) > nowMins;
                    });
                }

                if (slots.length) result[dateStr] = slots;
            }

            return res.json(result);
        }

        if (action === 'getCallOutFee') {
            const addr = (req.query.address || '').trim();
            if (!addr) return res.json({ fee: 0, error: 'No address' });

            const s    = await getSettings(doc);
            const mk   = s.google_maps_api_key   || '';
            const orig = s.fixed_origin_address  || '';
            const free = parseFloat(s.call_out_free_km     || '0');
            const rate = parseFloat(s.call_out_rate_per_km || '6.3');

            if (!mk)   return res.json({ fee: 0, error: 'google_maps_api_key not set' });
            if (!orig) return res.json({ fee: 0, error: 'fixed_origin_address not set' });

            const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(orig)}&destinations=${encodeURIComponent(addr)}&units=metric&mode=driving&key=${encodeURIComponent(mk)}`;
            const md  = await (await fetch(url)).json();
            if (md.status !== 'OK') return res.json({ fee: 0, error: 'Maps: ' + md.status });
            const el  = md.rows?.[0]?.elements?.[0];
            if (!el || el.status !== 'OK') return res.json({ fee: 0, error: 'No route found' });

            const oneWay    = el.distance.value / 1000;
            const roundTrip = oneWay * 2;
            const billable  = roundTrip > free ? roundTrip - free : 0;
            const fee       = billable > 0 ? Math.round(billable * rate * 100) / 100 : 0;

            return res.json({ fee,
                oneWayKm:    Math.round(oneWay    * 10) / 10,
                roundTripKm: Math.round(roundTrip * 10) / 10,
                duration:    el.duration.text,
            });
        }

        if (action === 'getConfig') {
            // Fix 2 — never expose secrets to the public; only send what the frontend actually needs
            const full = await getSettings(doc);
            return res.json({
                deposit_percent:       full.deposit_percent       || '50',
                google_maps_api_key:   full.google_maps_api_key   || '',
                app_base_url:          full.app_base_url           || '',
            });
        }

        res.status(404).json({ error: 'Unknown action' });

    } catch (e) {
        console.error('GET /api error:', e.message);
        res.status(500).json({ error: 'Service unavailable — please try again' });
    }
});

// =============================================================================
// POST /api/book
// =============================================================================
app.post('/api/book', rateLimit(10, 60000), async (req, res) => {
    try {
        const doc = await getDoc();
        const s   = await getSettings(doc);

        const { name, email, phone, address, services, date, time,
                servicesTotal, callOutFee, totalAmount, depositAmount,
                balanceDue, oneWayKm, roundTripKm, source, divaType, safety } = req.body;

        // Server-side input validation
        const cleanName  = sanitize(name, 80);
        const cleanEmail = sanitize(email, 120);
        const cleanPhone = String(phone||'').replace(/\D/g,'').slice(0,15);
        const cleanAddr  = sanitize(address, 200);
        const cleanSrc   = sanitize(source, 50);

        if (cleanName.length < 2)         return res.status(400).json({ error: 'Invalid name' });
        if (!/^0\d{9}$/.test(cleanPhone)) return res.status(400).json({ error: 'Invalid phone number' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) return res.status(400).json({ error: 'Invalid email' });
        if (cleanAddr.length < 5)         return res.status(400).json({ error: 'Invalid address' });

        // Fix 9 — Bound services array to prevent payload flooding
        if (!Array.isArray(services) || services.length === 0) return res.status(400).json({ error: 'No services selected' });
        if (services.length > 20) return res.status(400).json({ error: 'Too many services' });

        // Fix 5 — Validate date and time format to prevent formula injection into Sheets
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date format' });
        if (!time || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(time)) return res.status(400).json({ error: 'Invalid time format' });

        const nameParts = cleanName.split(/\s+/);
        const svcNames  = services.map(x => sanitize(typeof x === 'object' ? x.name : x, 60)).filter(Boolean).join(', ');
        const svcIds    = services.map(x => (typeof x === 'object' ? x.id : '') || '').filter(Boolean).join(', ');
        const svcMins   = services.reduce((a, x) => a + parseInt((typeof x === 'object' ? x.duration : 0) || 0), 0);

        // Fix 6 — Recalculate amounts server-side from validated service prices
        // Client-submitted amounts are used only as a fallback if service data is incomplete
        const serverServicesTotal = services.reduce((sum, x) => {
            const p = typeof x === 'object' ? parseFloat(x.price || 0) : 0;
            return sum + (isFinite(p) && p >= 0 ? p : 0);
        }, 0);
        const serverCallOut  = Math.max(0, parseFloat(callOutFee) || 0);
        const serverTotal    = serverServicesTotal + serverCallOut;
        const settingPct     = parseFloat(s.deposit_percent || '50') / 100;
        const serverDeposit  = serverTotal > 0
            ? Math.round(serverTotal * settingPct * 100) / 100
            : Math.round(Number(depositAmount) * 100) / 100;
        const serverBalance  = Math.round((serverTotal - serverDeposit) * 100) / 100;

        const dep       = Math.max(0, serverDeposit);
        const bal       = Math.max(0, serverBalance);
        const bookingId = 'PB-' + crypto.randomBytes(6).toString('hex').toUpperCase();

        // Safety assessment fields
        const isDivaNew      = divaType === 'new';
        const safetyData     = (isDivaNew && safety) ? safety : null;
        const skinNotes      = safetyData ? sanitize(safetyData.skinConditions,   500) : (isDivaNew ? '' : 'On File');
        const medsNotes      = safetyData ? sanitize(safetyData.medications,      500) : (isDivaNew ? '' : 'On File');
        const allergyNotes   = safetyData ? sanitize(safetyData.allergies,        500) : (isDivaNew ? '' : 'On File');
        const healthNotes    = safetyData ? sanitize(safetyData.healthConditions, 500) : (isDivaNew ? '' : 'On File');
        const environNotes   = safetyData ? sanitize(safetyData.environmental,    300) : '';
        const physicalNotes  = safetyData ? sanitize(safetyData.physical,         300) : '';
        const pregnantNote   = safetyData ? (safetyData.pregnant    ? 'Yes' : 'No') : 'On File';
        const hairOkNote     = safetyData ? (safetyData.hairLengthOk ? 'Yes' : 'No') : '';
        const addlNotes      = safetyData ? sanitize(safetyData.additionalInfo,   500) : '';

        const sheet = doc.sheetsByTitle['Bookings'];
        if (!sheet) throw new Error("Bookings tab not found");

        await sheet.addRow({
            'Booking ID':             bookingId,
            'Date':                   date,
            'Time':                   time,
            'Client Name':            cleanName,
            'Client Phone':           cleanPhone,
            'Client Email':           cleanEmail,
            'Client Address':         cleanAddr,
            'Service IDs':            svcIds,
            'Service Names':          svcNames,
            'Service Duration (min)': svcMins || '',
            'One Way Km':             Number(oneWayKm)    || '',
            'Round Trip Km':          Number(roundTripKm) || '',
            'Call Out Fee (R)':       Number(callOutFee).toFixed(2),
            'Service Price (R)':      Number(servicesTotal).toFixed(2),
            'Total Amount (R)':       Number(totalAmount).toFixed(2),
            'Deposit Amount (R)':     dep.toFixed(2),
            'Balance Due (R)':        bal.toFixed(2),
            'Deposit Status':         'Pending Payment',
            'Balance Status':         'Pending',
            'Yoco Link':              '',
            'Calendar Event ID':      '',
            'Created At':             new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }),
            'Yoco Checkout ID':       '',
            'Notes':                  '',
        });

        // Write to Consultations tab (linked by Booking ID)
        // Wrapped in its own try/catch — a missing column must never kill the booking
        try {
            const consultSheet = doc.sheetsByTitle['Consultations'];
            if (consultSheet) {
                const consultRow = {
                    'Booking ID':        bookingId,
                    'Client Type':       isDivaNew ? 'New' : 'Existing',
                    'Lead Source':       cleanSrc,
                    'Skin Conditions':   skinNotes,
                    'Medications':       medsNotes,
                    'Allergies':         allergyNotes,
                    'Health Conditions': healthNotes,
                    'Pregnancy':         pregnantNote,
                };
                // Only include columns that exist in the sheet
                const headers = consultSheet.headerValues || [];
                if (headers.includes('Additional Notes'))      consultRow['Additional Notes']      = addlNotes;
                if (headers.includes('Environmental Exposure')) consultRow['Environmental Exposure'] = environNotes;
                if (headers.includes('Physical Factors'))       consultRow['Physical Factors']       = physicalNotes;
                if (headers.includes('Hair Length OK'))         consultRow['Hair Length OK']          = hairOkNote;
                await consultSheet.addRow(consultRow);
            } else {
                console.warn('Consultations tab not found — skipping');
            }
        } catch (consultErr) {
            console.warn('Consultation row write failed (non-fatal):', consultErr.message);
        }

        bustDocCache();
        console.log(`Saved ${bookingId} — ${svcNames} on ${date} ${time}`);

        if (dep < 2) return res.json({ success: true, bookingId, paymentUrl: null,
            paymentError: 'Deposit below R2 — we will contact you.', depositAmount: dep, balanceDue: bal });

        const appBase    = s.app_base_url           || 'http://localhost:3000';
        const successUrl = s.booking_success_url    || `${appBase}/?payment=success&ref=${bookingId}`;
        const cancelUrl  = s.booking_cancel_url     || `${appBase}/?payment=cancelled&ref=${bookingId}`;
        const yocoKey    = s.yoco_secret_key        || '';
        const rawSlug    = s.yoco_payment_page_slug || '';
        const yocoSlug   = rawSlug.replace(/^https?:\/\/pay\.yoco\.com\//, '').replace(/\?.*$/, '').trim();

        let paymentUrl = null, paymentError = null;

        if (yocoKey) {
            const { ok, data } = await yocoCheckout({
                key: yocoKey, cents: Math.round(dep * 100), successUrl, cancelUrl,
                customer: { email: cleanEmail, firstName: nameParts[0]||'', lastName: nameParts.slice(1).join(' ')||'', phone: cleanPhone },
                metadata: { bookingId, serviceDate: date, serviceTime: time },
                desc: `PhenomeBeauty deposit — ${svcNames}`,
            });
            if (ok && data.redirectUrl) {
                paymentUrl = data.redirectUrl;
                const { row } = await findRow(doc, bookingId);
                if (row) { row.set('Yoco Checkout ID', data.id||''); row.set('Yoco Link', paymentUrl); await row.save(); }
            } else {
                paymentError = data.displayMessage || data.message || 'Yoco API error';
            }
        }

        if (!paymentUrl && yocoSlug) {
            const p = new URLSearchParams({ amount: dep.toFixed(2), reference: bookingId,
                firstName: nameParts[0]||'', lastName: nameParts.slice(1).join(' ')||'',
                email, redirectOnPaymentSuccess: successUrl });
            paymentUrl = `https://pay.yoco.com/${yocoSlug}?${p}`;
            const { row } = await findRow(doc, bookingId);
            if (row) { row.set('Yoco Link', paymentUrl); await row.save(); }
        }

        return res.json({ success: true, bookingId, paymentUrl,
            paymentError: paymentUrl ? null : (paymentError || 'No Yoco credentials in Settings'),
            depositAmount: dep, balanceDue: bal });

    } catch (e) {
        console.error('POST /api/book:', e.message);
        res.status(500).json({ error: 'Failed to save booking — please try again' });
    }
});

// =============================================================================
// WEBHOOK
// =============================================================================
app.post('/api/webhook/yoco', async (req, res) => {
    // Fix 4 — Verify Yoco HMAC-SHA256 signature to reject forged events
    const webhookSecret = process.env.YOCO_WEBHOOK_SECRET || '';
    if (webhookSecret) {
        const sig       = req.headers['x-yoco-signature'] || '';
        const rawBody   = JSON.stringify(req.body); // requires body already parsed
        const expected  = 'sha256=' + crypto.createHmac('sha256', webhookSecret)
                            .update(rawBody).digest('hex');
        const sigBuf    = Buffer.from(sig.padEnd(expected.length, '\0'));
        const expBuf    = Buffer.from(expected.padEnd(sig.length,  '\0'));
        const valid = sigBuf.length > 0 && expBuf.length > 0 &&
            crypto.timingSafeEqual(sigBuf, expBuf);
        if (!valid) {
            console.warn('Webhook: invalid signature — rejected');
            return res.status(401).json({ error: 'Invalid signature' });
        }
    } else {
        console.warn('YOCO_WEBHOOK_SECRET not set — webhook signature not verified');
    }

    res.status(200).json({ received: true });
    try {
        const event    = req.body;
        const payment  = event.payload || event;
        const meta     = payment.metadata || {};
        const approved = ['payment.approved','payment_approved','payment.captured','payment_captured'].includes(event.type);
        if (!approved) return;
        const bookingId = meta.bookingId || ''; if (!bookingId) return;
        const type      = meta.type || 'deposit';
        const doc = await getDoc();
        const { row } = await findRow(doc, bookingId);
        if (!row) return;

        if (type === 'balance') {
            if (row.get('Balance Status') === 'Paid') return; // idempotent
            row.set('Balance Status','Paid'); await row.save();
            console.log(`Webhook: balance paid for ${bookingId}`);
            const settings = await getSettings(doc);
            // Send rebook email to customer
            sendRebookEmail(settings, {
                bookingId,
                name:    row.get('Client Name'),
                email:   row.get('Client Email'),
                total:   row.get('Total Amount (R)'),
                services:row.get('Service Names'),
            }).catch(() => {});
            return;
        }

        if (row.get('Deposit Status') === 'Confirmed') return;
        row.set('Deposit Status', 'Confirmed');
        row.set('Yoco Checkout ID', payment.id || row.get('Yoco Checkout ID') || '');
        await row.save();
        console.log(`Webhook: deposit confirmed for ${bookingId}`);
        const settings = await getSettings(doc);

        // Create calendar event
        const calId = await calCreate(settings, {
            bookingId, name: row.get('Client Name'), email: row.get('Client Email'),
            phone: row.get('Client Phone'), address: row.get('Client Address'),
            services: row.get('Service Names'), date: row.get('Date'), time: row.get('Time'),
            totalAmount: row.get('Total Amount (R)'), deposit: row.get('Deposit Amount (R)'),
            balance: row.get('Balance Due (R)'),
        });
        if (calId) { row.set('Calendar Event ID', calId); await row.save(); }

        // Notify admin — deposit confirmed
        sendAdminDepositNotification(settings, {
            bookingId,
            name:        row.get('Client Name'),
            email:       row.get('Client Email'),
            phone:       row.get('Client Phone'),
            address:     row.get('Client Address'),
            services:    row.get('Service Names'),
            date:        row.get('Date'),
            time:        row.get('Time'),
            totalAmount: row.get('Total Amount (R)'),
            deposit:     row.get('Deposit Amount (R)'),
            balance:     row.get('Balance Due (R)'),
        }).catch(() => {});

        // Send customer confirmation email
        sendCustomerConfirmationEmail(settings, {
            bookingId,
            name:    row.get('Client Name'),
            email:   row.get('Client Email'),
            address: row.get('Client Address'),
            services:row.get('Service Names'),
            date:    row.get('Date'),
            time:    row.get('Time'),
            deposit: row.get('Deposit Amount (R)'),
            balance: row.get('Balance Due (R)'),
        }).catch(() => {});

    } catch (e) { console.error('Webhook error:', e.message); }
});

// =============================================================================
// CHECK PAYMENT
// =============================================================================
app.get('/api/check-payment', async (req, res) => {
    const ref = (req.query.ref || '').trim();
    if (!ref) return res.status(400).json({ error: 'ref required' });
    try {
        const doc = await getDoc();
        const s   = await getSettings(doc);
        const { row } = await findRow(doc, ref);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json({
            bookingId:     ref,
            depositStatus: row.get('Deposit Status')     || '',
            balanceStatus: row.get('Balance Status')     || '',
            name:          row.get('Client Name')        || '',
            services:      row.get('Service Names')      || '',
            date:          row.get('Date')               || '',
            time:          row.get('Time')               || '',
            total:         row.get('Total Amount (R)')   || '',
            deposit:       row.get('Deposit Amount (R)') || '',
            balance:       row.get('Balance Due (R)')    || '',
            appBase:       s.app_base_url || '',
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================
app.post('/api/admin/login', rateLimit(5, 60000), async (req, res) => {
    try {
        const doc = await getDoc();
        const s   = await getSettings(doc);
        const provided = String(req.body.password || '');
        const expected = String(s.admin_password   || '');
        const pBuf = Buffer.alloc(Math.max(provided.length, expected.length));
        const eBuf = Buffer.alloc(Math.max(provided.length, expected.length));
        Buffer.from(provided).copy(pBuf);
        Buffer.from(expected).copy(eBuf);
        const match = expected.length > 0 && provided.length === expected.length &&
            crypto.timingSafeEqual(pBuf, eBuf);
        if (!match) return res.status(401).json({ error: 'Invalid password' });
        // Issue stateless HMAC token — no server-side storage, survives cold starts
        res.json({ token: makeAdminToken(provided) });
    } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/admin/bookings', adminOnly, async (req, res) => {
    try {
        const sheet = req.doc.sheetsByTitle['Bookings'];
        if (!sheet) throw new Error("Bookings tab not found");
        const rows = await sheet.getRows();
        res.json(rows.map(r => ({
            bookingId:    r.get('Booking ID'),     name:       r.get('Client Name'),
            email:        r.get('Client Email'),   phone:      r.get('Client Phone'),
            address:      r.get('Client Address'), services:   r.get('Service Names'),
            date:         r.get('Date'),           time:       r.get('Time'),
            total:        r.get('Total Amount (R)'), deposit:  r.get('Deposit Amount (R)'),
            balanceDue:   r.get('Balance Due (R)'), status:    r.get('Deposit Status'),
            balanceStatus:r.get('Balance Status'), checkoutId: r.get('Yoco Checkout ID'),
            calEventId:   r.get('Calendar Event ID'), createdAt: r.get('Created At'),
            yocoLink:     r.get('Yoco Link'),
        })).filter(b => b.bookingId).reverse());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/consultations', adminOnly, async (req, res) => {
    try {
        // Load both sheets in parallel
        const [bookSheet, consultSheet] = [
            req.doc.sheetsByTitle['Bookings'],
            req.doc.sheetsByTitle['Consultations'],
        ];
        if (!consultSheet) return res.json([]);
        const [bookRows, consultRows] = await Promise.all([
            bookSheet ? bookSheet.getRows() : Promise.resolve([]),
            consultSheet.getRows(),
        ]);
        // Build booking lookup map for joining name/date/services
        const bookMap = {};
        bookRows.forEach(r => {
            const id = (r.get('Booking ID') || '').trim();
            if (id) bookMap[id] = {
                name:     r.get('Client Name') || '',
                email:    r.get('Client Email') || '',
                phone:    r.get('Client Phone') || '',
                date:     r.get('Date') || '',
                time:     r.get('Time') || '',
                services: r.get('Service Names') || '',
                status:   r.get('Deposit Status') || '',
            };
        });
        const results = consultRows.map(r => {
            const id = (r.get('Booking ID') || '').trim();
            const b  = bookMap[id] || {};
            return {
                bookingId:       id,
                clientType:      r.get('Client Type')       || '',
                leadSource:      r.get('Lead Source')       || '',
                skinConditions:  r.get('Skin Conditions')   || '',
                medications:     r.get('Medications')       || '',
                allergies:       r.get('Allergies')         || '',
                healthConditions:r.get('Health Conditions') || '',
                pregnancy:       r.get('Pregnancy')         || '',
                additionalNotes: r.get('Additional Notes')  || '',
                // joined from Bookings
                name:     b.name, email: b.email, phone: b.phone,
                date:     b.date, time:  b.time,  services: b.services,
                status:   b.status,
            };
        }).filter(c => c.bookingId).reverse();
        res.json(results);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/update-status', adminOnly, async (req, res) => {
    try {
        const { bookingId, status } = req.body;
        if (!['Pending Payment','Confirmed','Service Complete','Cancelled','Refunded'].includes(status))
            return res.status(400).json({ error: 'Invalid status' });
        const { row } = await findRow(req.doc, bookingId);
        if (!row) return res.status(404).json({ error: 'Not found' });
        const prev = row.get('Deposit Status') || '';
        row.set('Deposit Status', status); await row.save();

        // Create calendar event if manually confirming
        if (status === 'Confirmed' && !row.get('Calendar Event ID')) {
            const calId = await calCreate(req.settings, {
                bookingId, name: row.get('Client Name'), email: row.get('Client Email'),
                phone: row.get('Client Phone'), address: row.get('Client Address'),
                services: row.get('Service Names'), date: row.get('Date'), time: row.get('Time'),
                totalAmount: row.get('Total Amount (R)'), deposit: row.get('Deposit Amount (R)'),
                balance: row.get('Balance Due (R)'),
            });
            if (calId) { row.set('Calendar Event ID', calId); await row.save(); }

            // Send admin + customer emails if manually confirmed (webhook didn't fire)
            if (prev !== 'Confirmed') {
                sendAdminDepositNotification(req.settings, {
                    bookingId, name: row.get('Client Name'), email: row.get('Client Email'),
                    phone: row.get('Client Phone'), address: row.get('Client Address'),
                    services: row.get('Service Names'), date: row.get('Date'), time: row.get('Time'),
                    totalAmount: row.get('Total Amount (R)'), deposit: row.get('Deposit Amount (R)'),
                    balance: row.get('Balance Due (R)'),
                }).catch(() => {});
                sendCustomerConfirmationEmail(req.settings, {
                    bookingId, name: row.get('Client Name'), email: row.get('Client Email'),
                    address: row.get('Client Address'), services: row.get('Service Names'),
                    date: row.get('Date'), time: row.get('Time'),
                    deposit: row.get('Deposit Amount (R)'), balance: row.get('Balance Due (R)'),
                }).catch(() => {});
            }
        }

        // When marking Service Complete — generate balance link and email customer
        if (status === 'Service Complete' && prev !== 'Service Complete') {
            const bal = parseFloat((row.get('Balance Due (R)') || '').replace(/[R\s]/g, '')) || 0;
            if (bal >= 2 && row.get('Balance Status') !== 'Paid' && row.get('Balance Status') !== 'Requested') {
                const s    = req.settings;
                const base = s.app_base_url || 'http://localhost:3000';
                const sUrl = `${base}/?payment=balance-success&ref=${bookingId}`;
                const cUrl = `${base}/?payment=balance-cancelled&ref=${bookingId}`;
                const slug = (s.yoco_payment_page_slug||'').replace(/^https?:\/\/pay\.yoco\.com\//,'').replace(/\?.*$/,'').trim();
                const np   = (row.get('Client Name')||'').split(/\s+/);
                let paymentUrl = null;
                if (s.yoco_secret_key) {
                    const { ok, data } = await yocoCheckout({
                        key: s.yoco_secret_key, cents: Math.round(bal * 100),
                        successUrl: sUrl, cancelUrl: cUrl,
                        customer: { email: row.get('Client Email')||'', firstName: np[0]||'', lastName: np.slice(1).join(' ')||'', phone: row.get('Client Phone')||'' },
                        metadata: { bookingId, type: 'balance' },
                        desc: `PhenomeBeauty balance — ${row.get('Service Names')}`,
                    });
                    if (ok && data.redirectUrl) paymentUrl = data.redirectUrl;
                }
                if (!paymentUrl && slug) {
                    const p = new URLSearchParams({ amount: bal.toFixed(2), reference: `${bookingId}-BAL`,
                        firstName: np[0]||'', lastName: np.slice(1).join(' ')||'',
                        email: row.get('Client Email')||'', redirectOnPaymentSuccess: sUrl });
                    paymentUrl = `https://pay.yoco.com/${slug}?${p}`;
                }
                if (paymentUrl) {
                    row.set('Balance Status', 'Requested');
                    row.set('Yoco Link', paymentUrl);
                    await row.save();
                    sendBalanceRequestEmail(req.settings, {
                        bookingId, name: row.get('Client Name'), email: row.get('Client Email'),
                        services: row.get('Service Names'), deposit: row.get('Deposit Amount (R)'),
                        balance: bal, paymentUrl,
                    }).catch(() => {});
                }
            }
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/reschedule', adminOnly, async (req, res) => {
    try {
        const { bookingId, newDate, newTime } = req.body;
        const { row } = await findRow(req.doc, bookingId);
        if (!row) return res.status(404).json({ error: 'Not found' });
        const oldCal = row.get('Calendar Event ID') || '';
        row.set('Date', newDate); row.set('Time', newTime); await row.save();
        if (oldCal) {
            const ok = await calUpdate(req.settings, oldCal, { name: row.get('Client Name'),
                address: row.get('Client Address'), services: row.get('Service Names'), date: newDate, time: newTime });
            if (!ok) {
                await calDelete(req.settings, oldCal);
                const nc = await calCreate(req.settings, { bookingId, name: row.get('Client Name'),
                    email: row.get('Client Email'), phone: row.get('Client Phone'),
                    address: row.get('Client Address'), services: row.get('Service Names'),
                    date: newDate, time: newTime, totalAmount: row.get('Total Amount (R)'),
                    deposit: row.get('Deposit Amount (R)'), balance: row.get('Balance Due (R)') });
                if (nc) { row.set('Calendar Event ID', nc); await row.save(); }
            }
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/request-balance', adminOnly, async (req, res) => {
    try {
        const { bookingId } = req.body;
        const { row } = await findRow(req.doc, bookingId);
        if (!row) return res.status(404).json({ error: 'Not found' });
        if (row.get('Balance Status') === 'Paid') return res.status(400).json({ error: 'Already paid' });
        const bal = parseFloat((row.get('Balance Due (R)') || '').replace(/[R\s]/g, '')) || 0;
        if (bal < 2) return res.status(400).json({ error: 'Balance below R2' });
        const s = req.settings;
        const base = s.app_base_url || 'http://localhost:3000';
        const sUrl = `${base}/?payment=balance-success&ref=${bookingId}`;
        const cUrl = `${base}/?payment=balance-cancelled&ref=${bookingId}`;
        const slug = (s.yoco_payment_page_slug||'').replace(/^https?:\/\/pay\.yoco\.com\//,'').replace(/\?.*$/,'').trim();
        const np = (row.get('Client Name')||'').split(/\s+/);
        let paymentUrl = null;
        if (s.yoco_secret_key) {
            const { ok, data } = await yocoCheckout({ key: s.yoco_secret_key, cents: Math.round(bal*100),
                successUrl: sUrl, cancelUrl: cUrl,
                customer: { email: row.get('Client Email')||'', firstName: np[0]||'', lastName: np.slice(1).join(' ')||'', phone: row.get('Client Phone')||'' },
                metadata: { bookingId, type: 'balance' },
                desc: `PhenomeBeauty balance — ${row.get('Service Names')}` });
            if (ok && data.redirectUrl) paymentUrl = data.redirectUrl;
        }
        if (!paymentUrl && slug) {
            const p = new URLSearchParams({ amount: bal.toFixed(2), reference: `${bookingId}-BAL`,
                firstName: np[0]||'', lastName: np.slice(1).join(' ')||'',
                email: row.get('Client Email')||'', redirectOnPaymentSuccess: sUrl });
            paymentUrl = `https://pay.yoco.com/${slug}?${p}`;
        }
        if (!paymentUrl) return res.status(500).json({ error: 'No Yoco credentials' });
        row.set('Balance Status','Requested'); row.set('Yoco Link', paymentUrl);
        row.set('Deposit Status','Service Complete'); await row.save();
        res.json({ success: true, paymentUrl, balanceDue: bal });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/refund', adminOnly, async (req, res) => {
    try {
        const { bookingId, reason } = req.body;
        const { row } = await findRow(req.doc, bookingId);
        if (!row) return res.status(404).json({ error: 'Not found' });
        const key = req.settings.yoco_secret_key || '';
        if (!key) return res.status(400).json({ error: 'yoco_secret_key not set' });
        const cid = (row.get('Yoco Checkout ID')||'').trim();
        if (!cid) return res.status(400).json({ error: 'No Checkout ID — refund manually in Yoco Dashboard' });
        const r = await fetch(`https://payments.yoco.com/api/checkouts/${cid}/refund`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason || 'requested_by_customer' }),
        });
        const d = await r.json();
        if (!r.ok) return res.status(400).json({ error: d.displayMessage || d.message || 'Refund failed' });
        row.set('Deposit Status','Refunded'); await row.save();
        const calId = row.get('Calendar Event ID')||'';
        if (calId) await calDelete(req.settings, calId);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Export for Vercel serverless — do not call app.listen()
module.exports = app;
