// Edge Function: process-receipt
// Wird vom Database Webhook (INSERT auf receipts) aufgerufen und führt KI-OCR
// via OpenAI Vision (gpt-4o-mini) aus. Schreibt Ergebnis + Journalbuchung.
//
// Secrets: OPENAI_API_KEY, CRON_SECRET (supabase secrets set ...)

import { createClient } from "npm:@supabase/supabase-js@2";

const CATEGORY_ACCOUNTS: Record<string, number> = {
  lebensmittel: 6800,
  bueromaterial: 6500,
  reisekosten: 6640,
  verpflegung: 6642,
  software: 6570,
  marketing: 6600,
  miete: 6000,
  versicherung: 6300,
  fahrzeug: 6200,
  telekommunikation: 6510,
  weiterbildung: 6840,
  beratung: 6530,
  material: 4000,
  uebrige: 6900,
};

const SYSTEM_PROMPT = `Du bist ein Schweizer Buchhaltungs-Assistent. Extrahiere aus dem Beleg-Bild:
- vendor: Name des Lieferanten/Geschäfts
- amount: Gesamtbetrag in CHF (Zahl)
- receipt_date: Datum im Format YYYY-MM-DD
- vat_rate: Schweizer MWST-Satz (8.1, 3.8, 2.6 oder 0)
- category: eine von ${Object.keys(CATEGORY_ACCOUNTS).join(", ")}
Antworte NUR mit validem JSON, ohne Markdown.`;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("x-cron-secret");
  if (authHeader !== Deno.env.get("CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { record } = await req.json();
  const receiptId: string = record.id;

  try {
    // Signierte URL für das Beleg-Bild erzeugen
    const { data: signed, error: signError } = await supabase.storage
      .from("receipts")
      .createSignedUrl(record.file_path, 300);
    if (signError || !signed) throw new Error(`Signed URL: ${signError?.message}`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extrahiere die Beleg-Daten." },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
    }

    const completion = await response.json();
    const extracted = JSON.parse(completion.choices[0].message.content);

    const amount = Number(extracted.amount) || null;
    const vatRate = Number(extracted.vat_rate) || 0;
    const vatAmount =
      amount != null ? Math.round(((amount * vatRate) / (100 + vatRate)) * 100) / 100 : null;
    const category = CATEGORY_ACCOUNTS[extracted.category] ? extracted.category : "uebrige";

    await supabase
      .from("receipts")
      .update({
        vendor: extracted.vendor ?? null,
        amount,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        receipt_date: extracted.receipt_date ?? null,
        category,
        processed: true,
        processing_error: null,
      })
      .eq("id", receiptId);

    // Automatische Journalbuchung: Aufwandskonto an Kasse (1000)
    if (amount != null) {
      await supabase.from("journal_entries").insert({
        user_id: record.user_id,
        entry_date: extracted.receipt_date ?? new Date().toISOString().slice(0, 10),
        description: `Beleg: ${extracted.vendor ?? record.file_name}`,
        debit_account: CATEGORY_ACCOUNTS[category],
        credit_account: 1000,
        amount,
        source_type: "receipt",
        source_id: receiptId,
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    await supabase
      .from("receipts")
      .update({ processing_error: String(err), processed: false })
      .eq("id", receiptId);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
