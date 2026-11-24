// Explains, with the live values from the "المعادلات" screen, how each equation-driven line was computed.
// Uses the same functions as applyEquations / sizing, so the shown numbers always match the quote.
import { F, maxPerString, stringLayout, dcBoxes, acBreakerAmps, hvAccessories, type Formulas, type EqItem, type Phase } from "@/lib/formulas";
import { kwpOf, pvUnits } from "@/lib/sizing";

export type DetailLine = { key: string; name: string; qty: number };
export type DetailRow = { title: string; item?: string; steps: string[]; result: string; breaker?: { kind: "branch" | "main"; qty: number; amps: number }; storage?: { qty: number; unitKwh?: number; totalKwh?: number } };
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
        const byPv = pvUnits(kwp, pm || kw, f.pvSafety), byPvSafe = Math.ceil(kwp / use - 1e-9), load = opts.loadKw ?? 0, byLoad = load > 0 ? Math.ceil(load / kw - 1e-9) : 0;
        rows.push({ title: "عدد الإنفرترات", item: invLines[0].name, steps: [
          `دخل الألواح المسموح = أقصى دخل PV × معامل الأمان = ${pm || kw} × ${f.pvSafety} = ${n(use)} kWp`,
          `حسب الألواح = ⌈قدرة الألواح ÷ دخل الألواح المسموح⌉ = ⌈${n(kwp)} ÷ ${n(use)}⌉ = ${byPvSafe}`,
          ...(byPv < byPvSafe ? [`لا يتجاوز الحد الحقيقي: ${n(kwp)} ≤ ${byPv} × ${pm || kw} = ${n(byPv * (pm || kw))} kWp → ${byPv} يكفي`] : []),
          ...(byLoad ? [`حسب الحمل = ⌈أقصى حمل تشغيلي ÷ قدرة الإنفرتر⌉ = ⌈${n(load)} ÷ ${kw}⌉ = ${byLoad}`, `العدد = max(${byLoad}، ${byPv})`] : []),
          hv ? `القدرة > ${f.lvMaxKw} kW → جهد عالي HV` : `القدرة ≤ ${f.lvMaxKw} kW → جهد منخفض LV`], result: `${invQty} إنفرتر` });
      }
    }
    if (panels) {
      const w = (Number((lines.find((_, i) => cat[i]?.category === "panels")?.name.match(/(\d{3})\s*W?/i) ?? [])[1]) || f.panelW);
      rows.push({ title: "عدد الألواح", steps: [`الألواح = ⌈kWp × 1000 ÷ قدرة اللوح⌉`, `= ⌈${n(kwp)} × 1000 ÷ ${w}⌉`], result: `${panels} لوح` });
    }
  }

  // Always show the actual quote quantity, including manually edited/preset quantities.
  lines.forEach((line, i) => {
    if (cat[i]?.category !== "batteries") return;
    const key = line.key;
    const cabinet = /^CAB_/.test(key);
    const pylon = /BAT_PYLON_M[15]_/.test(key);
    const hithium = /BAT_(HITHIUM_16K|FIDUS_16K)/.test(key);
    const kwh = /BAT_PYLON_M1_/.test(key) ? f.m1Kwh : /BAT_PYLON_M5_/.test(key) ? f.m5Kwh
      : key === "CAB_HITHIUM_112" ? f.cabKwh : key === "CAB_PYLON_261" ? 261 : key === "CAB_PYLON_313" ? 313
      : hithium ? f.batKwh : /BAT_UF5000|فيدوس برو|fidus\s*pro/i.test(`${key} ${line.name}`) ? 5.12 : null;
    const unit = cabinet ? "كبينة" : "بطارية";
    const steps = [`العدد المعتمد في العرض = ${line.qty} ${unit}`];
    if (kwh && kwh > 0) {
      steps.push(`سعة ${cabinet ? "الكبينة" : "البطارية"} الواحدة = ${n(kwh)} kWh`);
      const night = need && need > 0 && opts.nightPct != null ? need * opts.nightPct / 100 : null;
      if (night != null) {
        steps.push(`استهلاك الليل = ${n(need ?? 0)} × ${opts.nightPct}% = ${n(night)} kWh`);
        if (cabinet) {
          steps.push(`العدد حسب السعة = تقريب(${n(night)} ÷ ${n(kwh)}) = ${Math.round(night / kwh)}`, `سماحية فرق سعة الكبائن = ±${f.cabTol} kWh`);
        } else if (pylon) {
          const min = /BAT_PYLON_M1_/.test(key) ? f.m1MinBat : f.m5MinBat;
          steps.push(`العدد حسب السعة = ⌈${n(night)} ÷ ${n(kwh)}⌉ = ${Math.ceil(night / kwh - 1e-9)}`, `الحد الأدنى لهذا النوع = ${min} بطارية`);
        } else if (hithium) {
          const c = Math.max(1, Math.ceil(night / (kwh * f.dod) - 1e-9));
          steps.push(`عدد البطاريات = ⌈استهلاك الليل ÷ (سعة البطارية × DoD)⌉ = ⌈${n(night)} ÷ (${n(kwh)} × ${f.dod})⌉ = ${c}`, ...(hv ? [`الحد الأدنى لبطاريات HV = ${f.hvMinBat}`] : []));
        }
      }
      steps.push(`إجمالي سعة التخزين = العدد × سعة ${cabinet ? "الكبينة" : "البطارية"} = ${line.qty} × ${n(kwh)} = ${n(line.qty * kwh)} kWh`);
    }
    rows.push({ title: cabinet ? "سعة التخزين الليلي — عدد الكبائن" : "سعة التخزين الليلي — عدد البطاريات", item: line.name, steps, result: `${line.qty} ${unit}`, storage: { qty: line.qty, ...(kwh && kwh > 0 ? { unitKwh: kwh, totalKwh: line.qty * kwh } : {}) } });
  });

  if (!invQty || !panels) return rows;
  const vmax = three === "hv" ? f.vmaxHV : three ? f.vmaxThree : f.vmaxSingle;
  const max = maxPerString(three, f), { per, strings } = stringLayout(panels, three, invQty, f);
  rows.push({ title: "السترنجات", steps: [`أقصى ألواح في السترنج = ⌊Vmax ÷ (Voc × معامل الأمان الحراري)⌋`, `= ⌊${vmax} ÷ (${f.panelVoc} × ${f.coldFactor})⌋ = ${max}`, `ألواح السترنج = ${per} ≤ ${max} (أكبر عدد يقسم الألواح دون كسور، مع سترنج لكل إنفرتر على الأقل)`, `السترنجات = الألواح ÷ ألواح السترنج = ${panels} ÷ ${per} = ${strings}`], result: `${strings} سترنج` });

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
      const divisor = three !== false ? f.acThreeDiv : f.acSingleV;
      if (invQty >= 2) {
        rows.push({ title: "لوحة تجميع (Combiner)", item: l.name, steps: [`عدد القواطع الفرعية = عدد الإنفرترات = ${invQty} (قاطع لكل إنفرتر)`, "عدد القواطع الرئيسية = 1"], result: `${invQty} فرعي + 1 رئيسي` });
        invLines.forEach((inv) => {
          const unitKw = Number((inv.key.match(/_(\d+)K_/) ?? [])[1] ?? 0);
          const branchAmps = acBreakerAmps(unitKw * 1000, three !== false, f);
          rows.push({ title: "القواطع الفرعية", item: inv.name, steps: [
            `عدد القواطع = ${inv.qty} (قاطع لكل إنفرتر)`,
            ...(unitKw ? [`قدرة الإنفرتر الواحد = ${unitKw} kW`, `أمبير كل قاطع = قدرة إنفرتر واحد بالواط ÷ ${divisor} × ${f.acSafety}`, `= ${unitKw * 1000} ÷ ${divisor} × ${f.acSafety} = ${n(branchAmps, 1)} A`] : ["قدرة الإنفرتر غير متاحة لحساب الأمبير"]),
          ], result: unitKw ? `${inv.qty} × ${n(branchAmps, 1)} A` : `${inv.qty} قاطع`, ...(unitKw ? { breaker: { kind: "branch" as const, qty: inv.qty, amps: branchAmps } } : {}) });
        });
      }
      rows.push({ title: invQty >= 2 ? "القاطع الرئيسي للوحة التجميع" : "قاطع لوحة AC", item: l.name, steps: [
        "عدد القواطع = 1",
        ...(kw ? [`إجمالي قدرة الإنفرترات = ${invLines.map((inv) => `${Number((inv.key.match(/_(\d+)K_/) ?? [])[1] ?? 0)} × ${inv.qty}`).join(" + ")} = ${kw} kW`, `أمبير القاطع = مجموع قدرة الإنفرترات بالواط ÷ ${divisor} × ${f.acSafety}`, `= ${kw * 1000} ÷ ${divisor} × ${f.acSafety} = ${n(amps, 1)} A`] : ["قدرة الإنفرترات غير متاحة لحساب الأمبير"]),
      ], result: kw ? `1 × ${n(amps, 1)} A` : "1 قاطع", ...(kw ? { breaker: { kind: "main" as const, qty: 1, amps } } : {}) });
    }
  });

  if (hv) {
    const bat = lines.reduce((s, l, i) => s + (cat[i]?.category === "batteries" && /HV|هاي فولتج/i.test(`${l.key} ${cat[i]?.name}`) ? l.qty : 0), 0);
    if (bat) {
      const a = hvAccessories(bat, f);
      rows.push(
        { title: "الكنترول الرئيسي للبطاريات (BCU)", steps: [
          "وحدة التحكم والربط الرئيسية لمجموعة بطاريات الجهد العالي HV",
          `عدد البطاريات = max(${f.hvMinBat}، ${bat}) = ${a.bat}`,
          `أقصى بطاريات لكل كنترول رئيسي = ${f.hvBatPerBcu} بطارية`,
          `عدد الكنترولات الرئيسية = ⌈${a.bat} ÷ ${f.hvBatPerBcu}⌉ = ${a.bcu}`,
        ], result: `${a.bcu} كنترول` },
        { title: "كنترول الربط الإضافي للبطاريات (EBC)", steps: [
          "وحدة ربط إضافية لمجموعة البطاريات التابعة للكنترول الرئيسي BCU",
          `يُضاف كنترول ربط إضافي لكل مجموعة فيها أكثر من ${f.ebcOver} بطاريات`,
          `عدد كنترولات الربط الإضافية = عدد المجموعات التي تتجاوز هذا الحد = ${a.ebc}`,
        ], result: `${a.ebc} كنترول` },
        { title: "قاطع حماية البطاريات (DC)", steps: [
          "قاطع داخل صندوق لفصل وحماية دائرة البطاريات ذات التيار المستمر DC",
          "قاطع حماية بطاريات واحد لكل كنترول رئيسي BCU حسب المعادلة المعتمدة",
          `عدد قواطع حماية البطاريات = عدد الكنترولات الرئيسية = ${a.bcu}`,
        ], result: `${a.bdc} قاطع` },
      );
    }
  }
  return rows;
}
