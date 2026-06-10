import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, Search, CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatCHF, formatDate } from "@/lib/format";
import { categoryById } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import type { Receipt } from "@/types/database";

export function Receipts() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("receipts")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setReceipts((data as Receipt[]) ?? []);
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function handleUpload(files: FileList | null) {
    if (!files || !user) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, file);
      if (uploadError) {
        alert(`Upload fehlgeschlagen: ${uploadError.message}`);
        continue;
      }
      // Der Datenbank-Webhook stösst danach die OCR-Edge-Function an
      await supabase.from("receipts").insert({
        user_id: user.id,
        file_path: path,
        file_name: file.name,
      });
    }
    setUploading(false);
    void load();
  }

  async function openDetail(receipt: Receipt) {
    setSelected(receipt);
    setPreviewUrl(null);
    const { data } = await supabase.storage
      .from("receipts")
      .createSignedUrl(receipt.file_path, 300);
    setPreviewUrl(data?.signedUrl ?? null);
  }

  async function softDelete(receipt: Receipt) {
    await supabase
      .from("receipts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", receipt.id);
    setSelected(null);
    void load();
  }

  const filtered = receipts.filter((r) => {
    const q = query.toLowerCase();
    return (
      !q ||
      r.file_name.toLowerCase().includes(q) ||
      (r.vendor ?? "").toLowerCase().includes(q) ||
      categoryById(r.category).label.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Belege</h1>
          <p className="text-gray-500">Hochladen – die KI erkennt Betrag, MWST und Kategorie.</p>
        </div>
        <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          Beleg hochladen
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => void handleUpload(e.target.files)}
        />
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <Input
          placeholder="Suchen…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            Noch keine Belege. Lade deinen ersten Beleg hoch!
          </CardContent>
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-5 py-3 font-medium">Lieferant / Datei</th>
                <th className="px-5 py-3 font-medium">Datum</th>
                <th className="px-5 py-3 font-medium">Kategorie</th>
                <th className="px-5 py-3 font-medium text-right">Betrag</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  onClick={() => void openDetail(r)}
                >
                  <td className="px-5 py-3 font-medium">{r.vendor ?? r.file_name}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(r.receipt_date)}</td>
                  <td className="px-5 py-3">
                    <Badge tone="blue">{categoryById(r.category).label}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    {r.amount != null ? formatCHF(Number(r.amount)) : "–"}
                  </td>
                  <td className="px-5 py-3">
                    {r.processing_error ? (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <CircleAlert size={15} /> Fehler
                      </span>
                    ) : r.processed ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CircleCheck size={15} /> Verarbeitet
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        <Loader2 size={15} className="animate-spin" /> In Verarbeitung
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.vendor ?? selected?.file_name ?? "Beleg"}
        className="max-w-2xl"
      >
        {selected && (
          <div className="space-y-4">
            {previewUrl &&
              (selected.file_name.toLowerCase().endsWith(".pdf") ? (
                <iframe src={previewUrl} className="h-80 w-full rounded-lg border" title="Beleg" />
              ) : (
                <img
                  src={previewUrl}
                  alt="Beleg"
                  className="max-h-80 w-full rounded-lg border object-contain"
                />
              ))}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Betrag</div>
                <div className="font-medium">
                  {selected.amount != null ? formatCHF(Number(selected.amount)) : "–"}
                </div>
              </div>
              <div>
                <div className="text-gray-500">MWST</div>
                <div className="font-medium">
                  {selected.vat_rate != null ? `${selected.vat_rate}%` : "–"}
                  {selected.vat_amount != null && ` (${formatCHF(Number(selected.vat_amount))})`}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Datum</div>
                <div className="font-medium">{formatDate(selected.receipt_date)}</div>
              </div>
              <div>
                <div className="text-gray-500">Kategorie / Konto</div>
                <div className="font-medium">
                  {categoryById(selected.category).label} ({categoryById(selected.category).account})
                </div>
              </div>
            </div>
            {selected.processing_error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                OCR-Fehler: {selected.processing_error}
              </p>
            )}
            <div className="flex justify-end">
              <Button variant="destructive" size="sm" onClick={() => void softDelete(selected)}>
                <Trash2 size={15} /> In Papierkorb
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
