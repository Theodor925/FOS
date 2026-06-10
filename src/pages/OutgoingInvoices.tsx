import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatCHF, formatDate } from "@/lib/format";
import { VAT_RATES } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { QrBill } from "@/components/QrBill";
import type {
  Client,
  CompanySettings,
  InvoiceStatus,
  OutgoingInvoice,
} from "@/types/database";

const statusLabels: Record<InvoiceStatus, { label: string; tone: "gray" | "blue" | "green" | "red" }> = {
  draft: { label: "Entwurf", tone: "gray" },
  sent: { label: "Versendet", tone: "blue" },
  paid: { label: "Bezahlt", tone: "green" },
  overdue: { label: "Überfällig", tone: "red" },
};

interface DraftItem {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

const emptyItem = (): DraftItem => ({
  description: "",
  quantity: 1,
  unit_price: 0,
  vat_rate: 8.1,
});

export function OutgoingInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<OutgoingInvoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [qrInvoice, setQrInvoice] = useState<OutgoingInvoice | null>(null);

  // Formular-State
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: inv }, { data: cls }, { data: cfg }] = await Promise.all([
      supabase.from("outgoing_invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("*").order("name"),
      supabase.from("company_settings").select("*").maybeSingle(),
    ]);
    setInvoices((inv as OutgoingInvoice[]) ?? []);
    setClients((cls as Client[]) ?? []);
    setSettings(cfg as CompanySettings | null);
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let vat = 0;
    for (const it of items) {
      const line = it.quantity * it.unit_price;
      subtotal += line;
      vat += (line * it.vat_rate) / 100;
    }
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      total: Math.round((subtotal + vat) * 20) / 20, // Rappenrundung auf 0.05
    };
  }, [items]);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function createInvoice() {
    if (!user) return;
    const client = clients.find((c) => c.id === clientId);
    if (!client) {
      alert("Bitte zuerst einen Kunden anlegen und auswählen.");
      return;
    }
    setSaving(true);
    const { data: numberData } = await supabase.rpc("next_invoice_number");
    const { data: invoice, error } = await supabase
      .from("outgoing_invoices")
      .insert({
        user_id: user.id,
        client_id: client.id,
        invoice_number: (numberData as string) ?? `RE-${new Date().getFullYear()}-0001`,
        status: "draft",
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate,
        // Snapshot der Kundendaten zum Zeitpunkt der Erstellung
        client_name: client.name,
        client_address_line1: client.address_line1,
        client_address_line2: client.address_line2,
        subtotal: totals.subtotal,
        vat_total: totals.vat,
        total: totals.total,
      })
      .select()
      .single();
    if (error || !invoice) {
      setSaving(false);
      alert(`Fehler: ${error?.message}`);
      return;
    }
    await supabase.from("invoice_items").insert(
      items
        .filter((it) => it.description.trim())
        .map((it, i) => ({
          invoice_id: invoice.id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          vat_rate: it.vat_rate,
          position: i + 1,
        }))
    );
    setSaving(false);
    setCreateOpen(false);
    setItems([emptyItem()]);
    setClientId("");
    void load();
  }

  async function setStatus(invoice: OutgoingInvoice, status: InvoiceStatus) {
    await supabase.from("outgoing_invoices").update({ status }).eq("id", invoice.id);
    void load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rechnungen</h1>
          <p className="text-gray-500">Ausgangsrechnungen mit Schweizer QR-Rechnung.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={18} /> Neue Rechnung
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            Noch keine Rechnungen. Erstelle deine erste QR-Rechnung!
          </CardContent>
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-5 py-3 font-medium">Nummer</th>
                <th className="px-5 py-3 font-medium">Kunde</th>
                <th className="px-5 py-3 font-medium">Fällig am</th>
                <th className="px-5 py-3 font-medium text-right">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const st = statusLabels[inv.status];
                return (
                  <tr key={inv.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-5 py-3 font-medium">{inv.invoice_number}</td>
                    <td className="px-5 py-3">{inv.client_name}</td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(inv.due_date)}</td>
                    <td className="px-5 py-3 text-right font-medium">
                      {formatCHF(Number(inv.total))}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setQrInvoice(inv)}>
                          <QrCode size={15} /> QR
                        </Button>
                        {inv.status === "draft" && (
                          <Button size="sm" onClick={() => void setStatus(inv, "sent")}>
                            Versenden
                          </Button>
                        )}
                        {inv.status === "sent" && (
                          <Button size="sm" onClick={() => void setStatus(inv, "paid")}>
                            Als bezahlt markieren
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Rechnung erstellen */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Neue Rechnung"
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kunde</Label>
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Kunde wählen…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Fällig am</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Positionen</Label>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Beschreibung"
                    className="flex-1"
                    value={it.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    className="w-20"
                    title="Menge"
                    value={it.quantity}
                    onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.05"
                    className="w-28"
                    title="Einzelpreis CHF"
                    value={it.unit_price}
                    onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
                  />
                  <Select
                    className="w-44"
                    value={it.vat_rate}
                    onChange={(e) => updateItem(i, { vat_rate: Number(e.target.value) })}
                  >
                    {VAT_RATES.map((v) => (
                      <option key={v.rate} value={v.rate}>
                        {v.label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                    disabled={items.length === 1}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
            >
              <Plus size={15} /> Position
            </Button>
          </div>

          <div className="rounded-lg bg-gray-50 p-4 text-sm">
            <div className="flex justify-between">
              <span>Zwischensumme</span>
              <span>{formatCHF(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>MWST</span>
              <span>{formatCHF(totals.vat)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-semibold">
              <span>Total</span>
              <span>{formatCHF(totals.total)}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void createInvoice()} disabled={saving || !clientId}>
              {saving ? "Erstellen…" : "Rechnung erstellen"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* QR-Rechnung anzeigen */}
      <Dialog
        open={qrInvoice !== null}
        onClose={() => setQrInvoice(null)}
        title={`QR-Rechnung ${qrInvoice?.invoice_number ?? ""}`}
      >
        {qrInvoice &&
          (settings?.iban ? (
            <div className="flex flex-col items-center gap-4">
              <QrBill
                creditorIban={settings.iban}
                creditorName={settings.company_name ?? ""}
                creditorAddressLine1={settings.address_line1 ?? ""}
                creditorAddressLine2={settings.address_line2 ?? ""}
                amount={Number(qrInvoice.total)}
                debtorName={qrInvoice.client_name}
                debtorAddressLine1={qrInvoice.client_address_line1 ?? undefined}
                debtorAddressLine2={qrInvoice.client_address_line2 ?? undefined}
                message={qrInvoice.invoice_number}
              />
              <div className="text-center text-sm text-gray-600">
                <div className="font-medium">{formatCHF(Number(qrInvoice.total))}</div>
                <div>Zahlbar bis {formatDate(qrInvoice.due_date)}</div>
                <div className="mt-1 text-xs text-gray-400">{settings.iban}</div>
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Bitte hinterlege zuerst deine QR-IBAN in den Einstellungen, um QR-Rechnungen zu
              erzeugen.
            </p>
          ))}
      </Dialog>
    </div>
  );
}
