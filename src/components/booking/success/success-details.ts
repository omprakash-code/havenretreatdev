import type { BookingSuccessData } from "@/components/booking/success/types";

export type SuccessDetailRow = {
  label: string;
  value: string;
};

export function buildCelebrationRows(
  data: Pick<BookingSuccessData, "occasionLabel" | "occasionDetails" | "items">
): SuccessDetailRow[] {
  const rows: SuccessDetailRow[] = [];

  if (data.occasionLabel?.trim()) {
    rows.push({
      label: "Occasion",
      value: data.occasionLabel.trim(),
    });
  }

  data.occasionDetails.forEach((detail) => {
    const label = String(detail.label ?? "").trim();
    const value = String(detail.value ?? "").trim();
    if (!label || !value) return;
    rows.push({ label, value });
  });

  const numberedItems = data.items.filter((item) => {
    return Boolean(String(item.numberValue ?? "").trim());
  });
  const labelTotals = new Map<string, number>();
  const labelSeen = new Map<string, number>();

  numberedItems.forEach((item) => {
    const label = String(item.numberLabel ?? item.productName ?? "").trim();
    if (!label) return;
    labelTotals.set(label, (labelTotals.get(label) ?? 0) + 1);
  });

  numberedItems.forEach((item) => {
    const value = String(item.numberValue ?? "").trim();
    const baseLabel = String(item.numberLabel ?? item.productName ?? "").trim();
    if (!baseLabel || !value) return;

    const total = labelTotals.get(baseLabel) ?? 1;
    const nextSeen = (labelSeen.get(baseLabel) ?? 0) + 1;
    labelSeen.set(baseLabel, nextSeen);

    rows.push({
      label: total > 1 ? `${baseLabel} ${nextSeen}` : baseLabel,
      value,
    });
  });

  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.label}::${row.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
