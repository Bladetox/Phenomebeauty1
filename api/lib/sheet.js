// api/lib/sheet.js — PhenomeBeauty · Sheet & Cache helpers
'use strict';

const { JWT }               = require('google-auth-library');

const SPREADSHEET_ID = '1G4pWPXsqCkUlpuEhmRT5sj7GE6NOxcp_OSCs1wqrRfk';

// ── CREDENTIALS ───────────────────────────────────────────────────────────────
let creds = null;
try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT || '';
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT env var is not set');
    creds = JSON.parse(raw);
    // Vercel mangles \n in private_key when pasted via dashboard — fix it
    if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
} catch (e) {
    console.error('GOOGLE_SERVICE_ACCOUNT parse failed:', e.message);
}

// ── JWT AUTH — lazy, created on first request ──────────────────────────────────
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

// ── DOC CACHE (5 min) ─────────────────────────────────────────────────────────
let _docCache = null, _docExpiry = 0;
async function getDoc() {
    if (_docCache && Date.now() < _docExpiry) return _docCache;
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, getJwt());
    await doc.loadInfo();
    _docCache  = doc;
    _docExpiry = Date.now() + 5 * 60 * 1000;
    return doc;
}

// ── SETTINGS CACHE (10 min) ───────────────────────────────────────────────────
let _settingsCache = null, _settingsExpiry = 0;
async function getSettings(doc) {
    if (_settingsCache && Date.now() < _settingsExpiry) return _settingsCache;
    const sheet = doc.sheetsByTitle['Settings'];
    if (!sheet) throw new Error('Settings tab not found');
    const rows = await sheet.getRows();
    const s = {};
    rows.forEach(r => {
        const k = (r.get('Setting Key') || '').trim();
        const v = (r.get('Value')       || '').trim();
        if (k) s[k] = v;
    });
    _settingsCache  = s;
    _settingsExpiry = Date.now() + 10 * 60 * 1000;
    return s;
}

// ── SERVICES CACHE (8 min) ────────────────────────────────────────────────────
let _servicesCache = null, _servicesExpiry = 0;
async function getServices(doc) {
    if (_servicesCache && Date.now() < _servicesExpiry) return _servicesCache;
    const rows = await doc.sheetsByTitle['Services'].getRows();
    _servicesCache = rows
        .filter(r => {
            const v = (r.get('Active') || '').toString().trim().toLowerCase();
            return v === 'true' || v === 'yes' || v === '1';
        })
        .map(r => ({
            id:          r.get('ID'),
            name:        r.get('Name'),
            description: r.get('Description'),
            price:       parseFloat(String(r.get('Price (R)') || 0).replace(/[R, ]/g, '')) || 0,
            duration:    parseInt(r.get('Duration (min)') || 0) || 0,
            category:    r.get('Category'),
        }));
    _servicesExpiry = Date.now() + 8 * 60 * 1000;
    return _servicesCache;
}

// ── AVAILABILITY CACHE (5 min) ────────────────────────────────────────────────
let _avCache = null, _avExpiry = 0;
async function getAvailabilityRows(doc) {
    if (_avCache && Date.now() < _avExpiry) return _avCache;
    const avSheet = doc.sheetsByTitle['Availability'];
    if (!avSheet) throw new Error('Availability tab not found');
    _avCache  = await avSheet.getRows();
    _avExpiry = Date.now() + 5 * 60 * 1000;
    return _avCache;
}

// ── BUST ALL CACHES ───────────────────────────────────────────────────────────
function bustDocCache() {
    _docExpiry      = 0;
    _servicesExpiry = 0;
    _settingsExpiry = 0;
  _avExpiry     = 0;
}

// ── FIND BOOKING ROW ──────────────────────────────────────────────────────────
async function findRow(doc, bookingId) {
    const sheet = doc.sheetsByTitle['Bookings'];
    if (!sheet) throw new Error('Bookings tab not found');
    const rows = await sheet.getRows();
    return { sheet, row: rows.find(r => (r.get('Booking ID') || '').trim() === bookingId.trim()) };
}

// ── SAST CLOCK — correct regardless of server timezone ───────────────────────
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

module.exports = {
    getJwt,
    getDoc,
    getSettings,
    getServices,
    getAvailabilityRows,
    bustDocCache,
    findRow,
    sastNow,
};
