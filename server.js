const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── CONFIG ────────────────────────────────────────────────────────────────
const CONFIG = {
  ORGANIZER_EMAIL: 'gaia.luisi@supsi.ch',
  ORGANIZER_CC: 'gaia.luisi@supsi.ch',
  TEAMS_LINK: 'https://teams.microsoft.com/meet/345653132728173?p=yFiZe6eViqY3RwnUqJ',
  DB_FILE: path.join(__dirname, 'bookings.json'),
  SMTP: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
};

// ─── SLOTS GENERATOR ────────────────────────────────────────────────────────
function generateSlots() {
  const slots = [];
  const tz = 'Europe/Zurich';

  // Helper: generate 15-min slots between start and end (HH:MM strings)
  function addSlots(dateStr, startTime, endTime) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + 15 <= end) {
      const hh = String(Math.floor(cur / 60)).padStart(2, '0');
      const mm = String(cur % 60).padStart(2, '0');
      const endMin = cur + 15;
      const ehh = String(Math.floor(endMin / 60)).padStart(2, '0');
      const emm = String(endMin % 60).padStart(2, '0');
      const id = crypto.randomUUID();
      slots.push({
        id,
        date: dateStr,
        start: `${hh}:${mm}`,
        end: `${ehh}:${emm}`,
        booked: false,
      });
      cur += 15;
    }
  }

  // Get next Monday
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun,1=Mon,...
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  const mondayStr = nextMonday.toISOString().slice(0, 10);

  // 29 April
  addSlots('2026-04-29', '10:00', '12:00');
  addSlots('2026-04-29', '14:00', '17:00');

  // 30 April
  addSlots('2026-04-30', '09:30', '12:00');
  addSlots('2026-04-30', '14:00', '16:30');

  // Next Monday
  addSlots(mondayStr, '13:00', '17:30');

  return slots;
}

// ─── DATABASE (JSON file) ────────────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(CONFIG.DB_FILE)) {
    const initial = { slots: generateSlots(), bookings: [] };
    fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(CONFIG.DB_FILE, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(db, null, 2));
}

// ─── ICS GENERATOR ──────────────────────────────────────────────────────────
function formatICSDate(dateStr, timeStr) {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM  → YYYYMMDDTHHMMSS (local Zurich → UTC approx)
  const dt = new Date(`${dateStr}T${timeStr}:00+02:00`);
  return dt.toISOString().replace(/[-:]/g, '').replace('.000', '');
}

function generateICS(slot, booking) {
  const uid = crypto.randomUUID();
  const now = new Date().toISOString().replace(/[-:]/g, '').replace('.000', '');
  const dtstart = formatICSDate(slot.date, slot.start);
  const dtend = formatICSDate(slot.date, slot.end);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SUPSI Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}Z`,
    `DTSTART:${dtstart}Z`,
    `DTEND:${dtend}Z`,
    'SUMMARY:Introductory Video Call - SUPSI',
    `DESCRIPTION:Microsoft Teams Meeting\\n${CONFIG.TEAMS_LINK}`,
    `LOCATION:${CONFIG.TEAMS_LINK}`,
    `ORGANIZER;CN=Gaia Luisi:mailto:${CONFIG.ORGANIZER_EMAIL}`,
    `ATTENDEE;CN=${booking.name};RSVP=TRUE:mailto:${booking.email}`,
    `ATTENDEE;CN=Gaia Luisi;RSVP=TRUE:mailto:${CONFIG.ORGANIZER_EMAIL}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:EMAIL',
    'DESCRIPTION:Reminder: SUPSI Video Call in 1 hour',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

// ─── EMAIL SENDER ────────────────────────────────────────────────────────────
async function sendConfirmationEmail(slot, booking, icsContent) {
  const transporter = nodemailer.createTransport(CONFIG.SMTP);

  const dateFormatted = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Europe/Zurich',
  }).format(new Date(`${slot.date}T${slot.start}:00+02:00`));

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e;">
  <div style="border-top: 4px solid #0a3d6b; padding-top: 30px;">
    <img src="https://via.placeholder.com/120x40/0a3d6b/ffffff?text=SUPSI" alt="SUPSI" style="margin-bottom: 30px;">
    <h1 style="font-size: 24px; font-weight: 400; color: #0a3d6b; margin-bottom: 8px;">
      ✅ Prenotazione confermata
    </h1>
    <p style="color: #555; font-size: 15px;">Your call has been successfully booked.</p>
    
    <div style="background: #f0f5ff; border-left: 4px solid #0a3d6b; padding: 20px 24px; margin: 30px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 1px;">DETTAGLI / DETAILS</p>
      <p style="margin: 4px 0; font-size: 16px;"><strong>👤 Nome:</strong> ${booking.name}</p>
      <p style="margin: 4px 0; font-size: 16px;"><strong>📅 Data:</strong> ${dateFormatted}</p>
      <p style="margin: 4px 0; font-size: 16px;"><strong>🕐 Orario:</strong> ${slot.start} – ${slot.end} (CET)</p>
      <p style="margin: 4px 0; font-size: 16px;"><strong>⏱ Durata:</strong> 15 minuti</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${CONFIG.TEAMS_LINK}" style="background: #0a3d6b; color: white; padding: 14px 32px; text-decoration: none; border-radius: 4px; font-size: 15px; display: inline-block;">
        🎥 Unisciti alla chiamata Teams
      </a>
    </div>

    <p style="font-size: 13px; color: #888; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
      Riceverai un reminder 1 ora prima dell'appuntamento.<br>
      Trovi allegato il file .ics per aggiungere l'evento al tuo calendario.<br><br>
      <em>You will receive a reminder 1 hour before the meeting. An .ics file is attached to add this event to your calendar.</em>
    </p>
  </div>
</body>
</html>`;

  const mailOptions = {
    from: `"SUPSI Booking" <${CONFIG.SMTP.auth.user}>`,
    to: booking.email,
    cc: CONFIG.ORGANIZER_CC,
    subject: `✅ Videochiamata SUPSI – ${slot.date} ${slot.start}`,
    html,
    attachments: [
      {
        filename: 'supsi-call.ics',
        content: icsContent,
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
      },
    ],
  };

  await transporter.sendMail(mailOptions);
}

// ─── API ROUTES ──────────────────────────────────────────────────────────────

// GET /api/slots — list available slots
app.get('/api/slots', (req, res) => {
  const db = loadDB();
  const available = db.slots.filter(s => !s.booked);
  res.json(available);
});

// POST /api/book — book a slot
app.post('/api/book', async (req, res) => {
  const { slotId, name, email } = req.body;

  if (!slotId || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const db = loadDB();
  const slot = db.slots.find(s => s.id === slotId);

  if (!slot) {
    return res.status(404).json({ error: 'Slot not found.' });
  }
  if (slot.booked) {
    return res.status(409).json({ error: 'Slot already booked. Please choose another.' });
  }

  // Mark as booked (atomic in this simple JSON approach)
  slot.booked = true;
  const booking = { id: crypto.randomUUID(), slotId, name, email, bookedAt: new Date().toISOString() };
  db.bookings.push(booking);
  saveDB(db);

  // Generate ICS
  const icsContent = generateICS(slot, booking);

  // Send email (non-blocking for UX)
  sendConfirmationEmail(slot, booking, icsContent).catch(err => {
    console.error('Email send error:', err.message);
  });

  res.json({
    success: true,
    booking: { ...booking, slot },
    icsContent,
  });
});

// GET /api/ics/:bookingId — download ICS
app.get('/api/ics/:bookingId', (req, res) => {
  const db = loadDB();
  const booking = db.bookings.find(b => b.id === req.params.bookingId);
  if (!booking) return res.status(404).send('Not found');
  const slot = db.slots.find(s => s.id === booking.slotId);
  const ics = generateICS(slot, booking);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=supsi-call.ics');
  res.send(ics);
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ SUPSI Booking running on http://localhost:${PORT}`);
});
