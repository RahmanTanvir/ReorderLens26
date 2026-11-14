import { describe,expect,it } from "vitest";
import model from "@/domain/forecast/models/stockout-lgbm-ratio-v1.json";
import { forecastProductMl,ML_FORECAST_VERSION,predictStockoutRatio } from "@/domain/forecast/ml";
import { shiftDate } from "@/domain/forecast/baseline";
import type { Observation } from "@/lib/forecast/contracts";

const asOf="2026-11-10";
function history():Observation[]{return Array.from({length:28},(_,index)=>({date:shiftDate(asOf,index-27),units:5+index%7,availability:"available",promo:index%9===0}));}

describe("experimental stockout LightGBM artifact",()=>{
  it("matches Python export parity vectors",()=>{
    expect(model.version).toBe(ML_FORECAST_VERSION);
    for(const row of model.parity)expect(predictStockoutRatio(row.features)).toBeCloseTo(row.expectedRatio,12);
  });
  it("generates deterministic seven-day predictions from supported history",()=>{
    const first=forecastProductMl(history(),asOf,7),second=forecastProductMl(history().reverse(),asOf,7);
    expect(first).toEqual(second);expect(first).toMatchObject({supported:true,version:ML_FORECAST_VERSION,eligibleDays:28,stockoutDays:0,promoDays:4});
    if(first.supported){expect(first.points).toHaveLength(7);expect(first.points[0].date).toBe("2026-11-11");expect(first.dailyUnits).toMatch(/^\d+\.\d{4}$/);}
  });
  it("uses stockout flags as model inputs without claiming reconstructed demand",()=>{
    const rows=history();rows[4]={...rows[4],units:0,availability:"stockout"};
    const result=forecastProductMl(rows,asOf,7);expect(result).toMatchObject({supported:true,stockoutDays:1});
    if(result.supported)expect(result.reasonCodes).toContain("NO_LOST_SALES_RECONSTRUCTION");
  });
  it("fails closed outside the evaluated input scope",()=>{
    expect(forecastProductMl(history(),asOf,14)).toEqual({supported:false,reason:"UNSUPPORTED_HORIZON"});
    expect(forecastProductMl(history().slice(1),asOf,7)).toEqual({supported:false,reason:"INCOMPLETE_DAILY_HISTORY"});
    const unknown=history();unknown[0]={...unknown[0],availability:"unknown"};expect(forecastProductMl(unknown,asOf,7)).toEqual({supported:false,reason:"UNKNOWN_AVAILABILITY"});
    const mostlyStockout=history().map((row,index)=>index<15?{...row,availability:"stockout" as const}:row);expect(forecastProductMl(mostlyStockout,asOf,7)).toEqual({supported:false,reason:"INSUFFICIENT_ELIGIBLE_HISTORY"});
  });
});
