import { describe, it, expect } from "vitest";
import { lvBatOf, lvChoices } from "@/lib/lv-battery";
const items = [
  { key: "BAT_HITHIUM_16K_LV", name: "بطارية ليثيوم هيثيوم HITHIUM 16 كيلو 314 أمبير 51.2 فولت" },
  { key: "BAT_FIDUS_16K", name: "بطارية ليثيوم بايلونتك 16 كيلو فيدوس IP65" },
  { key: "BAT_UF5000", name: "بطارية ليثيوم بايلونتك 5.12 كيلو" },
  { key: "BAT_FIDUS_PRO_5K", name: "بطارية بايلونتك فيدوس برو 5.12 كيلو IP65" },
  { key: "BAT_HITHIUM_16K_HV", name: "بطارية ليثيوم هيثيوم هاي فولتج 16 كيلو 51.2V" },
];
describe("LV battery choice", () => {
  it("16 kWh offers Hithium and Fidus", () => expect(lvChoices([items[0]!], items)?.opts).toEqual(["h16", "f16"]));
  it("5.12 kWh offers UF5000 and Fidus Pro", () => expect(lvChoices([items[2]!], items)?.opts).toEqual(["uf", "fp"]));
  it("HV battery gets no LV choice", () => expect(lvBatOf(items[4]!.key, items[4]!.name)).toBeNull());
});
