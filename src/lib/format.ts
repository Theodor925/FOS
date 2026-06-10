const chf = new Intl.NumberFormat("de-CH", {
  style: "currency",
  currency: "CHF",
});

export function formatCHF(amount: number | null | undefined): string {
  return chf.format(amount ?? 0);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "–";
  return new Date(date).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
