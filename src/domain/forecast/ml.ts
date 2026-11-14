import model from "@/domain/forecast/models/stockout-lgbm-ratio-v1.json";
import { shiftDate } from "@/domain/forecast/baseline";
import { observationSchema,type ForecastPoint,type Observation } from "@/lib/forecast/contracts";

export const ML_FORECAST_VERSION="stockout_lgbm_ratio_v1";
export const ML_EVALUATED_HORIZON=7 as const;

type Tree={f:number[];t:number[];l:number[];r:number[];v:number[]};
type EligibilityReason="UNSUPPORTED_HORIZON"|"INCOMPLETE_DAILY_HISTORY"|"UNKNOWN_AVAILABILITY"|"INSUFFICIENT_ELIGIBLE_HISTORY"|"NO_RECENT_OBSERVATION";
export type MlForecastResult=
  |{supported:false;reason:EligibilityReason}
  |{supported:true;version:typeof ML_FORECAST_VERSION;points:ForecastPoint[];dailyUnits:string;eligibleDays:number;stockoutDays:number;promoDays:number;reasonCodes:string[]};

function mean(values:number[],mask:boolean[]) {
  let total=0,count=0;
  for(let index=0;index<values.length;index++)if(mask[index]){total+=values[index];count++;}
  return count?total/count:0;
}

function weekdayCode(date:string) {
  const days=Math.floor(new Date(`${date}T00:00:00Z`).getTime()/86_400_000);
  return ((days%7)+7)%7;
}

function decimal4(value:number) {
  if(!Number.isFinite(value)||value<0)throw new Error("Invalid ML prediction");
  return (Math.round((value+Number.EPSILON)*10_000)/10_000).toFixed(4);
}

export function predictStockoutRatio(features:number[]) {
  if(features.length!==model.featureNames.length||features.some(value=>!Number.isFinite(value)))throw new Error("Invalid ML feature vector");
  let total=0;
  for(const tree of model.trees as Tree[]){
    let node=0;
    while(tree.f[node]>=0){
      const feature=tree.f[node];
      node=features[feature]<=tree.t[node]?tree.l[node]:tree.r[node];
    }
    total+=tree.v[node];
  }
  return Math.max(0,total*model.calibration);
}

function featuresFor(history:Observation[],asOfDate:string,horizon:number,scale:number) {
  const sales=history.map(row=>row.units/scale),stockout=history.map(row=>row.availability==="stockout"),promo=history.map(row=>row.promo),eligible=stockout.map(value=>!value);
  const features:number[]=[];
  for(const lag of [1,2,3,4,5,6,7,14,21,28]){
    const index=history.length-lag;
    features.push(sales[index],Number(stockout[index]),Number(promo[index]));
  }
  for(const window of [7,14,28]){
    const start=history.length-window,windowSales=sales.slice(start),windowEligible=eligible.slice(start),windowPromo=promo.slice(start);
    const average=mean(windowSales,windowEligible),count=windowEligible.filter(Boolean).length;
    const variance=count?windowSales.reduce((sum,value,index)=>sum+(windowEligible[index]?(value-average)**2:0),0)/count:0;
    features.push(average,Math.sqrt(variance),count,window-windowEligible.filter(Boolean).length,windowPromo.filter(Boolean).length);
  }
  const targetWeekday=weekdayCode(shiftDate(asOfDate,horizon)),same=history.map((row,index)=>eligible[index]&&weekdayCode(row.date)===targetWeekday);
  const sameMean=mean(sales,same),sameCount=same.filter(Boolean).length,overallMean=mean(sales,eligible),baseline=sameCount>=2?sameMean:overallMean;
  const recent=mean(sales.slice(-7),eligible.slice(-7)),previous=mean(sales.slice(-14,-7),eligible.slice(-14,-7)),angle=2*Math.PI*targetWeekday/7;
  features.push(sameMean,sameCount,baseline,recent-previous,horizon,Math.sin(angle),Math.cos(angle));
  if(features.length!==model.featureNames.length)throw new Error("ML feature contract mismatch");
  return features;
}

export function forecastProductMl(input:Observation[],asOfDate:string,horizon:7|14|28):MlForecastResult {
  shiftDate(asOfDate,0);
  if(horizon!==ML_EVALUATED_HORIZON)return {supported:false,reason:"UNSUPPORTED_HORIZON"};
  const start=shiftDate(asOfDate,-27),history=input.map(row=>observationSchema.parse(row)).filter(row=>row.date>=start&&row.date<=asOfDate).sort((a,b)=>a.date.localeCompare(b.date));
  if(history.length!==28||history.some((row,index)=>row.date!==shiftDate(start,index)))return {supported:false,reason:"INCOMPLETE_DAILY_HISTORY"};
  if(history.some(row=>row.availability==="unknown"))return {supported:false,reason:"UNKNOWN_AVAILABILITY"};
  const eligible=history.filter(row=>row.availability!=="stockout");
  if(eligible.length<14)return {supported:false,reason:"INSUFFICIENT_ELIGIBLE_HISTORY"};
  if(!eligible.some(row=>row.date>=shiftDate(asOfDate,-6)))return {supported:false,reason:"NO_RECENT_OBSERVATION"};
  const rawScale=eligible.reduce((sum,row)=>sum+row.units,0)/eligible.length,scale=rawScale>0.01?rawScale:1;
  const points:ForecastPoint[]=[];
  for(let day=1;day<=7;day++)points.push({date:shiftDate(asOfDate,day),units:decimal4(predictStockoutRatio(featuresFor(history,asOfDate,day,scale))*scale)});
  const daily=points.reduce((sum,point)=>sum+Number(point.units),0)/7;
  return {supported:true,version:ML_FORECAST_VERSION,points,dailyUnits:decimal4(daily),eligibleDays:eligible.length,stockoutDays:history.length-eligible.length,promoDays:history.filter(row=>row.promo).length,reasonCodes:["EXPERIMENTAL_EXTERNAL_BENCHMARK","NO_LOST_SALES_RECONSTRUCTION","SEVEN_DAY_SCOPE_ONLY"]};
}
