-- BizManager – Initiales Datenbankschema
-- Schweizer KMU-Buchhaltung mit KI-OCR, QR-Rechnungen und KI-Finanzberater

-- =============================================
-- Profile (wird bei Registrierung automatisch angelegt)
-- =============================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  company_name text,
  canton text default 'ZH',
  account_type text not null default 'business' check (account_type in ('private', 'business')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Eigenes Profil lesen" on public.profiles
  for select using (auth.uid() = id);
create policy "Eigenes Profil ändern" on public.profiles
  for update using (auth.uid() = id);

-- Profil bei Signup automatisch erstellen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, account_type)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'account_type', 'business')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- Belege (Eingangsbelege mit KI-OCR)
-- =============================================
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  vendor text,
  amount numeric(12, 2),
  vat_rate numeric(4, 2),
  vat_amount numeric(12, 2),
  receipt_date date,
  category text,
  processed boolean not null default false,
  processing_error text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index receipts_user_idx on public.receipts (user_id, created_at desc);
alter table public.receipts enable row level security;

create policy "Eigene Belege" on public.receipts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- Kunden
-- =============================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;
create policy "Eigene Kunden" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- Ausgangsrechnungen (mit Kundendaten-Snapshot)
-- =============================================
create table public.outgoing_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue')),
  issue_date date not null default current_date,
  due_date date not null,
  client_name text not null,
  client_address_line1 text,
  client_address_line2 text,
  subtotal numeric(12, 2) not null default 0,
  vat_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, invoice_number)
);

alter table public.outgoing_invoices enable row level security;
create policy "Eigene Rechnungen" on public.outgoing_invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Rechnungspositionen mit Generated Columns für MWST
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.outgoing_invoices (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  vat_rate numeric(4, 2) not null default 8.1,
  line_total numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  vat_amount numeric(12, 2) generated always as (round(quantity * unit_price * vat_rate / 100, 2)) stored,
  position int not null default 1
);

alter table public.invoice_items enable row level security;
create policy "Eigene Rechnungspositionen" on public.invoice_items
  for all using (
    exists (
      select 1 from public.outgoing_invoices i
      where i.id = invoice_id and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.outgoing_invoices i
      where i.id = invoice_id and i.user_id = auth.uid()
    )
  );

-- Automatische Rechnungsnummern: RE-YYYY-XXXX (pro User fortlaufend)
create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  yr text := to_char(current_date, 'YYYY');
  seq int;
begin
  select count(*) + 1 into seq
  from public.outgoing_invoices
  where user_id = auth.uid()
    and invoice_number like 'RE-' || yr || '-%';
  return 'RE-' || yr || '-' || lpad(seq::text, 4, '0');
end;
$$;

-- =============================================
-- Journal (doppelte Buchhaltung)
-- =============================================
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null default current_date,
  description text not null,
  debit_account int not null,
  credit_account int not null,
  amount numeric(12, 2) not null check (amount > 0),
  source_type text default 'manual', -- manual | receipt | invoice | recurring
  source_id uuid,
  created_at timestamptz not null default now()
);

create index journal_user_idx on public.journal_entries (user_id, entry_date desc);
alter table public.journal_entries enable row level security;
create policy "Eigenes Journal" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- Firmeneinstellungen (inkl. IBAN für QR-Rechnung)
-- =============================================
create table public.company_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_name text,
  address_line1 text,
  address_line2 text,
  iban text,
  vat_number text,
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;
create policy "Eigene Einstellungen" on public.company_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- Wiederkehrende Ausgaben
-- =============================================
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null,
  category text,
  interval text not null default 'monthly' check (interval in ('daily', 'weekly', 'monthly', 'yearly')),
  next_due_date date not null,
  created_at timestamptz not null default now()
);

alter table public.recurring_expenses enable row level security;
create policy "Eigene wiederkehrende Ausgaben" on public.recurring_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- KI-Insights (Finanzberater)
-- =============================================
create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('anomaly', 'savings', 'cashflow', 'tax', 'compliance')),
  title text not null,
  body text not null,
  feedback text check (feedback in ('helpful', 'not_relevant')),
  created_at timestamptz not null default now()
);

create index ai_insights_user_idx on public.ai_insights (user_id, created_at desc);
alter table public.ai_insights enable row level security;
create policy "Eigene Insights lesen" on public.ai_insights
  for select using (auth.uid() = user_id);
create policy "Insight-Feedback geben" on public.ai_insights
  for update using (auth.uid() = user_id);

-- Berater-Konfiguration pro User
create table public.advisor_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default true,
  max_insights_per_day int not null default 5,
  updated_at timestamptz not null default now()
);

alter table public.advisor_settings enable row level security;
create policy "Eigene Berater-Einstellungen" on public.advisor_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- Benachrichtigungen
-- =============================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
create policy "Eigene Benachrichtigungen" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- Rollen & Event-Queue
-- =============================================
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'moderator', 'user')),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;
create policy "Eigene Rollen lesen" on public.user_roles
  for select using (auth.uid() = user_id);

create table public.event_queue (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb not null default '{}',
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.event_queue enable row level security;
-- Nur Service-Role (Edge Functions) greift auf die Queue zu: keine Policies für User.

-- =============================================
-- Storage: privater Bucket für Belege
-- =============================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false);

create policy "Eigene Belege hochladen" on storage.objects
  for insert with check (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Eigene Belege lesen" on storage.objects
  for select using (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Eigene Belege löschen" on storage.objects
  for delete using (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
