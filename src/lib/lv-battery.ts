// Low Voltage battery brand choice: equal-size batteries the customer picks between.
// 16 kWh: Hithium 16kWh ↔ Fidus 16kWh · 5.12 kWh: UF5000 ↔ Fidus Pro. Same count, only the model changes.
// Ported to the n8n State Machine as ACTES_LVBAT — change both together.
export type LvBatOpt = "h16" | "f16" | "uf" | "fp";
export const LV_BAT_LABELS: Record<LvBatOpt, string> = { h16: "Hithium 16kWh", f16: "Fidus 16kWh", uf: "UF5000 5.12kWh", fp: "Fidus Pro 5.12kWh" };
export const LV_BAT_GROUPS: LvBatOpt[][] = [["h16", "f16"], ["uf", "fp"]];
type It = { key: string; name: string };

export function lvBatOf(key: string, name: string): LvBatOpt | null {
  const n = name ?? "";
  if (/هاي فولتج|HV/i.test(`${key} ${n}`)) return null;
  if (/فيدوس برو|fidus\s*pro/i.test(n)) return "fp";
  if (key === "BAT_FIDUS_16K" || (/فيدوس|fidus/i.test(n) && /16/.test(n))) return "f16";
  if (key === "BAT_HITHIUM_16K_LV" || (/هيثيوم|hithium/i.test(n) && /16 كيلو/.test(n))) return "h16";
  if (key === "BAT_UF5000" || (/بايلونتك/.test(n) && /5\.12/.test(n))) return "uf";
  return null;
}
export const lvGroupOf = (o: LvBatOpt) => LV_BAT_GROUPS.find((g) => g.includes(o))!;
export const lvCatalogItem = <T extends It>(o: LvBatOpt, items: T[]) => items.find((i) => !i.key.startsWith("pdf:") && lvBatOf(i.key, i.name) === o);

// Options to show for the current quote lines (one group, only options present in the catalog).
export function lvChoices<T extends It>(lines: It[], items: T[]): { current: LvBatOpt; opts: LvBatOpt[] } | null {
  for (const l of lines) {
    const c = lvBatOf(l.key, l.name);
    if (!c) continue;
    const opts = lvGroupOf(c).filter((o) => o === c || lvCatalogItem(o, items));
    return opts.length > 1 ? { current: c, opts } : null;
  }
  return null;
}
