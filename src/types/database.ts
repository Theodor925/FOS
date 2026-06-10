// Typen für die wichtigsten Datenbank-Tabellen (vgl. supabase/migrations)

export type AccountType = "private" | "business";

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  canton: string | null;
  account_type: AccountType;
  created_at: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  vendor: string | null;
  amount: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  receipt_date: string | null;
  category: string | null;
  processed: boolean;
  processing_error: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  notes: string | null;
  created_at: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface OutgoingInvoice {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  client_name: string;
  client_address_line1: string | null;
  client_address_line2: string | null;
  subtotal: number;
  vat_total: number;
  total: number;
  notes: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  line_total: number;
  vat_amount: number;
  position: number;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string;
  description: string;
  debit_account: number;
  credit_account: number;
  amount: number;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
}

export interface CompanySettings {
  user_id: string;
  company_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  iban: string | null;
  vat_number: string | null;
  updated_at: string;
}

export type InsightCategory =
  | "anomaly"
  | "savings"
  | "cashflow"
  | "tax"
  | "compliance";

export interface AiInsight {
  id: string;
  user_id: string;
  category: InsightCategory;
  title: string;
  body: string;
  feedback: "helpful" | "not_relevant" | null;
  created_at: string;
}
