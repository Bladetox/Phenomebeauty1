// api/index.js — PhenomeBeauty Booking Server v5.2
// Vercel serverless entry point — exports Express app, never calls app.listen()
'use strict';

const express = require('express');
const crypto  = require('crypto');
const { google } = require('googleapis');

const {
    getJwt,
    getDoc,
    getSettings,
    getServices,
    getAvailabilityRows,
    bustDocCache,
    findRow,
    sastNow,
} = require('./lib/sheet');

const {
    sendAdminDepositNotification,
    sendCustomerConfirmationEmail,
    sendBalanceRequestEmail,
    sendRebookEmail,
} = require('./lib/email');

const app = express();

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================
app.use((req, res, next) => {
    res.set('X-Content-Type-Options',  'nosniff');
    res.set('X-Frame-Options',          'DENY');
    res.set('X-XSS-Protection',         '0');       // deprecated — CSP handles this
    res.set('Referrer-Policy',          'strict-origin-when-cross-origin');
    res.set('Permissions-Policy',       'camera=(), microphone=(), geolocation=()');
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

// Body size limit — prevent large payload attacks
// verify captures raw bytes before JSON.parse so webhook HMAC works correctly
app.use(express.json({
    limit: '50kb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// =============================================================================
// RATE LIMITER (in-memory, per IP+path)
// =============================================================================
const rateLimitMap = new Map();
function rateLimit(maxReqs, windowMs) {
    return (req, res, next) => {
        const key   = req.ip + req.path;
        const now   = Date.now();
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

// =============================================================================
// INPUT SANITIZER
// =============================================================================
function sanitize(val, maxLen = 200) {
    if (val === null || val === undefined) return '';
    return String(val).replace(/<[^>]*>/g, '').replace(/[<>"']/g, '').trim().slice(0, maxLen);
}

// =============================================================================
// ADMIN AUTH — stateless HMAC tokens (survive Vercel cold starts)
// =============================================================================
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || (() => {
    console.warn('ADMIN_TOKEN_SECRET not set — using insecure fallback');
    return 'phenome-fallback-secret-change-me';
})();

function makeAdminToken(password) {
    return crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(password).digest('hex');
}

async function adminOnly(req, res, next) {
    const token = (req.headers['x-admin-token'] || '').trim();
    if (!token || token.length !== 64) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const doc      = await getDoc();
        const s        = await getSettings(doc);
        const expected = makeAdminToken(s.admin_password || '');
        const tBuf     = Buffer.from(token.padEnd(64, '0'));
        const eBuf     = Buffer.from(expected.padEnd(64, '0'));
        const match    = s.admin_password && token.length === expected.length &&
                         crypto.timingSafeEqual(tBuf, eBuf);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });
        req.doc = doc; req.settings = s; next();
    } catch (e) { res.status(500).json({ error: 'Authentication error' }); }
}

// =============================================================================
// CALENDAR HELPERS
// =============================================================================
function toISO(dateStr, timeStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, mn]   = timeStr.split(':').map(Number);
    return new Date(y, m - 1, d, h, mn).toISOString();
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
            start: { dateTime: toISO(b.date, startT),           timeZone: 'Africa/Johannesburg' },
            end:   { dateTime: toISO(b.date, endT || '01:00'),   timeZone: 'Africa/Johannesburg' },
            colorId: '2',
        }});
        return r.data.id;
    } catch (e) { console.error('calCreate:', e.message); return null; }
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
            start: { dateTime: toISO(b.date, startT),          timeZone: 'Africa/Johannesburg' },
            end:   { dateTime: toISO(b.date, endT || '01:00'), timeZone: 'Africa/Johannesburg' },
        }});
        return true;
    } catch (e) { console.error('calUpdate:', e.message); return false; }
}

async function calDelete(s, eventId) {
    const calId = s.google_calendar_id || '';
    if (!calId || !eventId) return;
    const cal = google.calendar({ version: 'v3', auth: getJwt() });
    try { await cal.events.delete({ calendarId: calId, eventId }); }
    catch (e) { console.error('calDelete:', e.message); }
}

// =============================================================================
// YOCO CHECKOUT HELPER
// =============================================================================
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
// GET /api — getServices | getMonthAvailability | getCallOutFee | getConfig
// =============================================================================
app.get('/api', async (req, res) => {
    const action = req.query.action;
    try {
        const doc = await getDoc();

        // ── getServices ──────────────────────────────────────────────────────
        if (action === 'getServices') {
            return res.json(await getServices(doc));
        }

        // ── getMonthAvailability ─────────────────────────────────────────────
        if (action === 'getMonthAvailability') {
            const [reqY, reqM] = (req.query.month || '').split('-').map(Number);
            const now      = new Date();
            const year     = reqY  || now.getFullYear();
            const month    = reqM  || now.getMonth() + 1;
            const pad      = n => String(n).padStart(2, '0');
            const monthKey = `${year}-${pad(month)}`;

            const DAYS = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
            const avRows     = await getAvailabilityRows(doc);
            const slotsByDow = {};
            avRows.forEach(r => {
                if ((r.get('Available (YES/NO)') || '').toUpperCase() !== 'YES') return;
                const day  = (r.get('Weekday/Date') || '').trim().toLowerCase();
                const slot = (r.get('Time Slot')    || '').trim();
                const dow  = DAYS[day];
                if (dow === undefined || !slot) return;
                if (!slotsByDow[dow]) slotsByDow[dow] = [];
                slotsByDow[dow].push(slot);
            });

            // Build set of already-booked slots for this month
            const bSheet = doc.sheetsByTitle['Bookings'];
            const booked = {};
            if (bSheet) {
                const bRows = await bSheet.getRows();
                bRows.forEach(r => {
                    const status = (r.get('Deposit Status') || '').trim();
                    if (['Cancelled', 'Refunded'].includes(status)) return;
                    const d = (r.get('Date') || '').trim();
                    const t = (r.get('Time') || '').trim();
                    if (!d.startsWith(monthKey) || !t) return;
                    if (!booked[d]) booked[d] = new Set();
                    booked[d].add(t);
                });
            }

            const sast        = sastNow();
            const todayStr    = sast.dateStr;
            const nowMins     = sast.mins;
            const daysInMonth = new Date(year, month, 0).getDate();
            const result      = {};

            console.log(`Availability SAST: ${todayStr} ${Math.floor(nowMins / 60)}:${pad(nowMins % 60)}`);

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${pad(month)}-${pad(d)}`;
                if (dateStr < todayStr) continue;   // skip past dates

                const dow   = new Date(year, month - 1, d).getDay();
                let   slots = (slotsByDow[dow] || []).slice();

                // Remove already-booked slots
                if (booked[dateStr]) slots = slots.filter(t => !booked[dateStr].has(t));

                // Remove past slots for today
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

        // ── getCallOutFee ────────────────────────────────────────────────────
        if (action === 'getCallOutFee') {
            const addr = (req.query.address || '').trim();
            if (!addr) return res.json({ fee: 0, error: 'No address' });

            const s    = await getSettings(doc);
            const mk   = s.google_maps_api_key    || '';
            const orig = s.fixed_origin_address   || '';
            const free = parseFloat(s.call_out_free_km     || '0');
            const rate = parseFloat(s.call_out_rate_per_km || '6.3');

            if (!mk)   return res.json({ fee: 0, error: 'google_maps_api_key not set' });
            if (!orig) return res.json({ fee: 0, error: 'fixed_origin_address not set' });

            const url = `https://maps.googleapis.com/maps/api/distancematrix/json` +
                        `?origins=${encodeURIComponent(orig)}` +
                        `&destinations=${encodeURIComponent(addr)}` +
                        `&units=metric&mode=driving&key=${encodeURIComponent(mk)}`;
            const md  = await (await fetch(url)).json();
            if (md.status !== 'OK') return res.json({ fee: 0, error: 'Maps: ' + md.status });
            const el  = md.rows?.[0]?.elements?.[0];
            if (!el || el.status !== 'OK') return res.json({ fee: 0, error: 'No route found' });

            const oneWay    = el.distance.value / 1000;
            const roundTrip = oneWay * 2;
            const billable  = roundTrip > free ? roundTrip - free : 0;
            const fee       = billable > 0 ? Math.round(billable * rate * 100) / 100 : 0;

            return res.json({
                fee,
                oneWayKm:    Math.round(oneWay    * 10) / 10,
                roundTripKm: Math.round(roundTrip * 10) / 10,
                duration:    el.duration.text,
            });
        }

        // ── getConfig ────────────────────────────────────────────────────────
        if (action === 'getConfig') {
            const full = await getSettings(doc);
            return res.json({
                deposit_percent:     full.deposit_percent     || '50',
                google_maps_api_key: full.google_maps_api_key || '',
                app_base_url:        full.app_base_url        || '',
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

        const {
            name, email, phone, address, services, date, time,
            servicesTotal, callOutFee, totalAmount, depositAmount,
            balanceDue, oneWayKm, roundTripKm, source, divaType, safety,
        } = req.body;

        // ── Input validation ─────────────────────────────────────────────────
        const cleanName  = sanitize(name,    80);
        const cleanEmail = sanitize(email,  120);
        const cleanPhone = String(phone || '').replace(/\D/g, '').slice(0, 15);
        const cleanAddr  = sanitize(address, 200);
        const cleanSrc   = sanitize(source,   50);

        if (cleanName.length < 2)                                              return res.status(400).json({ error: 'Invalid name' });
        if (!/^0\d{9}$/.test(cleanPhone))                                     return res.status(400).json({ error: 'Invalid phone number' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail))               return res.status(400).json({ error: 'Invalid email' });
        if (cleanAddr.length < 5)                                              return res.status(400).json({ error: 'Invalid address' });
        if (!Array.isArray(services) || services.length === 0)                return res.status(400).json({ error: 'No services selected' });
        if (services.length > 20)                                              return res.status(400).json({ error: 'Too many services' });
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))                      return res.status(400).json({ error: 'Invalid date format' });
        if (!time || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(time))               return res.status(400).json({ error: 'Invalid time format' });

        // ── Service data ─────────────────────────────────────────────────────
        const nameParts = cleanName.split(/\s+/);
        const svcNames  = services.map(x => sanitize(typeof x === 'object' ? x.name : x, 60)).filter(Boolean).join(', ');
        const svcIds    = services.map(x => (typeof x === 'object' ? x.id : '') || '').filter(Boolean).join(', ');
        const svcMins   = services.reduce((a, x) => a + parseInt((typeof x === 'object' ? x.duration : 0) || 0), 0);

        // ── Server-side amount recalculation ─────────────────────────────────
        const serverServicesTotal = services.reduce((sum, x) => {
            const p = typeof x === 'object' ? parseFloat(x.price || 0) : 0;
            return sum + (isFinite(p) && p >= 0 ? p : 0);
        }, 0);
        const serverCallOut = Math.max(0, parseFloat(callOutFee) || 0);
        const serverTotal   = serverServicesTotal + serverCallOut;
        const settingPct    = parseFloat(s.deposit_percent || '50') / 100;
        const serverDeposit = serverTotal > 0
            ? Math.round(serverTotal * settingPct * 100) / 100
            : Math.round(Number(depositAmount) * 100) / 100;
        const serverBalance = Math.round((serverTotal - serverDeposit) * 100) / 100;

        const dep       = Math.max(0, serverDeposit);
        const bal       = Math.max(0, serverBalance);
        const bookingId = 'PB-' + crypto.randomBytes(6).toString('hex').toUpperCase();

        // ── Safety / consultation fields ─────────────────────────────────────
        const isDivaNew     = divaType === 'new';
        const safetyData    = (isDivaNew && safety) ? safety : null;
        const skinNotes     = safetyData ? sanitize(safetyData.skinConditions,    500) : (isDivaNew ? '' : 'On File');
        const medsNotes     = safetyData ? sanitize(safetyData.medications,       500) : (isDivaNew ? '' : 'On File');
        const allergyNotes  = safetyData ? sanitize(safetyData.allergies,         500) : (isDivaNew ? '' : 'On File');
        const healthNotes   = safetyData ? sanitize(safetyData.healthConditions,  500) : (isDivaNew ? '' : 'On File');
        const environNotes  = safetyData ? sanitize(safetyData.environmental,     300) : '';
        const physicalNotes = safetyData ? sanitize(safetyData.physical,          300) : '';
        const pregnantNote  = safetyData ? (safetyData.pregnant     ? 'Yes' : 'No') : 'On File';
        const hairOkNote    = safetyData ? (safetyData.hairLengthOk ? 'Yes' : 'No') : '';
        const addlNotes     = safetyData ? sanitize(safetyData.additionalInfo,    500) : '';

        // ── Write to Bookings sheet ──────────────────────────────────────────
        const sheet = doc.sheetsByTitle['Bookings'];
        if (!sheet) throw new Error('Bookings tab not found');

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

        // ── Write to Consultations sheet (non-fatal) ─────────────────────────
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
                await consultSheet.loadHeaderRow();
                const headers = consultSheet.headerValues || [];
                if (headers.includes('Additional Notes'))       consultRow['Additional Notes']       = addlNotes;
                if (headers.includes('Environmental Exposure')) consultRow['Environmental Exposure'] = environNotes;
                if (headers.includes('Physical Factors'))       consultRow['Physical Factors']       = physicalNotes;
                if (headers.includes('Hair Length OK'))         consultRow['Hair Length OK']         = hairOkNote;
                await consultSheet.addRow(consultRow);
            } else {
                console.warn('Consultations tab not found — skipping');
            }
        } catch (consultErr) {
            console.warn('Consultation row write failed (non-fatal):', consultErr.message);
        }

        bustDocCache();
        console.log(`Saved ${bookingId} — ${svcNames} on ${date} ${time}`);

        // ── Deposit below R2 — skip payment link ─────────────────────────────
        if (dep < 2) return res.json({
            success: true, bookingId, paymentUrl: null,
            paymentError: 'Deposit below R2 — we will contact you.',
            depositAmount: dep, balanceDue: bal,
        });

        // ── Build Yoco payment URL ────────────────────────────────────────────
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
                customer: {
                    email:     cleanEmail,
                    firstName: nameParts[0]  || '',
                    lastName:  nameParts.slice(1).join(' ') || '',
                    phone:     cleanPhone,
                },
                metadata: { bookingId, serviceDate: date, serviceTime: time },
                desc:     `PhenomeBeauty deposit — ${svcNames}`,
            });
            if (ok && data.redirectUrl) {
                paymentUrl = data.redirectUrl;
                const { row } = await findRow(doc, bookingId);
                if (row) {
                    row.set('Yoco Checkout ID', data.id || '');
                    row.set('Yoco Link', paymentUrl);
                    await row.save();
                }
            } else {
                paymentError = data.displayMessage || data.message || 'Yoco API error';
            }
        }

        if (!paymentUrl && yocoSlug) {
            const p = new URLSearchParams({
                amount:                   dep.toFixed(2),
                reference:                bookingId,
                firstName:                nameParts[0] || '',
                lastName:                 nameParts.slice(1).join(' ') || '',
                email,
                redirectOnPaymentSuccess: successUrl,
            });
            paymentUrl = `https://pay.yoco.com/${yocoSlug}?${p}`;
            const { row } = await findRow(doc, bookingId);
            if (row) { row.set('Yoco Link', paymentUrl); await row.save(); }
        }

        return res.json({
            success: true, bookingId, paymentUrl,
            paymentError: paymentUrl ? null : (paymentError || 'No Yoco credentials in Settings'),
            depositAmount: dep, balanceDue: bal,
        });

    } catch (e) {
        console.error('POST /api/book:', e.message);
        res.status(500).json({ error: 'Failed to save booking — please try again' });
    }
});

// =============================================================================
// POST /api/webhook/yoco
// =============================================================================
app.post('/api/webhook/yoco', async (req, res) => {

    // ── Verify Yoco webhook signature via Svix ──────────────────────────
    const webhookSecret = process.env.YOCO_WEBHOOK_SECRET || '';

    if (webhookSecret) {
        const { Webhook } = require('svix');
        const wh = new Webhook(webhookSecret);
        try {
            const rawBody = req.rawBody
                ? req.rawBody.toString('utf8')
                : JSON.stringify(req.body);
            wh.verify(rawBody, req.headers);
            console.log('Webhook: signature verified ✓');
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(401).json({ error: 'Invalid signature' });
        }
    } else {
        console.warn('YOCO_WEBHOOK_SECRET not set — skipping verification');
    }

    // ── Process event ─────────────────────────────────────────────────────────
    // Return 500 on failure so Yoco retries; 200 means we handled it.
    try {
        const event   = req.body || {};
        const payment = event.payload || event;
        const meta    = payment.metadata || {};

        const successTypes = [
            'payment.succeeded',
            'payment.approved',
            'payment_approved',
            'payment.captured',
            'payment_captured',
        ];

        if (!successTypes.includes(event.type)) {
            console.log(`Webhook: ignoring event type "${event.type}"`);
            return res.status(200).json({ received: true });
        }

        if (payment.status && payment.status !== 'succeeded') {
            console.log(`Webhook: ignoring payment status "${payment.status}"`);
            return res.status(200).json({ received: true });
        }

        const bookingId = meta.bookingId || '';
        if (!bookingId) {
            console.warn('Webhook: no bookingId in metadata — ignoring');
            return res.status(200).json({ received: true });
        }

        const type = meta.type || 'deposit';

        const doc     = await getDoc();
        const { row } = await findRow(doc, bookingId);
        if (!row) {
            console.warn(`Webhook: booking ${bookingId} not found in sheet`);
            return res.status(200).json({ received: true });
        }

        // ── Balance payment branch ────────────────────────────────────────────
        if (type === 'balance') {
            if (row.get('Balance Status') === 'Paid') {
                console.log(`Webhook: balance already paid for ${bookingId} — idempotent skip`);
                return res.status(200).json({ received: true });
            }

            row.set('Balance Status', 'Paid');
            await row.save();
            console.log(`Webhook: balance paid for ${bookingId}`);

            const settings = await getSettings(doc);

            sendRebookEmail(settings, {
                bookingId,
                name:     row.get('Client Name'),
                email:    row.get('Client Email'),
                total:    row.get('Total Amount (R)'),
                services: row.get('Service Names'),
            }).catch((e) => console.error('Rebook email error:', e.message));

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
            }).catch((e) => console.error('Admin balance-paid email error:', e.message));

            return res.status(200).json({ received: true });
        }

        // ── Deposit payment branch ────────────────────────────────────────────
        if (row.get('Deposit Status') === 'Confirmed') {
            console.log(`Webhook: deposit already confirmed for ${bookingId} — idempotent skip`);
            return res.status(200).json({ received: true });
        }

        row.set('Deposit Status',   'Confirmed');
        row.set('Yoco Checkout ID', payment.id || row.get('Yoco Checkout ID') || '');
        await row.save();
        console.log(`Webhook: deposit confirmed for ${bookingId}`);

        const settings = await getSettings(doc);

        // Create Google Calendar event
        const calId = await calCreate(settings, {
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
        });
        if (calId) {
            row.set('Calendar Event ID', calId);
            await row.save();
        }

        // Notify admin of new confirmed booking
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
        }).catch((e) => console.error('Admin deposit email error:', e.message));

        // Confirm booking to customer
        sendCustomerConfirmationEmail(settings, {
            bookingId,
            name:     row.get('Client Name'),
            email:    row.get('Client Email'),
            address:  row.get('Client Address'),
            services: row.get('Service Names'),
            date:     row.get('Date'),
            time:     row.get('Time'),
            deposit:  row.get('Deposit Amount (R)'),
            balance:  row.get('Balance Due (R)'),
        }).catch((e) => console.error('Customer confirmation email error:', e.message));

        return res.status(200).json({ received: true });

    } catch (e) {
        // 500 tells Yoco to retry
        console.error('Webhook processing error:', e.message);
        return res.status(500).json({ error: 'Internal error — will retry' });
    }
});


// =============================================================================
// GET /api/check-payment
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
// POST /api/admin/login
// =============================================================================
app.post('/api/admin/login', rateLimit(5, 60000), async (req, res) => {
    try {
        const doc      = await getDoc();
        const s        = await getSettings(doc);
        const provided = String(req.body.password || '');
        const expected = String(s.admin_password  || '');
        const pBuf     = Buffer.alloc(Math.max(provided.length, expected.length));
        const eBuf     = Buffer.alloc(Math.max(provided.length, expected.length));
        Buffer.from(provided).copy(pBuf);
        Buffer.from(expected).copy(eBuf);
        const match = expected.length > 0 && provided.length === expected.length &&
                      crypto.timingSafeEqual(pBuf, eBuf);
        if (!match) return res.status(401).json({ error: 'Invalid password' });
        res.json({ token: makeAdminToken(provided) });
    } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

// =============================================================================
// GET /api/admin/bookings
// =============================================================================
app.get('/api/admin/bookings', adminOnly, async (req, res) => {
    try {
        const sheet = req.doc.sheetsByTitle['Bookings'];
        if (!sheet) throw new Error('Bookings tab not found');
        const rows = await sheet.getRows();
        res.json(rows.map(r => ({
            bookingId:     r.get('Booking ID'),
            name:          r.get('Client Name'),
            email:         r.get('Client Email'),
            phone:         r.get('Client Phone'),
            address:       r.get('Client Address'),
            services:      r.get('Service Names'),
            date:          r.get('Date'),
            time:          r.get('Time'),
            total:         r.get('Total Amount (R)'),
            deposit:       r.get('Deposit Amount (R)'),
            balanceDue:    r.get('Balance Due (R)'),
            status:        r.get('Deposit Status'),
            balanceStatus: r.get('Balance Status'),
            checkoutId:    r.get('Yoco Checkout ID'),
            calEventId:    r.get('Calendar Event ID'),
            createdAt:     r.get('Created At'),
            yocoLink:      r.get('Yoco Link'),
        })).filter(b => b.bookingId).reverse());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// GET /api/admin/consultations
// =============================================================================
app.get('/api/admin/consultations', adminOnly, async (req, res) => {
    try {
        const bookSheet    = req.doc.sheetsByTitle['Bookings'];
        const consultSheet = req.doc.sheetsByTitle['Consultations'];
        if (!consultSheet) return res.json([]);

        const [bookRows, consultRows] = await Promise.all([
            bookSheet    ? bookSheet.getRows()    : Promise.resolve([]),
            consultSheet.getRows(),
        ]);

        const bookMap = {};
        bookRows.forEach(r => {
            const id = (r.get('Booking ID') || '').trim();
            if (id) bookMap[id] = {
                name:     r.get('Client Name')    || '',
                email:    r.get('Client Email')   || '',
                phone:    r.get('Client Phone')   || '',
                date:     r.get('Date')           || '',
                time:     r.get('Time')           || '',
                services: r.get('Service Names')  || '',
                status:   r.get('Deposit Status') || '',
            };
        });

        res.json(consultRows.map(r => {
            const id = (r.get('Booking ID') || '').trim();
            const b  = bookMap[id] || {};
            return {
                bookingId:        id,
                clientType:       r.get('Client Type')        || '',
                leadSource:       r.get('Lead Source')        || '',
                skinConditions:   r.get('Skin Conditions')    || '',
                medications:      r.get('Medications')        || '',
                allergies:        r.get('Allergies')          || '',
                healthConditions: r.get('Health Conditions')  || '',
                pregnancy:        r.get('Pregnancy')          || '',
                additionalNotes:  r.get('Additional Notes')   || '',
                name:     b.name,     email:    b.email,
                phone:    b.phone,    date:     b.date,
                time:     b.time,     services: b.services,
                status:   b.status,
            };
        }).filter(c => c.bookingId).reverse());

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// POST /api/admin/update-status
// =============================================================================
app.post('/api/admin/update-status', adminOnly, async (req, res) => {
    try {
        const { bookingId, status } = req.body;
        const VALID_STATUSES = ['Pending Payment', 'Confirmed', 'Service Complete', 'Cancelled', 'Refunded'];
        if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        const { row } = await findRow(req.doc, bookingId);
        if (!row) return res.status(404).json({ error: 'Not found' });

        const prev = row.get('Deposit Status') || '';
        row.set('Deposit Status', status);
        await row.save();

        // ── Manual confirm: create calendar event + send emails ──────────────
        if (status === 'Confirmed' && !row.get('Calendar Event ID')) {
            const calId = await calCreate(req.settings, {
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
            });
            if (calId) { row.set('Calendar Event ID', calId); await row.save(); }

            if (prev !== 'Confirmed') {
                sendAdminDepositNotification(req.settings, {
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
                sendCustomerConfirmationEmail(req.settings, {
                    bookingId,
                    name:     row.get('Client Name'),
                    email:    row.get('Client Email'),
                    address:  row.get('Client Address'),
                    services: row.get('Service Names'),
                    date:     row.get('Date'),
                    time:     row.get('Time'),
                    deposit:  row.get('Deposit Amount (R)'),
                    balance:  row.get('Balance Due (R)'),
                }).catch(() => {});
            }
        }

        // ── Service Complete: generate balance link + email customer ──────────
        if (status === 'Service Complete' && prev !== 'Service Complete') {
            const bal = parseFloat((row.get('Balance Due (R)') || '').replace(/[R\s]/g, '')) || 0;
            if (bal >= 2 && row.get('Balance Status') !== 'Paid' && row.get('Balance Status') !== 'Requested') {
                const s    = req.settings;
                const base = s.app_base_url || 'http://localhost:3000';
                const sUrl = `${base}/?payment=balance-success&ref=${bookingId}`;
                const cUrl = `${base}/?payment=balance-cancelled&ref=${bookingId}`;
                const slug = (s.yoco_payment_page_slug || '').replace(/^https?:\/\/pay\.yoco\.com\//, '').replace(/\?.*$/, '').trim();
                const np   = (row.get('Client Name') || '').split(/\s+/);
                let paymentUrl = null;

                if (s.yoco_secret_key) {
                    const { ok, data } = await yocoCheckout({
                        key:        s.yoco_secret_key,
                        cents:      Math.round(bal * 100),
                        successUrl: sUrl,
                        cancelUrl:  cUrl,
                        customer:   { email: row.get('Client Email') || '', firstName: np[0] || '', lastName: np.slice(1).join(' ') || '', phone: row.get('Client Phone') || '' },
                        metadata:   { bookingId, type: 'balance' },
                        desc:       `PhenomeBeauty balance — ${row.get('Service Names')}`,
                    });
                    if (ok && data.redirectUrl) paymentUrl = data.redirectUrl;
                }

                if (!paymentUrl && slug) {
                    const p = new URLSearchParams({
                        amount:                   bal.toFixed(2),
                        reference:                `${bookingId}-BAL`,
                        firstName:                np[0] || '',
                        lastName:                 np.slice(1).join(' ') || '',
                        email:                    row.get('Client Email') || '',
                        redirectOnPaymentSuccess: sUrl,
                    });
                    paymentUrl = `https://pay.yoco.com/${slug}?${p}`;
                }

                if (paymentUrl) {
                    row.set('Balance Status', 'Requested');
                    row.set('Yoco Link',      paymentUrl);
                    await row.save();
                    sendBalanceRequestEmail(req.settings, {
                        bookingId,
                        name:       row.get('Client Name'),
                        email:      row.get('Client Email'),
                        services:   row.get('Service Names'),
                        deposit:    row.get('Deposit Amount (R)'),
                        balance:    bal,
                        paymentUrl,
                    }).catch(() => {});
                }
            }
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// POST /api/admin/reschedule
// =============================================================================
app.post('/api/admin/reschedule', adminOnly, async (req, res) => {
    try {
        const { bookingId, newDate, newTime } = req.body;
        const { row } = await findRow(req.doc, bookingId);
        if (!row) return res.status(404).json({ error: 'Not found' });

        const oldCal = row.get('Calendar Event ID') || '';
        row.set('Date', newDate);
        row.set('Time', newTime);
        await row.save();

        if (oldCal) {
            const updated = await calUpdate(req.settings, oldCal, {
                name:     row.get('Client Name'),
                address:  row.get('Client Address'),
                services: row.get('Service Names'),
                date:     newDate,
                time:     newTime,
            });
            if (!updated) {
                await calDelete(req.settings, oldCal);
                const nc = await calCreate(req.settings, {
                    bookingId,
                    name:        row.get('Client Name'),
                    email:       row.get('Client Email'),
                    phone:       row.get('Client Phone'),
                    address:     row.get('Client Address'),
                    services:    row.get('Service Names'),
                    date:        newDate,
                    time:        newTime,
                    totalAmount: row.get('Total Amount (R)'),
                    deposit:     row.get('Deposit Amount (R)'),
                    balance:     row.get('Balance Due (R)'),
                });
                if (nc) { row.set('Calendar Event ID', nc); await row.save(); }
            }
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// POST /api/admin/request-balance
// =============================================================================
app.post('/api/admin/request-balance', adminOnly, async (req, res) => {
    try {
        const { bookingId } = req.body;
        const { row } = await findRow(req.doc, bookingId);
        if (!row) return res.status(404).json({ error: 'Not found' });
        if (row.get('Balance Status') === 'Paid') return res.status(400).json({ error: 'Already paid' });

        const bal = parseFloat((row.get('Balance Due (R)') || '').replace(/[R\s]/g, '')) || 0;
        if (bal < 2) return res.status(400).json({ error: 'Balance below R2' });

        const s    = req.settings;
        const base = s.app_base_url || 'http://localhost:3000';
        const sUrl = `${base}/?payment=balance-success&ref=${bookingId}`;
        const cUrl = `${base}/?payment=balance-cancelled&ref=${bookingId}`;
        const slug = (s.yoco_payment_page_slug || '').replace(/^https?:\/\/pay\.yoco\.com\//, '').replace(/\?.*$/, '').trim();
        const np   = (row.get('Client Name') || '').split(/\s+/);
        let paymentUrl = null;

        if (s.yoco_secret_key) {
            const { ok, data } = await yocoCheckout({
                key:        s.yoco_secret_key,
                cents:      Math.round(bal * 100),
                successUrl: sUrl,
                cancelUrl:  cUrl,
                customer:   { email: row.get('Client Email') || '', firstName: np[0] || '', lastName: np.slice(1).join(' ') || '', phone: row.get('Client Phone') || '' },
                metadata:   { bookingId, type: 'balance' },
                desc:       `PhenomeBeauty balance — ${row.get('Service Names')}`,
            });
            if (ok && data.redirectUrl) paymentUrl = data.redirectUrl;
        }

        if (!paymentUrl && slug) {
            const p = new URLSearchParams({
                amount:                   bal.toFixed(2),
                reference:                `${bookingId}-BAL`,
                firstName:                np[0] || '',
                lastName:                 np.slice(1).join(' ') || '',
                email:                    row.get('Client Email') || '',
                redirectOnPaymentSuccess: sUrl,
            });
            paymentUrl = `https://pay.yoco.com/${slug}?${p}`;
        }

        if (!paymentUrl) return res.status(500).json({ error: 'No Yoco credentials' });

        row.set('Balance Status',  'Requested');
        row.set('Yoco Link',       paymentUrl);
        row.set('Deposit Status',  'Service Complete');
        await row.save();

        res.json({ success: true, paymentUrl, balanceDue: bal });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// POST /api/admin/refund
// =============================================================================
app.post('/api/admin/refund', adminOnly, async (req, res) => {
    try {
        const { bookingId, reason } = req.body;
        const { row } = await findRow(req.doc, bookingId);
        if (!row) return res.status(404).json({ error: 'Not found' });

        const key = req.settings.yoco_secret_key || '';
        if (!key) return res.status(400).json({ error: 'yoco_secret_key not set' });

        const cid = (row.get('Yoco Checkout ID') || '').trim();
        if (!cid) return res.status(400).json({ error: 'No Checkout ID — refund manually in Yoco Dashboard' });

        const r = await fetch(`https://payments.yoco.com/api/checkouts/${cid}/refund`, {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ reason: reason || 'requested_by_customer' }),
        });
        const d = await r.json();
        if (!r.ok) return res.status(400).json({ error: d.displayMessage || d.message || 'Refund failed' });

        row.set('Deposit Status', 'Refunded');
        await row.save();

        const calId = row.get('Calendar Event ID') || '';
        if (calId) await calDelete(req.settings, calId);

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// Vercel serverless export — never call app.listen()
// =============================================================================
module.exports = app;
