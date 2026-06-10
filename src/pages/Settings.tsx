import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CANTONS = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE",
  "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH",
];

export function Settings() {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [canton, setCanton] = useState("ZH");
  const [company, setCompany] = useState({
    company_name: "",
    address_line1: "",
    address_line2: "",
    iban: "",
    vat_number: "",
  });
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setCanton(profile.canton ?? "ZH");
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("company_settings")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCompany({
            company_name: data.company_name ?? "",
            address_line1: data.address_line1 ?? "",
            address_line2: data.address_line2 ?? "",
            iban: data.iban ?? "",
            vat_number: data.vat_number ?? "",
          });
        }
      });
  }, [user]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSavedMsg(null);
    const [profileRes, companyRes] = await Promise.all([
      supabase.from("profiles").update({ full_name: fullName, canton }).eq("id", user.id),
      supabase.from("company_settings").upsert({
        user_id: user.id,
        company_name: company.company_name || null,
        address_line1: company.address_line1 || null,
        address_line2: company.address_line2 || null,
        iban: company.iban.replace(/\s+/g, "") || null,
        vat_number: company.vat_number || null,
      }),
    ]);
    setSaving(false);
    const error = profileRes.error ?? companyRes.error;
    setSavedMsg(error ? `Fehler: ${error.message}` : "Gespeichert.");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Einstellungen</h1>
      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>Kanton (für Steuerberechnung)</Label>
              <Select value={canton} onChange={(e) => setCanton(e.target.value)}>
                {CANTONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Firma & QR-Rechnung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Firmenname</Label>
              <Input
                value={company.company_name}
                onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Strasse + Nr.</Label>
                <Input
                  value={company.address_line1}
                  onChange={(e) => setCompany({ ...company, address_line1: e.target.value })}
                />
              </div>
              <div>
                <Label>PLZ + Ort</Label>
                <Input
                  value={company.address_line2}
                  onChange={(e) => setCompany({ ...company, address_line2: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>IBAN / QR-IBAN (für QR-Rechnungen)</Label>
              <Input
                placeholder="CH00 0000 0000 0000 0000 0"
                value={company.iban}
                onChange={(e) => setCompany({ ...company, iban: e.target.value })}
              />
            </div>
            <div>
              <Label>MWST-Nummer (optional)</Label>
              <Input
                placeholder="CHE-123.456.789 MWST"
                value={company.vat_number}
                onChange={(e) => setCompany({ ...company, vat_number: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {savedMsg && (
          <p className={savedMsg.startsWith("Fehler") ? "text-sm text-red-600" : "text-sm text-green-600"}>
            {savedMsg}
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Speichern…" : "Speichern"}
        </Button>
      </form>
    </div>
  );
}
