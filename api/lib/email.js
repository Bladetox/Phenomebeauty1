'use strict';

const nodemailer = require('nodemailer');

// =============================================================================
// TRANSPORT + HELPERS
// =============================================================================

function createTransporter(s) {
    // Support both underscored and non-underscored keys to avoid regressions
    const user =
        s.smtp_user ||
        s.smtpuser ||
        s.admin_email ||
        s.adminemail ||
        '';
    const pass = s.smtp_pass || s.smtppass || '';
    if (!user || !pass) return null;

    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });
}

function fmtDateEmail(ds) {
    if (!ds) return ds;
    const [y, m, d] = ds.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${DAYS[dt.getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

// =============================================================================
// EMAIL HTML HELPERS
// =============================================================================

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

function emailRow(label, value, valueStyle = '') {
    return `<tr>
      <td style="color:rgba(148,163,184,0.8);padding:7px 0;width:42%;font-size:13px;">${label}</td>
      <td style="font-size:13px;${valueStyle}">${value}</td>
    </tr>`;
}

// Optional Google review block — only shows if google_review_url exists in Settings
function emailReviewBlock(s, contextLine) {
    const url =
        s.google_review_url ||
        s.googleReviewUrl ||
        '';
    if (!url) return '';

    return `
      <div style="background:rgba(15,23,42,0.85);border:1px solid rgba(148,163,184,0.25);border-radius:14px;padding:14px 16px;margin-top:18px;">
        <p style="margin:0 0 10px;font-size:12.5px;color:rgba(148,163,184,0.9);line-height:1.7;">
          ${contextLine}
        </p>
        <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#0b1120;text-align:center;padding:9px 16px;border-radius:999px;font-size:12.5px;font-weight:600;text-decoration:none;">
          Share a quick Google review
        </a>
      </div>
    `;
}

// =============================================================================
// 1. Admin deposit confirmed notification
// =============================================================================

async function sendAdminDepositNotification(s, b) {
    const transporter = createTransporter(s);
    const adminEmail =
        s.admin_email ||
        s.adminemail ||
        '';
    if (!transporter || !adminEmail) return;

    try {
        await transporter.sendMail({
            from:    `"PhenomeBeauty Bookings" <${(s.smtp_user || s.smtpuser || adminEmail)}>`,
            to:      adminEmail,
            subject: `💳 Deposit Paid — ${b.name} · ${fmtDateEmail(b.date)}`,
            html: emailWrap(
                emailHeader(
                    '💳',
                    'Deposit Confirmed!',
                    `Ref: ${b.bookingId}`,
                    'linear-gradient(135deg,#059669,#0d9488)'
                ),
                `
                <table style="width:100%;border-collapse:collapse;">
                  ${emailRow('Client', `<strong>${b.name}</strong>`)}
                  ${emailRow('Phone', `<a href="tel:${b.phone}" style="color:#f97316;">${b.phone}</a>`)}
                  ${emailRow('Email', `<a href="mailto:${b.email}" style="color:#f97316;">${b.email}</a>`)}
                  ${emailRow('Address', b.address || '')}

                  <tr><td colspan="2">
                    <hr style="border:none;border-top:1px solid rgba(148,163,184,0.15);margin:10px 0;" />
                  </td></tr>

                  ${emailRow('Date', `<strong>${fmtDateEmail(b.date)}</strong>`)}
                  ${emailRow('Time', `<strong>${b.time}</strong>`)}
                  ${emailRow('Services', b.services || '')}

                  <tr><td colspan="2">
                    <hr style="border:none;border-top:1px solid rgba(148,163,184,0.15);margin:10px 0;" />
                  </td></tr>

                  ${emailRow('Total', `R${Number(b.totalAmount || 0).toFixed(2)}`)}
                  ${emailRow('Deposit Received', `<strong style="color:#10b981;">R${Number(b.deposit || 0).toFixed(2)}</strong>`)}
                  ${emailRow('Balance Due', `<span style="color:#f97316;">R${Number(b.balance || 0).toFixed(2)}</span>`)}
                </table>

                <div style="margin-top:18px;padding:12px 16px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;font-size:12px;color:#10b981;">
                  ✅ Booking is now <strong>Confirmed</strong> — slot is secured.
                </div>
                `
            ),
        });
        console.log('Admin deposit email sent for', b.bookingId);
    } catch (e) {
        console.error('Admin deposit email error:', e.message);
    }
}

// =============================================================================
// 1b. Admin balance paid notification (new)
// =============================================================================

async function sendAdminBalancePaidNotification(s, b) {
    const transporter = createTransporter(s);
    const adminEmail =
        s.admin_email ||
        s.adminemail ||
        '';
    if (!transporter || !adminEmail) return;

    try {
        await transporter.sendMail({
            from:    `"PhenomeBeauty Bookings" <${(s.smtp_user || s.smtpuser || adminEmail)}>`,
            to:      adminEmail,
            subject: `💸 Balance Paid — ${b.name} · ${fmtDateEmail(b.date)}`,
            html: emailWrap(
                emailHeader(
                    '💸',
                    'Balance Paid',
                    `Ref: ${b.bookingId}`,
                    'linear-gradient(135deg,#0f766e,#22c55e)'
                ),
                `
                <table style="width:100%;border-collapse:collapse;">
                  ${emailRow('Client', `<strong>${b.name}</strong>`)}
                  ${emailRow('Phone', `<a href="tel:${b.phone}" style="color:#f97316;">${b.phone}</a>`)}
                  ${emailRow('Email', `<a href="mailto:${b.email}" style="color:#f97316;">${b.email}</a>`)}
                  ${emailRow('Address', b.address || '')}

                  <tr><td colspan="2">
                    <hr style="border:none;border-top:1px solid rgba(148,163,184,0.15);margin:10px 0;" />
                  </td></tr>

                  ${emailRow('Date', `<strong>${fmtDateEmail(b.date)}</strong>`)}
                  ${emailRow('Time', `<strong>${b.time}</strong>`)}
                  ${emailRow('Services', b.services || '')}

                  <tr><td colspan="2">
                    <hr style="border:none;border-top:1px solid rgba(148,163,184,0.15);margin:10px 0;" />
                  </td></tr>

                  ${emailRow('Total', `R${Number(b.totalAmount || 0).toFixed(2)}`)}
                  ${emailRow('Deposit Paid', `<span style="color:#10b981;">R${Number(b.deposit || 0).toFixed(2)}</span>`)}
                  ${emailRow('Balance Just Paid', `<strong style="color:#f97316;">R${Number(b.balance || 0).toFixed(2)}</strong>`)}
                </table>

                <div style="margin-top:18px;padding:12px 16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.35);border-radius:10px;font-size:12px;color:#10b981;">
                  ✅ Booking is now <strong>fully paid</strong>. No further payment is due.
                </div>
                `
            ),
        });
        console.log('Admin balance-paid email sent for', b.bookingId);
    } catch (e) {
        console.error('Admin balance-paid email error:', e.message);
    }
}

// =============================================================================
// 2. Customer deposit confirmation
// =============================================================================

async function sendCustomerConfirmationEmail(s, b) {
    const transporter = createTransporter(s);
    const adminEmail =
        s.admin_email ||
        s.adminemail ||
        '';
    if (!transporter || !b.email) return;

    const firstName = (b.name || '').split(/\s+/)[0] || '';

    try {
        const reviewHtml = emailReviewBlock(
            s,
            'After your appointment, if you enjoyed your experience, a short Google review helps other women discover PhenomeBeauty. It is completely optional, but means a lot to a small business like ours.'
        );

        await transporter.sendMail({
            from:    `"PhenomeBeauty" <${(s.smtp_user || s.smtpuser || adminEmail)}>`,
            to:      b.email,
            subject: `✨ You're booked, ${firstName}! — ${fmtDateEmail(b.date)}`,
            html: emailWrap(
                emailHeader(
                    '✨',
                    `You're all set, ${firstName}!`,
                    "Your deposit is in — we can't wait to pamper you."
                ),
                `
                <p style="font-size:14px;line-height:1.7;color:rgba(248,250,252,0.9);margin:0 0 20px;">
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
                    ${emailRow('Deposit Paid ✅', `<strong style="color:#10b981;">R${Number(b.deposit || 0).toFixed(2)}</strong>`)}
                    ${emailRow('Balance (after service)', `<span style="color:#f97316;">R${Number(b.balance || 0).toFixed(2)}</span>`)}
                  </table>
                </div>

                <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px 16px;margin-bottom:18px;font-size:12.5px;color:rgba(148,163,184,0.8);line-height:1.7;">
                  💡 <strong style="color:#f8fafc;">Good to know:</strong>
                  Please give us at least 24 hours notice if you need to cancel or reschedule so we can offer your slot to someone else.
                  Late cancellations may forfeit the deposit.
                </div>

                ${reviewHtml}

                <p style="font-size:12px;color:rgba(148,163,184,0.4);text-align:center;margin:0;">
                  Ref: ${b.bookingId}
                </p>
                `
            ),
        });
        console.log('Customer confirmation email sent to', b.email);
    } catch (e) {
        console.error('Customer confirmation email error:', e.message);
    }
}

// =============================================================================
// 3. Balance request email
// =============================================================================

async function sendBalanceRequestEmail(s, b) {
    const transporter = createTransporter(s);
    const adminEmail =
        s.admin_email ||
        s.adminemail ||
        '';
    if (!transporter || !b.email) return;

    const firstName = (b.name || '').split(/\s+/)[0] || '';

    try {
        const reviewHtml = emailReviewBlock(
            s,
            'Once your treatment is complete, we would love to hear how it went. If you have a moment, a short Google review really helps other clients choose the right mobile studio.'
        );

        await transporter.sendMail({
            from:    `"PhenomeBeauty" <${(s.smtp_user || s.smtpuser || adminEmail)}>`,
            to:      b.email,
            subject: `💳 Your balance payment — R${Number(b.balance || 0).toFixed(2)}`,
            html: emailWrap(
                emailHeader(
                    '💅',
                    `Thank you, ${firstName}!`,
                    "Hope you loved your treatment — here's your balance link.",
                    'linear-gradient(135deg,#7c3aed,#ec4899)'
                ),
                `
                <p style="font-size:14px;line-height:1.7;color:rgba(248,250,252,0.9);margin:0 0 20px;">
                  Hi <strong>${firstName}</strong> 💕<br><br>
                  We hope you're feeling absolutely fabulous! Your service is complete and the remaining balance is now due.
                </p>

                <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:14px;padding:18px 20px;margin-bottom:20px;">
                  <table style="width:100%;border-collapse:collapse;">
                    ${emailRow('Services', b.services)}
                    ${emailRow('Deposit Already Paid', `<span style="color:#10b981;">R${Number(b.deposit || 0).toFixed(2)}</span>`)}
                    ${emailRow('Balance Due', `<strong style="color:#f97316;font-size:15px;">R${Number(b.balance || 0).toFixed(2)}</strong>`)}
                  </table>
                </div>

                <a href="${b.paymentUrl}" style="display:block;background:linear-gradient(135deg,#f97316,#ec4899);color:#0b1120;text-align:center;padding:14px 20px;border-radius:14px;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:18px;">
                  Pay Balance — R${Number(b.balance || 0).toFixed(2)} →
                </a>

                ${reviewHtml}

                <p style="font-size:12px;color:rgba(148,163,184,0.5);text-align:center;margin:0;">
                  If you have any questions, please don't hesitate to reach out 💕<br>
                  Ref: ${b.bookingId}
                </p>
                `
            ),
        });
        console.log('Balance request email sent to', b.email);
    } catch (e) {
        console.error('Balance request email error:', e.message);
    }
}

// =============================================================================
// 4. Rebook / thank-you email (after full balance paid)
// =============================================================================

async function sendRebookEmail(s, b) {
    const transporter = createTransporter(s);
    const adminEmail =
        s.admin_email ||
        s.adminemail ||
        '';
    if (!transporter || !b.email) return;

    const firstName = (b.name || '').split(/\s+/)[0] || '';
    const appBase =
        s.app_base_url ||
        s.appbaseurl ||
        'http://localhost:3000';

    try {
        const reviewHtml = emailReviewBlock(
            s,
            'If you loved your time with us, a short, honest Google review helps other women feel confident booking mobile beauty. No pressure at all — only if it feels right for you.'
        );

        await transporter.sendMail({
            from:    `"PhenomeBeauty" <${(s.smtp_user || s.smtpuser || adminEmail)}>`,
            to:      b.email,
            subject: `🌸 Thank you ${firstName} — see you next time!`,
            html: emailWrap(
                emailHeader(
                    '🌸',
                    'All done — you look amazing!',
                    'Your full payment is in. Thank you so much!',
                    'linear-gradient(135deg,#ec4899,#8b5cf6)'
                ),
                `
                <p style="font-size:14px;line-height:1.7;color:rgba(248,250,252,0.9);margin:0 0 20px;">
                  Hi <strong>${firstName}</strong> 💕<br><br>
                  Your payment is complete — thank you so much for trusting PhenomeBeauty!
                  It was an absolute pleasure treating you and we hope you feel as beautiful on the outside as you are on the inside. 🌸
                </p>

                <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:14px;padding:16px 20px;margin-bottom:20px;text-align:center;">
                  <div style="font-size:13px;color:rgba(148,163,184,0.8);margin-bottom:4px;">Total Paid</div>
                  <div style="font-size:24px;font-weight:700;color:#10b981;">R${Number(b.total || 0).toFixed(2)} ✅</div>
                </div>

                <p style="font-size:13px;color:rgba(148,163,184,0.8);line-height:1.7;margin:0 0 20px;">
                  Beauty isn't a once-in-a-while thing — it's a lifestyle. When you're ready to treat yourself again, we're just a click away:
                </p>

                <a href="${appBase}" style="display:block;background:linear-gradient(135deg,#ec4899,#8b5cf6);color:#fff;text-align:center;padding:14px 20px;border-radius:14px;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:18px;">
                  Book Your Next Appointment →
                </a>

                ${reviewHtml}

                <p style="font-size:12px;color:rgba(148,163,184,0.4);text-align:center;margin:0;">
                  Ref: ${b.bookingId}
                </p>
                `
            ),
        });
        console.log('Rebook email sent to', b.email);
    } catch (e) {
        console.error('Rebook email error:', e.message);
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    sendAdminDepositNotification,
    sendAdminBalancePaidNotification,
    sendCustomerConfirmationEmail,
    sendBalanceRequestEmail,
    sendRebookEmail,
};
