// Explains, with the live values from the "المعادلات" screen, how each equation-driven line was computed.
// Uses the same functions as applyEquations / sizing, so the shown numbers always match the quote.
import { F, maxPerString, stringCount, dcBoxes, acBreakerAmps, hvAccessories, type Formulas, type EqItem, type Phase } from "@/lib/formulas";
import { kwpOf } from "@/lib/sizing";

export type DetailLine = { key: string; name: string; qty: number };
export type DetailRow = { title: string; item?: string; steps: string[]; result: string };
const n = (x: number, d = 2) => String(Math.round(x * 10 ** d) / 10 ** d);

export function explainEquations(lines: DetailLine[], items: EqItem[], opts: { need?: number | null; nightPct?: number | null; loadKw?: number | null } = {}, f: Formulas = F): DetailRow[] {
  const byKey = (k: string) => items.find((i) => i.key === k);
  const cat = lines.map((l) => byKey(l.key));
  const sum = (c: string) => lines.reduce((s, l, i) => s + (cat[i]?.category === c ? l.qty : 0), 0);
  const invQty = sum("inverters"), panels = sum("panels");
  const invLines = lines.filter((_, i) => cat[i]?.category === "inverters");
  const invText = invLines.map((l) => `${l.name} ${l.key}`).join(" ");
  const hv = /جهد عالي|_HV\b|\bHV\b/i.test(invText);
  const three: Phase = hv ? "hv" : /ثري|3\s*فاز|three|LP3|_3P/i.test(invText);
  const rows: DetailRow[] = [];
  const need = opts.need ?? null;

  if (need && need > 0) {
    const kwp = kwpOf(need, f);
    rows.push({ title: "قدرة الألواح المطلوبة", steps: [`kWp = الاستهلاك اليومي ÷ ساعات الشمس`, `= ${n(need)} ÷ ${f.sun}`], result: `${n(kwp)} kWp` });
    if (invLines[0]) {
      const kw = Number((invLines[0].key.match(/_(\d+)K_/) ?? [])[1] ?? 0);
      const pm = f.pvMax?.[invLines[0].key], use = (pm || kw) * f.pvSafety;
      if (kw) {
        const byPv = Math.ceil(kwp / use - 1e-9), load = opts.loadKw ?? 0, byLoad = load > 0 ? Math.ceil(load / kw - 1e-9) : 0;
        rows.push({ title: "عدد الإنفرترات", item: invLines[0].name, steps: [
          `دخل الألواح المسموح = أقصى دخل PV × معامل الأمان = ${pm || kw} × ${f.pvSafety} = ${n(use)} kWp`,
          `حسب الألواح = ⌈قدرة الألواح ÷ دخل الألواح المسموح⌉ = ⌈${n(kwp)} ÷ ${n(use)}⌉ = ${byPv}`,
          ...(byLoad ? [`حسب الحمل = ⌈أقصى حمل تشغيلي ÷ قدرة الإنفرتر⌉ = ⌈${n(load)} ÷ ${kw}⌉ = ${byLoad}`, `العدد = max(${byLoad}، ${byPv})`] : []),
          hv ? `القدرة > ${f.lvMaxKw} kW → جهد عالي HV` : `القدرة ≤ ${f.lvMaxKw} kW → جهد منخفض LV`], result: `${invQty} إنفرتر` });
      }
    }
    if (panels) {
      const w = (Number((lines.find((_, i) => cat[i]?.category === "panels")?.name.match(/(\d{3})\s*W?/i) ?? [])[1]) || f.panelW);
      rows.push({ title: "عدد الألواح", steps: [`الألواح = ⌈kWp × 1000 ÷ قدرة اللوح⌉ (مقرّبة لتتساوى السترنجات)`, `= ⌈${n(kwp)} × 1000 ÷ ${w}⌉`], result: `${panels} لوح` });
    }
    if (opts.nightPct) {
      const night = (need * opts.nightPct) / 100;
      rows.push({ title: "سعة التخزين الليلي", steps: [`الليلي = الاستهلاك اليومي × نسبة الليل`, `= ${n(need)} × ${opts.nightPct}%`, `عمق التفريغ DoD = ${f.dod}`], result: `${n(night)} kWh` });
    }
  }

  if (!invQty || !panels) return rows;
  const vmax = three === "hv" ? f.vmaxHV : three ? f.vmaxThree : f.vmaxSingle;
  const per = maxPerString(three, f), strings = stringCount(panels, three, invQty, f);
  rows.push({ title: "السترنجات", steps: [`أقصى ألواح في السترنج = ⌊Vmax ÷ (Voc × معامل البرد)⌋`, `= ⌊${vmax} ÷ (${f.panelVoc} × ${f.coldFactor})⌋ = ${per}`, `السترنجات = max(عدد الإنفرترات، ⌈الألواح ÷ ${per}⌉) = max(${invQty}، ⌈${panels} ÷ ${per}⌉)`], result: `${strings} سترنج` });

  lines.forEach((l, i) => {
    const r = cat[i]; if (!r) return;
    if (r.category === "dc_boxes") {
      const b = dcBoxes(strings, f);
      rows.push({ title: "صندوق DC", item: l.name, steps: [`الكمية = ⌈السترنجات ÷ أكبر صندوق⌉ = ⌈${strings} ÷ ${f.dcMaxLines}⌉ = ${b.qty}`, `المداخل = ⌈(${strings} ÷ ${b.qty}) ÷ ${f.dcStep}⌉ × ${f.dcStep} = ${b.lines}`], result: `${b.qty} × صندوق ${b.lines} مدخل` });
    } else if (/mc4/i.test(r.key)) {
      rows.push({ title: "موصلات MC4", item: l.name, steps: [`الكمية = السترنجات × أطقم لكل سترنج`, `= ${strings} × ${f.mc4PerString}`], result: `${l.qty}` });
    } else if (r.category === "cables") {
      rows.push({ title: "الكابل", item: l.name, steps: [`الكمية = قيمة ثابتة من المعادلات (${f.cableM} م)`], result: `${l.qty}` });
    } else if (r.category === "ac_panel" || r.category === "combiner_panels") {
      const kw = invLines.reduce((s, x) => s + Number((x.key.match(/_(\d+)K_/) ?? [])[1] ?? 0) * x.qty, 0);
      const amps = kw ? acBreakerAmps(kw * 1000, three !== false, f) : 0;
      rows.push({ title: invQty >= 2 ? "لوحة تجميع (Combiner)" : "لوحة AC", item: l.name, steps: [`عدد الإنفرترات = ${invQty} → ${invQty >= 2 ? "لوحة تجميع" : "لوحة AC عادية"}`, ...(kw ? [three !== false ? `أمبير القاطع = W ÷ ${f.acThreeDiv} × ${f.acSafety} = ${kw * 1000} ÷ ${f.acThreeDiv} × ${f.acSafety}` : `أمبير القاطع = W ÷ ${f.acSingleV} × ${f.acSafety} = ${kw * 1000} ÷ ${f.acSingleV} × ${f.acSafety}`] : [])], result: kw ? `${n(amps, 1)} A` : `${l.qty}` });
    }
  });

  if (hv) {
    const bat = lines.reduce((s, l, i) => s + (cat[i]?.category === "batteries" && /HV|هاي فولتج/i.test(`${l.key} ${cat[i]?.name}`) ? l.qty : 0), 0);
    if (bat) {
      const a = hvAccessories(bat, f);
      rows.push({ title: "ملحقات بطاريات HV", steps: [`البطاريات = max(${f.hvMinBat}، ${bat}) = ${a.bat}`, `BCU = ⌈${a.bat} ÷ ${f.hvBatPerBcu}⌉ = ${a.bcu}`, `EBC = مجموعات فيها أكثر من ${f.ebcOver} بطاريات = ${a.ebc}`, `حماية DC = عدد BCU = ${a.bdc}`], result: `BCU ${a.bcu} · EBC ${a.ebc} · DC ${a.bdc}` });
    }
  }
  return rows;
}
