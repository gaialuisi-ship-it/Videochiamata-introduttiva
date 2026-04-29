# 📅 SUPSI Booking — Introductory Video Call Scheduler

Web app per la prenotazione di videochiamate introduttive di 15 minuti con integrazione calendario e invio email automatico.

---

## 🗂️ Struttura del progetto

```
supsi-booking/
├── server.js          ← Backend Node.js + Express (API + email + ICS)
├── package.json       ← Dipendenze (express, nodemailer)
├── bookings.json      ← Database JSON auto-generato al primo avvio
├── .env.example       ← Template variabili d'ambiente
└── public/
    └── index.html     ← Frontend bilingue IT/EN (HTML + CSS + JS)
```

---

## 🗄️ Database Schema (bookings.json)

```json
{
  "slots": [
    {
      "id": "uuid-v4",
      "date": "2026-04-29",
      "start": "10:00",
      "end": "10:15",
      "booked": false
    }
  ],
  "bookings": [
    {
      "id": "uuid-v4",
      "slotId": "uuid-v4",
      "name": "Mario Rossi",
      "email": "mario@example.com",
      "bookedAt": "2026-04-28T10:00:00.000Z"
    }
  ]
}
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/slots` | Lista slot disponibili (non prenotati) |
| `POST` | `/api/book` | Prenota uno slot |
| `GET` | `/api/ics/:bookingId` | Scarica file .ics per la prenotazione |

### POST /api/book — Body
```json
{
  "slotId": "uuid-v4",
  "name": "Mario Rossi",
  "email": "mario@example.com"
}
```

### POST /api/book — Response (200)
```json
{
  "success": true,
  "booking": { "id": "...", "slotId": "...", "name": "...", "email": "...", "slot": { ... } },
  "icsContent": "BEGIN:VCALENDAR..."
}
```

---

## 🚀 Deploy — Locale (sviluppo)

### 1. Prerequisiti
- Node.js 18+ installato

### 2. Installa dipendenze
```bash
cd supsi-booking
npm install
```

### 3. Configura l'email
```bash
cp .env.example .env
# Modifica .env con le tue credenziali SMTP
```

### 4. Aggiorna i placeholder in server.js
Cerca e sostituisci:
- `PLACEHOLDER_LINK_TEAMS` → il vero link Teams di Gaia

### 5. Avvia il server
```bash
npm start
# → http://localhost:3000
```

---

## ☁️ Deploy — Railway (consigliato, gratis)

1. Crea account su [railway.app](https://railway.app)
2. **New Project → Deploy from GitHub Repo** (oppure "Deploy from local files")
3. Vai su **Variables** e aggiungi:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
4. Railway assegna automaticamente un URL pubblico tipo `https://supsi-booking.up.railway.app`
5. Condividi quel link!

> ⚠️ **Nota**: Su Railway il file `bookings.json` viene resettato ad ogni deploy. Per produzione, considera di aggiungere un database PostgreSQL (Railway lo offre gratuitamente) o usare [Render](https://render.com) con volume persistente.

---

## ☁️ Deploy — Render (con storage persistente)

1. Crea account su [render.com](https://render.com)
2. **New → Web Service → Connect repo**
3. Start command: `npm start`
4. Environment variables: aggiungi SMTP_*
5. **Add Disk**: `/opt/render/project/src` → questo mantiene `bookings.json` tra i deploy

---

## ☁️ Deploy — VPS / Server dedicato

```bash
# Sul server
git clone <repo> supsi-booking
cd supsi-booking
npm install --production

# Installa PM2 (process manager)
npm install -g pm2
pm2 start server.js --name supsi-booking
pm2 save
pm2 startup

# Nginx reverse proxy (esempio)
# server { listen 80; location / { proxy_pass http://localhost:3000; } }
```

---

## 📧 Configurazione Gmail SMTP

1. Attiva autenticazione a 2 fattori sul tuo account Google
2. Vai su [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Crea "App password" per "Mail"
4. Usa quella password (16 caratteri) come `SMTP_PASS`

---

## 🔧 Personalizzazioni rapide

| Cosa cambiare | Dove |
|---|---|
| Link Teams | `server.js` → `CONFIG.TEAMS_LINK` |
| Email organizzatore | `server.js` → `CONFIG.ORGANIZER_EMAIL` e `ORGANIZER_CC` |
| Slot disponibili | `server.js` → funzione `generateSlots()` |
| Logo / colori | `public/index.html` → variabili CSS `:root` |
| Testi IT/EN | `public/index.html` → attributi `data-it` e `data-en` |

---

## ⚠️ Gestione concorrenza

Il backend usa un meccanismo di **lock ottimistico** sul file JSON:
- Legge il DB → verifica `booked: false` → scrive atomicamente
- In caso di doppia richiesta simultanea, la seconda riceve HTTP 409

Per produzione ad alto traffico, migrare a SQLite (con `better-sqlite3`) o PostgreSQL per transazioni ACID complete.

---

## 📋 Funzionalità incluse

- ✅ UI bilingue IT/EN con toggle
- ✅ Slot per 29 Apr, 30 Apr, prossimo lunedì
- ✅ Slot da 15 minuti generati automaticamente
- ✅ Slot prenotati nascosti/disabilitati
- ✅ Email di conferma con ICS allegato (partecipante + organizzatore)
- ✅ Reminder automatico 1h prima (via VALARM nel file ICS)
- ✅ File .ics scaricabile (compatibile Outlook, Apple Calendar, Google Calendar)
- ✅ Mobile-friendly responsive
- ✅ Gestione errori e stati di caricamento
