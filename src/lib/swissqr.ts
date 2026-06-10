// Schweizer QR-Rechnung (Swiss QR-bill) nach ISO 20022 / SIX-Spezifikation v2.x
// Erzeugt den Payload für den Swiss QR Code (Adresstyp "K" = kombinierte Adresse).

export interface QrBillParams {
  creditorIban: string;
  creditorName: string;
  creditorAddressLine1: string; // Strasse + Nr.
  creditorAddressLine2: string; // PLZ + Ort
  amount: number | null; // null = offener Betrag
  currency?: "CHF" | "EUR";
  debtorName?: string;
  debtorAddressLine1?: string;
  debtorAddressLine2?: string;
  message?: string; // Unstrukturierte Mitteilung (z.B. Rechnungsnummer)
}

export function buildQrBillPayload(p: QrBillParams): string {
  const iban = p.creditorIban.replace(/\s+/g, "");
  const hasDebtor = Boolean(p.debtorName);
  const fields = [
    "SPC", // QRType
    "0200", // Version
    "1", // Coding: UTF-8
    iban,
    // Creditor (kombinierte Adresse)
    "K",
    p.creditorName.slice(0, 70),
    p.creditorAddressLine1.slice(0, 70),
    p.creditorAddressLine2.slice(0, 70),
    "",
    "",
    "CH",
    // Ultimate creditor (leer, reserviert)
    "", "", "", "", "", "", "",
    // Betrag
    p.amount != null ? p.amount.toFixed(2) : "",
    p.currency ?? "CHF",
    // Ultimate debtor
    hasDebtor ? "K" : "",
    hasDebtor ? (p.debtorName ?? "").slice(0, 70) : "",
    hasDebtor ? (p.debtorAddressLine1 ?? "").slice(0, 70) : "",
    hasDebtor ? (p.debtorAddressLine2 ?? "").slice(0, 70) : "",
    "",
    "",
    hasDebtor ? "CH" : "",
    // Referenz: NON = ohne Referenz (IBAN ohne QR-IID)
    "NON",
    "",
    (p.message ?? "").slice(0, 140),
    "EPD", // Trailer
  ];
  return fields.join("\n");
}
