import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Mail, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import type { Client } from "@/types/database";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
};

export function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    setClients((data as Client[]) ?? []);
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("clients").insert({
      user_id: user.id,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      address_line1: form.address_line1 || null,
      address_line2: form.address_line2 || null,
    });
    setSaving(false);
    if (error) {
      alert(`Fehler: ${error.message}`);
      return;
    }
    setOpen(false);
    setForm(emptyForm);
    void load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kunden</h1>
          <p className="text-gray-500">Dein Kundenstamm für Rechnungen.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={18} /> Neuer Kunde
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            Noch keine Kunden erfasst.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-5">
                <div className="mb-1 font-semibold">{c.name}</div>
                {c.address_line1 && (
                  <div className="text-sm text-gray-500">
                    {c.address_line1}
                    {c.address_line2 && <>, {c.address_line2}</>}
                  </div>
                )}
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={14} /> {c.email}
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} /> {c.phone}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Neuer Kunde">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name / Firma</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Strasse + Nr.</Label>
            <Input
              value={form.address_line1}
              onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
            />
          </div>
          <div>
            <Label>PLZ + Ort</Label>
            <Input
              value={form.address_line2}
              onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
