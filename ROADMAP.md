# BizManager – Strategie & Roadmap zum Financial Operating System (FOS)

> Stand: Juni 2026

---

## 1. Executive Summary

**Was ist BizManager?**

BizManager ist eine KI-gestützte Finanz- und Buchhaltungsplattform für Schweizer KMU, Selbstständige und Privatpersonen. Die App vereinfacht Buchhaltung, automatisiert Belege, generiert Rechnungen mit QR-Code und gibt proaktive Finanzberatung – alles in einer App, zu einem Bruchteil der Kosten von Bexio oder einem Treuhänder.

**Aktuelle Position**

Funktionierender MVP mit Schweizer Kernfunktionalität (MWST, Kantonssteuern, KMU-Kontenrahmen). Erste Wow-Features (KI-Finanzberater, automatische OCR) sind implementiert. Bereit für Beta-Launch.

**Vision**

Das Financial Operating System (FOS) für den DACH-Raum werden. Marktführer in der KI-getriebenen Buchhaltung mit 50'000+ zahlenden Kunden bis 2033.

**Exit-Ziel**

CHF 130 Mio Bewertung in 7 Jahren durch strategischen Verkauf an Schweizer Bank, Versicherung oder Strategic Investor.

### Key Metrics zum Exit

| Metrik | Ziel Jahr 7 |
|---|---|
| Zahlende Kunden | 50'000+ |
| Annual Recurring Revenue (ARR) | CHF 15 Mio |
| Bewertung (10x ARR) | CHF 130–150 Mio |
| Bruttomarge | 85–90% |
| Team-Größe | 30–50 Personen |
| Geografisch | CH + AT + DE |
| Marktanteil DACH | 0.5% |

---

## 2. Aktueller Stand der App

Diese Sektion beschreibt im Detail, was die App heute kann – Feature für Feature, technisch und funktional.

### 2.1 Technische Architektur

**Frontend**
- Plattform: Lovable.dev (Web-App, mobile-responsive)
- Framework: React + TypeScript
- Styling: Tailwind CSS
- UI-Bibliothek: shadcn/ui Komponenten
- Charts: Recharts für Visualisierungen

**Backend**
- Plattform: Supabase (PostgreSQL + Edge Functions)
- Authentifizierung: Supabase Auth (E-Mail/Passwort)
- Storage: Supabase Storage (privater Bucket für Belege)
- Realtime: Supabase Realtime für Live-Updates
- Row Level Security (RLS) auf allen Tabellen

**KI-Integration**
- OCR: OpenAI gpt-4o-mini (Vision API)
- Finanzberater: OpenAI gpt-4o-mini (Tool Use / Function Calling)
- Architektur multi-provider ready (Claude Anthropic optional)

**Edge Functions deployed**
- `process-receipt` – OCR-Verarbeitung von Belegen
- `ai-financial-advisor` – Proaktive Finanz-Insights
- `create-invoice-pdf` – Rechnungs-PDF mit QR-Code generieren
- `archive-receipts` – Automatische Archivierung alter Belege
- `process-email-receipt` – Belege per E-Mail empfangen

**Datenbank-Tabellen**
- `receipts` – Belege (Eingangsrechnungen)
- `invoices` – Lieferantenrechnungen
- `outgoing_invoices` – Ausgangsrechnungen (selbst erstellt)
- `invoice_items` – Positionen auf Ausgangsrechnungen
- `clients` – Kundenstamm
- `company_settings` – Firmendaten + IBAN für QR-Rechnung
- `journal_entries` – Doppelte Buchhaltung
- `recurring_expenses` – Wiederkehrende Ausgaben
- `ai_insights` – KI-generierte Finanz-Insights
- `advisor_settings` – Berater-Konfiguration pro User
- `notifications` – Benachrichtigungen
- `user_roles` – Rollen (Admin, Moderator, User)
- `event_queue` – Asynchrone Verarbeitung

### 2.2 Implementierte Features im Detail

**Authentifizierung & Benutzerverwaltung**
- Registrierung & Login mit E-Mail/Passwort
- Passwort-Reset Funktion
- Zwei Kontotypen: Privat & Geschäftlich (steuert Feature-Sichtbarkeit)
- Profilverwaltung mit Name, Firma, Kanton
- Rollenbasierte Zugriffskontrolle (Admin, Moderator, User)
- Admin-Panel zur Benutzerverwaltung

**Belegverwaltung (Receipts) mit KI-OCR**
- Upload von Belegen (Bilder + PDF) in privaten Supabase-Storage
- KI-OCR-Erkennung via OpenAI Vision (gpt-4o-mini)
  - Automatische Extraktion: Betrag, Datum, Lieferant
  - Kategorie-Zuordnung (14 Schweizer KMU-Kategorien)
  - MWST-Satz-Erkennung (8.1% / 2.6% / 3.8%)
  - MWST-Betrag automatisch berechnet
- Asynchrone Verarbeitung via Database Webhook
- Suche & Filter nach Dateiname, Kategorie, Betrag, Datum
- Detailansicht mit Bild, extrahierten Daten und Journalbuchung
- Soft-Delete (Papierkorb) mit Wiederherstellung
- Fehler-Handling mit `processing_error`-Feld

**Eingangsrechnungen (Invoices)**
- Upload eingehender Rechnungen mit KI-OCR
- Kundenzuordnung über Clients-Tabelle
- Status-Tracking (offen, bezahlt, überfällig)
- Automatische Zahlungserinnerungen (5 Tage & 1 Tag vor Fälligkeit)
- Soft-Delete mit Papierkorb

**Ausgangsrechnungen + QR-Rechnung Schweiz**
- Rechnungen erstellen mit dynamischen Positionen
- Automatische Rechnungsnummer-Generierung (RE-YYYY-XXXX)
- Kundenauswahl aus Clients-Tabelle
- MWST-Berechnung pro Position (Generated Columns in DB)
- PDF-Generierung mit Edge Function
- Schweizer QR-Rechnung nach ISO 20022 Standard
- Status-Workflow: Draft → Sent → Paid → Overdue
- Snapshot-Daten (Kundeninformationen werden bei Erstellung gespeichert)

**Doppelte Buchhaltung**
- Schweizer Kontenrahmen KMU (Konten 1000–8100)
- Automatische Journalbuchungen bei Belegverarbeitung (Soll/Haben)
- Kategorie-zu-Konto-Mapping (z.B. Lebensmittel → 6800)
- Manuelle Buchungserfassung in der Finanzübersicht
- Source-Tracking (welcher Beleg/Rechnung führte zur Buchung)

**Finanzübersicht & Berichte**
- Dashboard mit Gesamteinnahmen, -ausgaben, Beleganzahl
- Kombinierte Ansicht aus automatischen und manuellen Buchungen
- Finanzberichte (Bilanz, Erfolgsrechnung, Cashflow) via Edge Function
- Visuelle Auswertungen mit Recharts
- Ausgaben nach Kategorien gruppiert

**KI-Finanzberater (Killer-Feature)**
- Tägliche automatische Analyse via Cron-Job (6 Uhr morgens)
- 5 Insight-Kategorien:
  - Anomalie-Erkennung (ungewöhnliche Ausgaben)
  - Spar-Potenzial (überflüssige Abos)
  - Cashflow-Vorhersage (30 Tage)
  - Steuer-Optimierung (3a-Tipps, Pendlerabzug)
  - Compliance-Warnung (MWST-Fristen)
- Anti-Spam: Max. 5 Insights pro Tag pro User
- User-Feedback: Hilfreich / Nicht relevant
- Insights-Historie + Filter
- Cron-Secret Sicherheit (autorisierte Aufrufe)

**Kategorien**
- Benutzerdefinierte Kategorien mit Farbe und Icon
- 14 Standard-Kategorien (Lebensmittel, Büromaterial, Reisekosten, Verpflegung, Software, Marketing, etc.)
- Kategorie-zu-Konto-Mapping für Buchhaltung

**Wiederkehrende Ausgaben**
- Vorlagen mit flexiblen Intervallen (täglich, wöchentlich, monatlich, jährlich)
- Automatische Fälligkeitsberechnung
- Dashboard-Widget mit Status-Badges (Überfällig, Heute)
- Automatische Benachrichtigungen (3 Tage, 1 Tag vorher, am Fälligkeitstag)
- Manuelle Journalbuchung aus Vorlage

**Steuer-Modul Schweiz**
- MWST-Quartalsberichte mit Schweizer ESTV-Codes (200, 400, 500)
- Multi-MWST-Satz-Unterstützung (8.1%, 2.6%, 3.8%)
- Kantonale & Gemeindesteuern für alle 26 Kantone
- Steuerberechnung basierend auf Profil-Kanton

**Kundenverwaltung (B2B)**
- Kontakte mit Name, E-Mail, Telefon, Adresse, Notizen
- Verknüpfung mit Ausgangsrechnungen
- Nur sichtbar für Geschäftskonten

**Terminverwaltung (B2B)**
- Kalenderansicht für Termine
- Automatische Erinnerungen (1 Woche, 2 Tage, 1 Tag, 1 Stunde, 15 Min vorher)

**Benachrichtigungssystem**
- Automatische Benachrichtigungen für Rechnungen, Termine, wiederkehrende Ausgaben
- Pending-Notifications-View in der Datenbank
- In-App + E-Mail-Versand via Resend

**Sicherheit**
- Private Storage-Buckets mit signierten URLs
- Row Level Security auf allen Tabellen
- Service-Role-Key nur serverseitig
- Cron-Secret für autorisierte Webhook-Aufrufe
- CRON_SECRET-Validierung in Edge Functions
- Verify JWT auf allen Edge Functions

**Weitere Features**
- Papierkorb mit Wiederherstellung + endgültiges Löschen
- Spotlight-Suche (globale Suchfunktion)
- Resend-Integration für E-Mail-Versand
- Liquiditäts-Check mit E-Mail-Warnungen

---

## 3. Was zum vollwertigen FOS noch fehlt

Auch wenn die App schon sehr stark ist – für einen echten Marktführer im FOS-Bereich fehlen noch strategische Komponenten.

### 3.1 Phase 1 – Sofort (vor Beta-Launch)

**Onboarding-Flow**
- 3-Schritte-Wizard für neue Nutzer
- Profil ausfüllen → Erster Beleg → Erste Rechnung
- Tutorial-Tooltips im Dashboard

**Demo-Daten**
- 5–10 Beispiel-Belege bei Registrierung
- So sieht neuer User sofort, wie die App aussieht, wenn sie genutzt wird
- Können später gelöscht werden mit einem Klick

**Error-Monitoring**
- Sentry-Integration für Edge Function Errors
- Dashboard für Admin: „Welche Belege scheitern bei OCR?"
- Automatische E-Mail an Admin bei kritischen Fehlern

### 3.2 Phase 2 – Kurzfristig (3–6 Monate)

**Bankabgleich (Killer-Feature für KMU)**
- CSV-Import (Bank-Statement Standard)
- CAMT.053-Import (Schweizer Banking Standard)
- PostFinance, Kantonalbanken, Raiffeisen Format-Support
- Automatisches Matching mit bestehenden Buchungen
- Visuelle Bestätigung pro Transaktion

**PDF-Export erweitern**
- MWST-Quartalsbericht als PDF (für Treuhänder)
- Jahresabschluss-Paket
- Bilanz und Erfolgsrechnung formatiert

**KI-Steuererklärung (Beta für Privatpersonen)**
- 3–5 Kantone starten (ZH, BE, BS, GE, VD)
- Basis-Abzüge automatisch zugeordnet
- ePortal-Export für teilnehmende Kantone
- Premium-Feature CHF 99 einmalig

### 3.3 Phase 3 – Mittelfristig (6–12 Monate)

**Angebote / Offerten-Modul**
- Offerten erstellen mit gleichem Workflow wie Rechnungen
- Konvertierung Offerte → Rechnung mit einem Klick
- Status: Entwurf → Versendet → Akzeptiert → Abgelehnt

**Budget-Tracking**
- Budgets pro Kategorie definieren
- Live-Anzeige im Dashboard
- Warnung bei 80% / 100% Überschreitung
- Monatlicher Budget-Report

**Liquiditätsplanung 12 Monate**
- Erweiterte Cashflow-Vorhersage (3 / 6 / 12 Monate)
- Szenarien (Best / Realistic / Worst Case)
- Was-wäre-wenn-Analyse

**Treuhänder-Marketplace**
- User kann Treuhänder anfragen
- Treuhänder bekommt Zugriff auf User-Daten (Read-only)
- Provision an BizManager (15–20% des Treuhänder-Honorars)
- Bewertungssystem für Treuhänder

### 3.4 Phase 4 – Langfristig (12–24 Monate)

**Lohnbuchhaltung (Basic)**
- Mitarbeiter-Verwaltung
- Lohnabrechnung mit AHV/IV/EO/ALV
- Jahres-Lohnausweis
- Quellensteuer-Berechnung

**Multi-Currency**
- EUR/USD-Belege mit Live-Umrechnung in CHF
- Wechselkurs-Historie
- Auslandsrechnungen

**Öffentliche API**
- REST-API für Drittanbieter
- Webhooks für Events
- Developer-Portal mit Dokumentation

**PWA / Native Mobile**
- Progressive Web App für Offline-Nutzung
- Beleg-Scan via Kamera mit AR-Hilfe
- Push-Notifications
- Voice-Input für Schnellbuchungen

**Banking-API-Integration**
- Open-Banking-Anbindung (PostFinance, Raiffeisen, UBS)
- Real-Time-Kontostand
- Automatischer Buchungsabgleich
- Zahlungen aus App auslösen

---

## 4. Go-to-Market Strategie

### 4.1 Zielgruppen-Segmentierung

| Segment | Anzahl CH | Bereitschaft zu zahlen | Pricing-Tier |
|---|---|---|---|
| Selbstständige / Freelancer | ~600'000 | CHF 19–29/Mt | Pro |
| Kleine KMU (1–9 MA) | ~500'000 | CHF 29–79/Mt | Business |
| Mittlere KMU (10–49 MA) | ~80'000 | CHF 79–199/Mt | Enterprise |
| Privatpersonen (Steuerfokus) | ~2'000'000 | CHF 9–19/Mt | Starter |
| Treuhänder | ~5'000 | CHF 99–499/Mt | Partner |

### 4.2 Pricing-Strategie

**Starter – CHF 9/Monat**
- Belege scannen (50/Monat)
- Steuer-Übersicht
- Basis-Dashboard
- KI-Insights begrenzt (3/Tag)
- Zielgruppe: Privatpersonen mit Nebeneinkünften

**Pro – CHF 29/Monat**
- Unbegrenzte Belege
- Ausgangsrechnungen mit QR
- Vollständiger KI-Finanzberater
- Kundenverwaltung
- Zielgruppe: Selbstständige, Freelancer

**Business – CHF 79/Monat**
- Alles aus Pro
- Bankabgleich
- Multi-User (3 Benutzer)
- Lohnbuchhaltung Basic
- Treuhänder-Zugang
- Zielgruppe: Kleine KMU

**Enterprise – CHF 199/Monat**
- Alles aus Business
- Unbegrenzte Benutzer
- Erweiterte Lohnbuchhaltung
- API-Zugang
- Persönlicher Account Manager
- Zielgruppe: Mittlere KMU

**KI-Steuererklärung – CHF 99–299 einmalig pro Jahr**
- Premium-Feature für alle Tiers
- Basic: CHF 99 (Einzelperson, Standard-Abzüge)
- Premium: CHF 199 (komplex, Selbstständige)
- Pro: CHF 299 (mit Treuhänder-Review)

### 4.3 Marketing-Kanäle

**Phase 1: Organisch (Monate 0–12)**
- Content-Marketing (Blog auf Deutsch)
  - „Wie verbuche ich X in der Schweiz?"
  - „Schweizer MWST-Sätze 2026"
  - „Treuhänder oder Software?"
- LinkedIn-Präsenz (Founder-Branding)
- YouTube-Tutorials (Schweizer Buchhaltung)
- SEO-Optimierung
- Reddit r/Schweiz, ch-Foren

**Phase 2: Paid (Monate 12–24)**
- Google Ads (Keywords: „Buchhaltung Schweiz", „Steuererklärung App")
- Meta Ads (Instagram/Facebook)
- LinkedIn Ads (B2B-Fokus)
- Sponsoring von Schweizer Startup-Events

**Phase 3: Partnerschaften (Monate 18+)**
- Treuhänder-Netzwerk aufbauen
- Kantonalbank-Partnerschaften
- Versicherungs-Partner (Mobiliar, AXA)
- Branchenverbände (Gewerbeverband, Treuhand-Suisse)

---

## 5. Die 7-Jahres-Roadmap zum Exit

### Phase 1: Validate (Monate 0–6)

**Ziel:** Product-Market-Fit beweisen

**Kennzahlen am Ende**

| Metrik | Wert |
|---|---|
| Zahlende Kunden | 100 |
| ARR | CHF 30K |
| Bewertung | CHF 0.5 Mio |
| Team | 1 (Solo + Lovable + Claude) |

**Hauptaufgaben**
- MVP fertigstellen (Ausgangsrechnungen ✓, OCR ✓, Berater ✓)
- Onboarding-Flow bauen
- Demo-Daten implementieren
- Pricing einführen (CHF 9 / 29 / 79 / 199 Tiers)
- 50 Beta-User finden (Bekannte, LinkedIn)
- Brand & Marketing-Material erstellen
- Domain & rechtliche Basis (Impressum, AGB, DSGVO)

**Investment**
- Eigenkapital: CHF 5'000–20'000
- Hauptkosten: Tools (Lovable, OpenAI, Supabase), Anwalt für AGB

### Phase 2: Foundation (Monate 6–18)

**Ziel:** Erste Mitarbeiter, Pre-Seed-Funding, Bank-Integrationen

**Kennzahlen am Ende**

| Metrik | Wert |
|---|---|
| Zahlende Kunden | 1'000 |
| ARR | CHF 350K |
| Bewertung | CHF 4–6 Mio |
| Team | 3–5 |

**Hauptaufgaben**
- Pre-Seed Funding: CHF 300–500K (Innosuisse, Angels)
- Co-Founder finden (Sales/Marketing)
- Bankabgleich für PostFinance + Kantonalbanken bauen
- KI-Steuererklärung Beta launchen (Februar 2027)
- Content & SEO ausbauen
- Erste Treuhänder-Partnerschaften

**Risiken & Mitigationen**
- Konkurrenz von Bexio → KI-Differenzierung als USP
- Customer Acquisition Cost zu hoch → Content statt Paid Ads
- Burnout → Co-Founder finden

### Phase 3: Schweizer Marktführer (Monate 18–36)

**Ziel:** Schweiz dominieren, Seed-Runde, Österreich-Launch

**Kennzahlen am Ende**

| Metrik | Wert |
|---|---|
| Zahlende Kunden | 8'000 |
| ARR | CHF 2.5 Mio |
| Bewertung | CHF 20–30 Mio |
| Team | 10–15 |

**Hauptaufgaben**
- Seed-Runde: CHF 2–4 Mio (Schweizer/EU VCs)
- Multi-Country Architektur (CH, AT, DE ready)
- Lohnbuchhaltung Basic implementieren
- Mobile App (PWA + native iOS/Android)
- Österreich-Launch Q4 Jahr 2
- Erste TV/Radio-Kampagne in CH

**Wichtige Hires**
- Marketing Lead
- 3 weitere Engineers
- Customer Success Manager
- Compliance / Legal Lead

### Phase 4: DACH-Expansion (Monate 36–60)

**Ziel:** Deutschland erobern, Series A

**Kennzahlen am Ende**

| Metrik | Wert |
|---|---|
| Zahlende Kunden | 25'000 |
| ARR | CHF 8 Mio |
| Bewertung | CHF 70–90 Mio |
| Team | 25–35 |

**Hauptaufgaben**
- Series A: CHF 8–15 Mio (DACH/EU VCs)
- Country Manager Deutschland
- Datev-Integration (Türöffner zu DE-Steuerberatern)
- ELSTER-Integration (deutsches Steuersystem)
- Großes Marketing-Push DE (Performance + TV)
- Partnerschaften mit deutschen Banken

**Erfolgs-Indikatoren**
- 5'000+ deutsche Kunden im ersten Jahr
- Datev-Zertifizierung erhalten
- Erste größere Strategic Partnerships

### Phase 5: Scale & Exit (Monate 60–84)

**Ziel:** CHF 130 Mio Bewertung erreichen, Exit vorbereiten

**Kennzahlen am Ende**

| Metrik | Wert |
|---|---|
| Zahlende Kunden | 50'000+ |
| ARR | CHF 15 Mio |
| Bewertung | CHF 130–150 Mio |
| Team | 40–60 |

**Exit-Optionen**

*Option A: Strategic Acquisition (am wahrscheinlichsten)*
- Käufer: Schweizer Versicherung (Mobiliar, AXA)
- Vorbild: Bexio-Verkauf an Mobiliar 2018 für ~CHF 100 Mio
- Käufer: Großbank (UBS, Raiffeisen)
- Käufer: Internationaler Konkurrent (Datev, Sage, Intuit)
- Bewertung: 8–12x ARR = CHF 120–180 Mio

*Option B: Series B + Weiterwachsen*
- Series B: CHF 25–50 Mio
- Ziel: CHF 50 Mio ARR in 3 weiteren Jahren
- Eventueller IPO bei CHF 300+ Mio Bewertung

*Option C: Management Buyout*
- Founder kaufen VC-Anteile zurück
- Bleiben profitables Privatunternehmen
- Dividenden-Modell

---

## 6. Wettbewerbsanalyse

### 6.1 Direkte Konkurrenten

| Konkurrent | Stärken | Schwächen | Differenzierung |
|---|---|---|---|
| Bexio (CH) | Marktführer, etabliert | Teuer, kein KI | KI-First, günstiger |
| sevDesk (DE) | Etabliert in DE | Nicht CH-optimiert | Schweizer Fokus |
| Lexware (DE) | Sehr etabliert | Altmodisch | Modern, mobile-first |
| FreshBooks (US) | Global | Nicht DACH-optimiert | DACH-Spezialist |
| Pennylane (FR) | KI-getrieben | Nur Frankreich | DACH-Markt |
| Abacus (CH) | Established CH | Enterprise, teuer | KMU-Fokus, günstig |

### 6.2 USPs

**USP 1: KI-First Architektur**
Alle Konkurrenten haben Buchhaltungs-Software, die KI nachträglich draufgepfropft hat. Diese App ist von Anfang an mit KI gebaut – das ist ein 5-Jahres-Vorsprung, der schwer einzuholen ist.

**USP 2: KI-Steuererklärung**
Niemand bietet eine echte „Klick-und-fertig"-Steuererklärung für Schweizer Privatpersonen. Das ist ein riesiger Schmerzpunkt, der nicht gelöst ist. Wer das schafft, hat ein virales Feature.

**USP 3: Schweizer Spezialisierung mit Internationalisierungs-Pfad**
Start in der Schweiz mit perfekter Lokalisierung (26 Kantone, ESTV, QR-Rechnung), dann Expansion nach AT und DE. Konkurrenz ist entweder nur Schweiz oder zu international.

**USP 4: Treuhänder-Brücke**
Statt Treuhänder zu bekämpfen, werden sie zu Partnern. Treuhänder-Marketplace = neue Einnahmequelle UND Akquise-Kanal.

**USP 5: Privat + KMU in einer App**
Konkurrenten fokussieren auf eines der beiden. BizManager macht beides – wachsende Privatperson wird automatisch zum KMU-Kunden. Lock-in-Effekt.

---

## 7. Team & Organisation

### 7.1 Team-Aufbau über die Zeit

| Phase | Headcount | Schlüssel-Rollen |
|---|---|---|
| Phase 1 (Monate 0–6) | 1 | Solo Founder |
| Phase 2 (Monate 6–18) | 3–5 | +Co-Founder Sales, +2 Engineers |
| Phase 3 (Monate 18–36) | 10–15 | +CMO, +Customer Success, +Compliance |
| Phase 4 (Monate 36–60) | 25–35 | +Country Manager DE, +Sales Team |
| Phase 5 (Monate 60–84) | 40–60 | +CFO, +CTO, +VP Marketing |

### 7.2 Was der Founder selbst nicht können muss

Mit Lovable, Claude und modernen Tools kommt ein Solo-Founder erstaunlich weit. Irgendwann wird aber JEDENFALLS jemand gebraucht für:
- Vertrieb & Marketing (Co-Founder)
- Finanzen & Recht (CFO oder externer Treuhänder)
- Compliance (CH+DE Steuerrecht)
- Customer Support (skaliert nicht mit 1 Person)

### 7.3 Co-Founder-Suche

**Ideales Profil**
- Sales/Marketing-Background
- Schweizer Markt-Kenntnis
- Idealerweise: Erfahrung mit B2B SaaS
- Bereit für 4–5 Jahre Vollzeit
- Komplementäres Skill-Set

**Wo suchen?**
- Schweizer Startup-Events (Startup Days, Venture Kick)
- LinkedIn (gezielt suchen)
- Founder-Communities (Y Combinator, Startup Camp)
- Hochschulen (HSG, ETH-Alumni)

---

## 8. Finanzielle Planung

### 8.1 Umsatzprognose (ARR pro Jahr)

| Jahr | Kunden | Avg Revenue/User/Monat | ARR |
|---|---|---|---|
| Jahr 1 | 100 | CHF 25 | CHF 30K |
| Jahr 2 | 1'000 | CHF 29 | CHF 350K |
| Jahr 3 | 8'000 | CHF 26 | CHF 2.5 Mio |
| Jahr 4 | 15'000 | CHF 32 | CHF 5.8 Mio |
| Jahr 5 | 25'000 | CHF 27 | CHF 8 Mio |
| Jahr 6 | 37'000 | CHF 27 | CHF 12 Mio |
| Jahr 7 | 50'000+ | CHF 25 | CHF 15 Mio |

### 8.2 Funding-Strategie

**Pre-Seed (Monat 6–12)**
- Volumen: CHF 300–500K
- Quelle: Innosuisse, Angels, Family & Friends
- Verwässerung: 5–10%
- Founder-Anteil danach: ~92%

**Seed (Monat 18–24)**
- Volumen: CHF 2–4 Mio
- Quelle: Schweizer VCs (Wingman, Redalpine), EU VCs
- Verwässerung: 15–20%
- Founder-Anteil danach: ~75%

**Series A (Monat 36–48)**
- Volumen: CHF 8–15 Mio
- Quelle: DACH-VCs, ggf. US-VCs (Index, Accel)
- Verwässerung: 20–25%
- Founder-Anteil danach: ~55–60%

**Series B / Exit-Vorbereitung (Monat 60–72)**
- Volumen: CHF 25–50 Mio
- Quelle: Growth Equity
- Verwässerung: 15–25%
- Founder-Anteil danach: ~40–50%

### 8.3 Exit-Szenarien (Founder-Anteil)

| Szenario | Bewertung | Anteil | Brutto |
|---|---|---|---|
| Pessimistisch | CHF 80 Mio | 40% | CHF 32 Mio |
| Realistisch | CHF 130 Mio | 45% | CHF 58 Mio |
| Optimistisch | CHF 180 Mio | 50% | CHF 90 Mio |

Nach Steuern in der Schweiz (~25% Kapitalgewinn auf Aktien für natürliche Personen kann teilweise steuerfrei sein, abhängig von Konstrukt):
- Realistic Case: CHF 40–50 Mio netto
- Optimistic Case: CHF 65–80 Mio netto

---

## 9. Risiken & Mitigationen

### 9.1 Top-Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| Konkurrenz mit Geld | Hoch | Hoch | Schnell sein, USP halten, Community bauen |
| Burnout Solo-Founder | Hoch | Hoch | Co-Founder finden, Aufgaben delegieren |
| Falsches Pricing | Mittel | Hoch | Frühes A/B-Testing mit Beta-Usern |
| VC-Funding scheitert | Mittel | Mittel | Bootstrap länger, profitabel sein |
| Tech-Stack veraltet | Niedrig | Mittel | Modulare Architektur, regelmäßige Updates |
| Compliance-Problem | Mittel | Hoch | Anwalt früh hinzuziehen, Versicherung |
| KI-Provider-Problem | Niedrig | Mittel | Multi-Provider-Architektur |
| Wechselkurs (DE) | Niedrig | Niedrig | Erstmal CH, dann AT, dann DE |

### 9.2 Strategische Warnsignale

Wann muss die Strategie überdacht werden?
- Nach 12 Monaten weniger als 200 zahlende Kunden → Pricing/Positionierung falsch
- Monatliches Wachstum unter 10% → Marketing skaliert nicht
- Churn-Rate über 5%/Monat → Produkt nicht sticky genug
- Customer Acquisition Cost > 12-Monats-LTV → Unit Economics kaputt
- VC-Termine ohne Follow-up → Story funktioniert nicht

---

## 10. Sofortmaßnahmen

### 10.1 Diese Woche

1. **OpenAI Credits aufladen ($5)**
   - Bei https://platform.openai.com/settings/organization/billing
   - Mindestens $5 einzahlen
   - Auto-Recharge aktivieren
   - Neuen API-Key generieren falls nötig
2. **OCR-Funktion testen**
   - Beleg hochladen → schauen ob `processed = true`
   - Falls noch Fehler → Logs prüfen
3. **Onboarding-Flow konzipieren**
   - Welche 3 Schritte soll ein neuer User durchlaufen?
   - Welche Demo-Daten zeigen?

### 10.2 Diesen Monat

- Domain & Name finalisieren
- Logo erstellen lassen (Fiverr/99designs)
- Landing Page bauen (z.B. mit Webflow oder eigene)
- 5 Beta-User aus dem Umkreis finden
- Pricing einführen (auch wenn nur 1–2 zahlen)
- LinkedIn-Profil als Founder polieren

### 10.3 Diesen Quartal

- 20–50 zahlende Kunden
- Erste Beta-User-Interviews durchgeführt
- Onboarding optimiert
- Erstes Marketing-Video (YouTube/LinkedIn)
- Anwalt-Termin für AGB/Datenschutz
- Pre-Seed Pitch Deck v1

### 10.4 Die wichtigste Mindset-Frage

**Bereit für 5–7 Jahre Vollzeit?**

Das ist die einzige Frage, die wirklich zählt. CHF 100+ Mio Exit ist kein Side-Project. Wenn JA – los geht's. Bei Unsicherheit – erstmal ein Side-Business bauen, das CHF 5–10 Mio wert wird. Das ist auch lebensverändernd.

---

## 11. Zusammenfassung

**Was vorhanden ist (heute, Juni 2026)**
- Funktionierende KI-gestützte Finanz-App
- Schweizer Spezialisierung (Kontenrahmen, MWST, 26 Kantone)
- Modernes Tech-Stack (Lovable + Supabase + OpenAI)
- Differenzierte Features (KI-Berater, QR-Rechnung)
- Skalierbare Architektur

**Was gebraucht wird (nächste 7 Jahre)**
- Co-Founder oder starkes Team
- CHF 15–20 Mio Investment über mehrere Runden
- Killer-USP: KI-Steuererklärung als Differenzierung
- DACH-Expansion (CH → AT → DE)
- Treuhänder-Netzwerk
- Operative Exzellenz (Marketing, Sales, Support)

**Realistische Erwartung**

CHF 130 Mio in 7 Jahren = ambitioniert aber machbar. Wahrscheinlichkeit: 5–10% wenn alles richtig gemacht wird. Aber selbst ein CHF 20–50 Mio Exit (Wahrscheinlichkeit 15–25%) wäre lebensverändernd.

**Fazit**

Bessere Ausgangsposition als 95% aller Founder: funktionierender Code, Vision, technisches Verständnis und schnelle Iteration mit modernen Tools (Lovable, Claude).

Was fehlt, ist nicht Tech-Skill, sondern:
- Sales/Marketing-Erfahrung (lernen oder Co-Founder)
- Geduld für 7 Jahre Marathonarbeit
- Netzwerk für Funding & Partnerschaften

Das sind LERNBARE Dinge – keine angeborenen Talente.

**Tipp:** Fokus auf die nächsten 3 Monate, nicht auf 7 Jahre. Wer in 3 Monaten 50 zahlende Kunden hat und monatlich wächst – dann ist alles möglich. Wenn nicht, wurden wertvolle Erkenntnisse über den Markt gewonnen, und es kann justiert werden.

---

> *Erfolg ist nicht garantiert. Aber wer nicht startet, dessen Scheitern ist garantiert.*
