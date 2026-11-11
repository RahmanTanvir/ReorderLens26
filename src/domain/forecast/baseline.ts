import { observationSchema,FORECAST_VERSION,type Observation,type ForecastPoint } from "@/lib/forecast/contracts";
import { fractionString } from "@/domain/inventory/risk";

// LCM(1..28). Every possible eligible-day denominator divides this exactly.
// Accumulate integer numerators so rounding daily points cannot change D7.
const DENOMINATOR=80313433200n;
export function shiftDate(date:string,days:number) {
  const value=new Date(`${date}T00:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(value.getTime())||value.toISOString().slice(0,10)!==date)throw new Error("Invalid calendar date");
  value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);
}
export function forecastProduct(input:Observation[],asOfDate:string,horizon:7|14|28) {
  const start=shiftDate(asOfDate,-27),recent=shiftDate(asOfDate,-6);shiftDate(asOfDate,0);
  if(![7,14,28].includes(horizon))throw new Error("Unsupported horizon");
  const observations=input.map(row=>observationSchema.parse(row)).filter(row=>row.date>=start&&row.date<=asOfDate).sort((a,b)=>a.date.localeCompare(b.date));
  if(new Set(observations.map(row=>row.date)).size!==observations.length)throw new Error("Duplicate product/day observation");
  const eligible=observations.filter(row=>row.availability!=="stockout");
  const stockoutDays=observations.length-eligible.length,unknownDays=observations.filter(row=>row.availability==="unknown").length,promoDays=observations.filter(row=>row.promo).length;
  const reasons:string[]=[];
  if(eligible.length<14)reasons.push("INSUFFICIENT_HISTORY");
  if(!eligible.some(row=>row.date>=recent))reasons.push("NO_RECENT_OBSERVATION");
  if(stockoutDays)reasons.push("STOCKOUT_DAYS_EXCLUDED");
  if(unknownDays)reasons.push("UNKNOWN_AVAILABILITY");
  if(promoDays)reasons.push("PROMOTIONS_NOT_MODELED");
  reasons.push("BASELINE_LIMITS");
  const sufficient=eligible.length>=14&&eligible.some(row=>row.date>=recent);
  const points:ForecastPoint[]=[];let firstSeven=0n;
  if(sufficient){
    const all=eligible.reduce((sum,row)=>sum+BigInt(row.units),0n);
    for(let day=1;day<=horizon;day++){
      const date=shiftDate(asOfDate,day),weekday=new Date(`${date}T00:00:00Z`).getUTCDay();
      const matched=eligible.filter(row=>new Date(`${row.date}T00:00:00Z`).getUTCDay()===weekday);
      const count=BigInt(matched.length>=2?matched.length:eligible.length),sum=matched.length>=2?matched.reduce((sum,row)=>sum+BigInt(row.units),0n):all;
      const numerator=sum*(DENOMINATOR/count);
      if(day<=7)firstSeven+=numerator;
      points.push({date,units:fractionString(numerator,DENOMINATOR,4)});
    }
  }
  return {version:FORECAST_VERSION,historyStart:start,historyEnd:asOfDate,quality:sufficient?"sufficient" as const:"insufficient" as const,dailyUnits:sufficient?fractionString(firstSeven,DENOMINATOR*7n,4):null,eligibleDays:eligible.length,observedDays:observations.length,stockoutDays,unknownDays,promoDays,availabilityUsed:stockoutDays>0,reasonCodes:reasons,history:observations,points};
}
