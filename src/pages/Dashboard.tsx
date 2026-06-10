import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Receipt as ReceiptIcon, FileText } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatCHF } from "@/lib/format";
import { categoryById } from "@/lib/categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JournalEntry, Receipt } from "@/types/database";

// Ertragskonten 3000-3999, Aufwand 4000-6999
function isIncome(e: JournalEntry) {
  return e.credit_account >= 3000 && e.credit_account < 4000;
}
function isExpense(e: JournalEntry) {
  return e.debit_account >= 4000 && e.debit_account < 7000;
}

export function Dashboard() {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [invoiceCount, setInvoiceCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .then(({ data }) => setEntries((data as JournalEntry[]) ?? []));
    supabase
      .from("receipts")
      .select("*")
      .is("deleted_at", null)
      .then(({ data }) => setReceipts((data as Receipt[]) ?? []));
    supabase
      .from("outgoing_invoices")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setInvoiceCount(count ?? 0));
  }, [user]);

  const totals = useMemo(() => {
    const income = entries.filter(isIncome).reduce((s, e) => s + Number(e.amount), 0);
    const expenses = entries.filter(isExpense).reduce((s, e) => s + Number(e.amount), 0);
    return { income, expenses };
  }, [entries]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of receipts) {
      if (r.amount == null) continue;
      const key = r.category ?? "uebrige";
      map.set(key, (map.get(key) ?? 0) + Number(r.amount));
    }
    return [...map.entries()]
      .map(([id, value]) => ({
        name: categoryById(id).label,
        value: Math.round(value * 100) / 100,
        color: categoryById(id).color,
      }))
      .sort((a, b) => b.value - a.value);
  }, [receipts]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number }>();
    for (const e of entries) {
      const month = e.entry_date.slice(0, 7);
      const cur = map.get(month) ?? { income: 0, expenses: 0 };
      if (isIncome(e)) cur.income += Number(e.amount);
      if (isExpense(e)) cur.expenses += Number(e.amount);
      map.set(month, cur);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, v]) => ({ month, ...v }));
  }, [entries]);

  const stats = [
    {
      label: "Einnahmen",
      value: formatCHF(totals.income),
      icon: TrendingUp,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Ausgaben",
      value: formatCHF(totals.expenses),
      icon: TrendingDown,
      color: "text-red-600 bg-red-50",
    },
    {
      label: "Belege",
      value: String(receipts.length),
      icon: ReceiptIcon,
      color: "text-brand-600 bg-brand-50",
    },
    {
      label: "Rechnungen",
      value: String(invoiceCount),
      icon: FileText,
      color: "text-purple-600 bg-purple-50",
    },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">
        Willkommen{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>
      <p className="mb-6 text-gray-500">Deine Finanzübersicht auf einen Blick.</p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color}`}>
                <Icon size={22} />
              </div>
              <div>
                <div className="text-sm text-gray-500">{label}</div>
                <div className="text-xl font-bold">{value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Einnahmen vs. Ausgaben (6 Monate)</CardTitle>
          </CardHeader>
          <CardContent>
            {byMonth.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                Noch keine Buchungen vorhanden.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byMonth}>
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v) => formatCHF(Number(v))} />
                  <Bar dataKey="income" name="Einnahmen" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Ausgaben" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ausgaben nach Kategorie</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                Lade Belege hoch, um Auswertungen zu sehen.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {byCategory.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCHF(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
