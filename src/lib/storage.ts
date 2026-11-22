// Storage choice for High Voltage systems (50/80/125 kW): Hithium 112S racks (default), Pylontech M1/M5 racks,
// or cabinets (Hithium 112C, Pylontech 261/313). Capacity = customer night kWh (daily × night%); falls back to HV batteries × battery kWh.
// Ported 1:1 to the n8n State Machine as ACTES_STORAGE — change both together.
import { F, type Formulas, type EqItem, type EqLine } from "@/lib/formulas";

export type StorageChoice = "h112s" | "pylon" | "m1" | "m5" | "cab112" | "cab261" | "cab313";
export const STORAGE_LABELS: Record<StorageChoice, string> = {
  h112s: "Hithium", pylon: "Pylontech (M1 / M5)", m1: "Pylontech M1", m5: "Pylontech M5", cab112: "Hithium 112C", cab261: "Pylontech 261", cab313: "Pylontech 313",
};
// Customer picks a group first, then a model inside it.
export type StorageGroup = "bat" | "rack" | "cab";
export const STORAGE_GROUPS: { g: StorageGroup; label: string; opts: StorageChoice[] }[] = [
  { g: "bat", label: "Hithium 16HV", opts: ["h112s"] },
  { g: "rack", label: "راكات", opts: ["m1", "m5"] },
  { g: "cab", label: "كبائن", opts: ["cab261", "cab313", "cab112"] },
];
const up = (x: number) => Math.ceil(x - 1e-9);

// Cabinets are offered only when the capacity is within ± cabTol of a whole number of cabinets.
export function cabCount(cap: number, kwh: number, f: Formulas = F): number {
  const n = Math.round(cap / kwh);
  return n >= 1 && Math.abs(cap - n * kwh) <= f.cabTol + 1e-9 ? n : 0;
}
const cabFit = (key: string, cap: number, kwh: number, f: Formulas): [string, number][] | null => { const n = cabCount(cap, kwh, f); return n ? [[key, n]] : null; };
export const storageAvailable = (choice: StorageChoice, cap: number, f: Formulas = F) => !choice.startsWith("cab") || storageParts(choice, cap, f) !== null;

// Items replacing the Hithium HV batteries + controls; null = keep the Hithium 112S racks.
export function storageParts(choice: StorageChoice, cap: number, f: Formulas = F): [string, number][] | null {
  if (choice === "h112s" || !(cap > 0)) return null;
  if (choice === "cab112") return cabFit("CAB_HITHIUM_112", cap, f.cabKwh, f);
  if (choice === "cab261") return cabFit("CAB_PYLON_261", cap, 261, f);
  if (choice === "cab313") return cabFit("CAB_PYLON_313", cap, 313, f);
  // M1 and M5 both split into several racks; "pylon" (bot) = M1 while one big rack is enough, else M5.
  const n1 = Math.max(f.m1MinBat, up(cap / f.m1Kwh));
  if (choice === "m1" || (choice === "pylon" && n1 <= f.m1MaxBat)) {
    const racks = Math.ceil(n1 / f.m1MaxBat), per = Math.ceil(n1 / racks);
    return [["BAT_PYLON_M1_4_74K", n1], [per <= f.m1RackSmall ? "RACK_M1C_13" : "RACK_M1C_23", racks], ["CTRL_M1C", racks], ["KIT_M1C", racks]];
  }
  const n = Math.max(f.m5MinBat, up(cap / f.m5Kwh)), racks = Math.ceil(n / f.m5MaxBat), per = Math.ceil(n / racks);
  return [["BAT_PYLON_M5_15_68K", n], [per <= f.m5RackSmall ? "RACK_M5_11" : per <= f.m5RackMedium ? "RACK_M5_16" : "RACK_M5_20", racks], ["CTRL_M5", racks], ["KIT_M5", racks]];
}

const isHvBat = (r: EqItem | undefined, l: EqLine) => r?.category === "batteries" && /HV|هاي فولتج/i.test(`${l.key} ${r.name}`);
export const hvCapacity = (lines: EqLine[], items: EqItem[], f: Formulas = F) =>
  lines.reduce((s, l) => s + (isHvBat(items.find((i) => i.key === l.key), l) ? l.qty : 0), 0) * f.batKwh;

export function applyStorage<L extends EqLine>(lines: L[], choice: StorageChoice, items: EqItem[], f: Formulas = F, need?: number): L[] {
  // need = customer night kWh (daily × night%); falls back to HV batteries × kWh when unknown.
  const parts = storageParts(choice, need ?? hvCapacity(lines, items, f), f);
  if (!parts || !lines.length) return lines;
  const found = parts.map(([k, q]) => [items.find((i) => i.key === k), q] as const);
  if (found.some(([r]) => !r)) return lines;
  const keep = lines.filter((l) => { const r = items.find((i) => i.key === l.key); return !isHvBat(r, l) && r?.category !== "battery_controls"; });
  const add = found.map(([r, qty]) => ({ ...lines[0]!, key: r!.key, name: r!.name, unit: r!.unit, price: Number(r!.price ?? 0), qty, specs: Array.isArray(r!.specs) ? (r!.specs as unknown[]).map(String) : [], auto: false }));
  return [...keep, ...add];
}
