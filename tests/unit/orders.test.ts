import { describe,expect,it } from "vitest";
import { parse } from "csv-parse/sync";
import { csvCell,orderCsv } from "@/domain/orders/export";
import { groupApprovedLines } from "@/domain/orders/review";
import { convertPlanSchema,orderQuerySchema } from "@/lib/orders/contracts";
import { orderFixture } from "../fixtures/orders";
import { plannerFixture,planningId } from "../fixtures/planning";
describe("snapshot review and safe document export",()=>{
  it("groups only approved positive quantities using exact frozen costs",()=>{const line=plannerFixture.items[0];const result=groupApprovedLines([{...line,purchaseCost:"0.19",approvedQty:5},{...line,id:planningId(900),purchaseCost:"0.01",approvedQty:2},{...line,id:planningId(901),approvedQty:0}]);expect(result).toHaveLength(1);expect(result[0].total).toBe("0.97");expect(result[0].items).toHaveLength(2);});
  it.each(["=SUM(1,2)","+cmd","-cmd","@SUM(A1)","  =SUM(1)","\t@cmd","\r\n=cmd"])("neutralizes spreadsheet prefix %j",value=>{expect(csvCell(value)).toBe(`"'${value}"`);});
  it("roundtrips UTF-8, quotes, commas and line breaks and keeps exact totals",()=>{const fixture=structuredClone(orderFixture);fixture.items[0].name='চাল, "Rice"\n5 kg';fixture.items[0].sku='=HYPERLINK("bad")';const csv=orderCsv(fixture);expect(csv.startsWith("\ufeff")).toBe(true);const rows=parse(csv,{bom:true,relax_column_count:true,skip_empty_lines:true}) as string[][];expect(rows.find(row=>row[0]===fixture.items[0].name)?.slice(1,6)).toEqual([`'${fixture.items[0].sku}`,"65","5","210.00","13650.00"]);expect(rows).toContainEqual(["Total draft amount (BDT)","13650.00"]);expect(csv).toContain("Draft — not sent");});
  it("rejects extra conversion fields, invalid revisions and reversed date filters",()=>{expect(convertPlanSchema.safeParse({expectedRevision:0,total:"0"}).success).toBe(false);expect(convertPlanSchema.safeParse({expectedRevision:-1}).success).toBe(false);expect(orderQuerySchema.safeParse({from:"2026-11-12",to:"2026-11-11"}).success).toBe(false);});
});
