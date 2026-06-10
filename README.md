# BizManager – KI-Buchhaltung für die Schweiz

KI-gestützte Finanz- und Buchhaltungsplattform für Schweizer KMU, Selbstständige und Privatpersonen. Siehe [ROADMAP.md](./ROADMAP.md) für die komplette Strategie.

## Features (MVP)

- **Auth** – Registrierung/Login mit Kontotyp Privat/Geschäftlich (Supabase Auth)
- **Belege mit KI-OCR** – Upload in privaten Storage, OpenAI Vision extrahiert Betrag, Datum, Lieferant, Kategorie und MWST-Satz (8.1% / 3.8% / 2.6%)
- **Ausgangsrechnungen** – Positionen mit MWST-Berechnung, automatische Rechnungsnummern (RE-YYYY-XXXX), Status-Workflow, **Schweizer QR-Rechnung** (ISO 20022, Swiss QR Code)
- **Doppelte Buchhaltung** – Journal nach Schweizer KMU-Kontenrahmen, automatische Buchungen aus Belegen, manuelle Buchungen
- **Dashboard** – Einnahmen/Ausgaben, Ausgaben nach Kategorie (Recharts)
- **KI-Finanzberater** – täglicher Cron-Job generiert Insights (Anomalien, Sparpotenzial, Cashflow, Steuer, Compliance), max. 5/Tag, mit Feedback
- **Kundenverwaltung** – nur für Geschäftskonten sichtbar
- **Sicherheit** – Row Level Security auf allen Tabellen, privater Storage-Bucket, CRON_SECRET für Edge Functions

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS 4 |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| KI | OpenAI gpt-4o-mini (Vision-OCR + Finanzberater) |
| Charts | Recharts |

## Setup

### 1. Frontend

```bash
npm install
cp .env.example .env   # Supabase-Credentials eintragen
npm run dev
```

### 2. Supabase-Projekt

1. Projekt auf [supabase.com](https://supabase.com) erstellen
2. Migration ausführen (SQL-Editor oder CLI):

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

3. URL + Anon-Key aus *Project Settings → API* in `.env` eintragen.

### 3. Edge Functions deployen

```bash
npx supabase secrets set OPENAI_API_KEY=sk-... CRON_SECRET=$(openssl rand -hex 32)
npx supabase functions deploy process-receipt --no-verify-jwt
npx supabase functions deploy ai-financial-advisor --no-verify-jwt
```

Die Functions authentifizieren sich über den `x-cron-secret`-Header (statt JWT).

### 4. Database Webhook (OCR-Pipeline)

In Supabase unter *Database → Webhooks* einen Webhook anlegen:

- **Tabelle:** `receipts`, **Event:** INSERT
- **URL:** `https://<project-ref>.supabase.co/functions/v1/process-receipt`
- **Header:** `x-cron-secret: <CRON_SECRET>`

### 5. Cron-Job für den KI-Finanzberater

Mit `pg_cron` + `pg_net` (SQL-Editor), täglich 6 Uhr:

```sql
select cron.schedule(
  'daily-financial-advisor',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/ai-financial-advisor',
    headers := '{"x-cron-secret": "<CRON_SECRET>"}'::jsonb
  );
  $$
);
```

## Projektstruktur

```
src/
  components/      Layout, QrBill, UI-Komponenten (shadcn-Stil)
  contexts/        AuthContext (Supabase Auth + Profil)
  lib/             supabase, Kategorien/Kontenrahmen, Swiss QR-Bill Payload
  pages/           Dashboard, Belege, Rechnungen, Buchhaltung, Kunden, Insights, Einstellungen
supabase/
  migrations/      Datenbankschema (Tabellen, RLS, Storage-Policies, Funktionen)
  functions/       process-receipt (OCR), ai-financial-advisor (Insights)
```

## Nächste Schritte (siehe ROADMAP Phase 1)

- [ ] Onboarding-Wizard (3 Schritte) + Demo-Daten
- [ ] Eingangsrechnungen mit Zahlungserinnerungen
- [ ] Wiederkehrende Ausgaben (UI – Tabelle existiert bereits)
- [ ] MWST-Quartalsbericht (ESTV-Codes 200/400/500)
- [ ] Rechnungs-PDF mit eingebetteter QR-Rechnung (Edge Function)
- [ ] Error-Monitoring (Sentry)
