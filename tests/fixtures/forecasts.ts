import { forecastProduct,shiftDate } from "@/domain/forecast/baseline";
import type { ForecastDetail,ForecastRun,Observation } from "@/lib/forecast/contracts";
export const forecastId="80000000-0000-4000-8000-000000000001",forecastProductId="80000000-0000-4000-8000-000000000002";
export const forecastHistory:Observation[]=Array.from({length:28},(_,i)=>({date:shiftDate("2026-11-10",-i),units:i%7+1,availability:"available",promo:false}));
const baseline=forecastProduct(forecastHistory,"2026-11-10",7);
export const forecastRun:ForecastRun={id:forecastId,method:"seasonal_baseline",status:"succeeded",asOfDate:"2026-11-10",horizonDays:7,historyStart:baseline.historyStart,historyEnd:"2026-11-10",createdAt:"2026-11-10T12:00:00Z",finishedAt:"2026-11-10T12:00:01Z",staleAt:null,version:baseline.version,errorCode:null,summary:{total:1,sufficient:1,insufficient:0}};
const item={id:"80000000-0000-4000-8000-000000000003",productId:forecastProductId,sku:"FICTIONAL-01",name:"Fictional QA product",supplier:"Fictional QA supplier",dailyUnits:baseline.dailyUnits,horizonTotal:"28.0000",quality:baseline.quality,eligibleDays:28,observedDays:28,stockoutDays:0,unknownDays:0,promoDays:0,availabilityUsed:false,reasonCodes:baseline.reasonCodes,limitation:"Isolated fictional QA history."};
export const forecastDetail:ForecastDetail={run:forecastRun,items:[item],total:1,nextCursor:null,selected:{item,history:baseline.history,points:baseline.points}};
