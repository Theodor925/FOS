// 14 Schweizer KMU-Standardkategorien mit Mapping auf den KMU-Kontenrahmen
export interface Category {
  id: string;
  label: string;
  account: number; // Aufwandskonto im Schweizer KMU-Kontenrahmen
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: "lebensmittel", label: "Lebensmittel", account: 6800, color: "#22c55e" },
  { id: "bueromaterial", label: "Büromaterial", account: 6500, color: "#3b82f6" },
  { id: "reisekosten", label: "Reisekosten", account: 6640, color: "#f59e0b" },
  { id: "verpflegung", label: "Verpflegung & Repräsentation", account: 6642, color: "#ef4444" },
  { id: "software", label: "Software & IT", account: 6570, color: "#8b5cf6" },
  { id: "marketing", label: "Marketing & Werbung", account: 6600, color: "#ec4899" },
  { id: "miete", label: "Miete & Nebenkosten", account: 6000, color: "#14b8a6" },
  { id: "versicherung", label: "Versicherungen", account: 6300, color: "#6366f1" },
  { id: "fahrzeug", label: "Fahrzeugkosten", account: 6200, color: "#f97316" },
  { id: "telekommunikation", label: "Telefon & Internet", account: 6510, color: "#06b6d4" },
  { id: "weiterbildung", label: "Weiterbildung", account: 6840, color: "#84cc16" },
  { id: "beratung", label: "Beratung & Treuhand", account: 6530, color: "#a855f7" },
  { id: "material", label: "Material & Waren", account: 4000, color: "#78716c" },
  { id: "uebrige", label: "Übriger Aufwand", account: 6900, color: "#94a3b8" },
];

export function categoryById(id: string | null | undefined): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

// Schweizer MWST-Sätze (Stand 2026)
export const VAT_RATES = [
  { rate: 8.1, label: "8.1% Normalsatz" },
  { rate: 3.8, label: "3.8% Sondersatz Beherbergung" },
  { rate: 2.6, label: "2.6% Reduzierter Satz" },
  { rate: 0, label: "0% Befreit" },
] as const;
