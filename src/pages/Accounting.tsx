import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatCHF, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { JournalEntry } from "@/types/database";

export function Accounting() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    debit_account: "",
    credit_account: "",
    amount: "",
  });

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .limit(200);
    setEntries((data as JournalEntry[]) ?? []);
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("journal_entries").insert({
      user_id: user.id,
      entry_date: form.entry_date,
      description: form.description,
      debit_account: Number(form.debit_account),
      credit_account: Number(form.credit_account),
      amount: Number(form.amount),
      source_type: "manual",
    });
    setSaving(false);
    if (error) {
      alert(`Fehler: ${error.message}`);
      return;
    }
    setOpen(false);
    setForm({ ...form, description: "", debit_account: "", credit_account: "", amount: "" });
    void load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Buchhaltung</h1>
          <p className="text-gray-500">
            Journal – doppelte Buchhaltung nach Schweizer KMU-Kontenrahmen.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={18} /> Manuelle Buchung
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            Noch keine Buchungen. Belege werden automatisch verbucht.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-5 py-3 font-medium">Datum</th>
                <th className="px-5 py-3 font-medium">Beschreibung</th>
                <th className="px-5 py-3 font-medium">Soll</th>
                <th className="px-5 py-3 font-medium">Haben</th>
                <th className="px-5 py-3 font-medium text-right">Betrag</th>
                <th className="px-5 py-3 font-medium">Quelle</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3 text-gray-500">{formatDate(e.entry_date)}</td>
                  <td className="px-5 py-3 font-medium">{e.description}</td>
                  <td className="px-5 py-3">{e.debit_account}</td>
                  <td className="px-5 py-3">{e.credit_account}</td>
                  <td className="px-5 py-3 text-right font-medium">
                    {formatCHF(Number(e.amount))}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={e.source_type === "manual" ? "gray" : "blue"}>
                      {e.source_type === "receipt"
                        ? "Beleg"
                        : e.source_type === "invoice"
                          ? "Rechnung"
                          : "Manuell"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Manuelle Buchung">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Datum</Label>
            <Input
              type="date"
              required
              value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Beschreibung</Label>
            <Input
              required
              placeholder="z.B. Barverkauf"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Soll-Konto</Label>
              <Input
                type="number"
                required
                min={1000}
                max={9999}
                placeholder="z.B. 6500"
                value={form.debit_account}
                onChange={(e) => setForm({ ...form, debit_account: e.target.value })}
              />
            </div>
            <div>
              <Label>Haben-Konto</Label>
              <Input
                type="number"
                required
                min={1000}
                max={9999}
                placeholder="z.B. 1020"
                value={form.credit_account}
                onChange={(e) => setForm({ ...form, credit_account: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Betrag (CHF)</Label>
            <Input
              type="number"
              required
              min={0.01}
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern…" : "Buchen"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
