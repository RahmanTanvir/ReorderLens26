import { describe,expect,it } from "vitest";
import { forecastProduct,shiftDate } from "@/domain/forecast/baseline";
import type { Observation } from "@/lib/forecast/contracts";
const asOf="2026-11-10";
const history=(count=28,units=7):Observation[]=>Array.from({length:count},(_,index)=>({date:shiftDate(asOf,index-count+1),units,availability:"available",promo:false}));
describe("seasonal baseline v1",()=>{
  it.each([7,14,28] as const)("persists %i dated points and the same first-seven-day rate",horizon=>{
    const result=forecastProduct(history(),asOf,horizon);expect(result.dailyUnits).toBe("7.0000");expect(result.points).toHaveLength(horizon);expect(result.points[0].date).toBe("2026-11-11");expect(result.points.at(-1)?.date).toBe(shiftDate(asOf,horizon));
  });
  it("requires 14 eligible days and a recent eligible observation",()=>{
    expect(forecastProduct(history(13),asOf,7)).toMatchObject({quality:"insufficient",dailyUnits:null,points:[]});
    expect(forecastProduct(history(14),asOf,7).quality).toBe("sufficient");
    const old=history(14).map(row=>({...row,date:shiftDate(row.date,-7)}));expect(forecastProduct(old,asOf,7).reasonCodes).toContain("NO_RECENT_OBSERVATION");
  });
  it("excludes recorded stockouts without reconstructing lost sales",()=>{
    const rows=history();rows[0]={...rows[0],units:999,availability:"stockout"};const result=forecastProduct(rows,asOf,7);
    expect(result.dailyUnits).toBe("7.0000");expect(result.eligibleDays).toBe(27);expect(result.availabilityUsed).toBe(true);expect(result.reasonCodes).toContain("STOCKOUT_DAYS_EXCLUDED");
  });
  it("does not convert missing dates to zeros and accepts recorded zero demand",()=>{
    const sparse=history().filter((_,i)=>i%2===0||i===27);expect(forecastProduct(sparse,asOf,7).dailyUnits).toBe("7.0000");
    expect(forecastProduct(history(14,0),asOf,7)).toMatchObject({quality:"sufficient",dailyUnits:"0.0000"});
  });
  it("fits weekday means when eligible weekday count is at least two",()=>{
    const rows=history().map(row=>({...row,units:new Date(`${row.date}T00:00:00Z`).getUTCDay()+1}));const result=forecastProduct(rows,asOf,14);
    for(const point of result.points)expect(point.units).toBe(`${new Date(`${point.date}T00:00:00Z`).getUTCDay()+1}.0000`);expect(result.dailyUnits).toBe("4.0000");
  });
  it("ignores observations after cutoff and before the 28-day window",()=>{
    const base=forecastProduct(history(14),asOf,7);const changed=forecastProduct([...history(14),{date:shiftDate(asOf,1),units:99999,availability:"available",promo:false},{date:shiftDate(asOf,-28),units:99999,availability:"available",promo:false}],asOf,7);expect(changed).toEqual(base);
  });
  it("labels unknown availability and promotions without inventing corrections",()=>{
    const rows=history(14);rows[0].availability="unknown";rows[1].promo=true;const result=forecastProduct(rows,asOf,7);expect(result.dailyUnits).toBe("7.0000");expect(result.availabilityUsed).toBe(false);expect(result.reasonCodes).toEqual(["UNKNOWN_AVAILABILITY","PROMOTIONS_NOT_MODELED","BASELINE_LIMITS"]);
  });
  it("is deterministic under row order and rejects duplicate or malformed observations",()=>{
    expect(forecastProduct(history().reverse(),asOf,28)).toEqual(forecastProduct(history(),asOf,28));
    expect(()=>forecastProduct([...history(),history()[0]],asOf,7)).toThrow(/Duplicate/);expect(()=>shiftDate("2026-02-30",1)).toThrow();
  });
  it("computes D7 before rounding daily thirds",()=>{
    const rows:Observation[]=[];
    for(let weekday=0;weekday<7;weekday++){
      const matching=history().reverse().filter(row=>new Date(`${row.date}T00:00:00Z`).getUTCDay()===weekday).slice(0,weekday<3?3:2);
      rows.push(...matching.map((row,index)=>({...row,units:weekday<3&&index===0?1:0})));
    }
    const result=forecastProduct(rows,asOf,7);expect(result.dailyUnits).toBe("0.1429");
    expect((result.points.reduce((sum,row)=>sum+Number(row.units),0)/7).toFixed(4)).toBe("0.1428");
  });
  it("preserves chronological training boundaries across rolling forecast origins",()=>{
    const rows=Array.from({length:60},(_,i)=>({date:shiftDate(asOf,i-59),units:i<40?2:20,availability:"available" as const,promo:false}));
    for(const origin of [shiftDate(asOf,-28),shiftDate(asOf,-14),asOf]){
      const saved=forecastProduct(rows,origin,7),mutated=rows.map(row=>row.date>origin?{...row,units:2147483647}:row);
      expect(forecastProduct(mutated,origin,7)).toEqual(saved);expect(saved.history.every(row=>row.date<=origin&&row.date>=shiftDate(origin,-27))).toBe(true);
      expect(saved.points.every(row=>row.date>origin)).toBe(true);
    }
  });
});
