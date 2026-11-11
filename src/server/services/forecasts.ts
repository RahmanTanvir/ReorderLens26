import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/auth/errors";
import { forecastQuerySchema,generateForecastSchema,generationSchema,runDetailSchema,runListSchema,type ForecastQuery } from "@/lib/forecast/contracts";
import { requireWorkspace } from "@/server/auth/context";
import { databaseFailure } from "@/server/http";

type Context=Awaited<ReturnType<typeof requireWorkspace>>;
export function dhakaDate() {return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
export function forecastQuery(params:URLSearchParams|Record<string,string|string[]|undefined>) {
  const input:Record<string,unknown>={};
  if(params instanceof URLSearchParams)for(const [key,value] of params){if(key in input)throw new AppError(400,"INVALID_QUERY","Use each forecast query field once.");input[key]=value;}
  else for(const [key,value] of Object.entries(params))if(value!==undefined)input[key]=value;
  const parsed=forecastQuerySchema.safeParse(input);
  if(!parsed.success)throw new AppError(400,"INVALID_QUERY","Check the forecast run, product and page selection.");
  return parsed.data;
}
function failure(error:{code?:string;message?:string}|null) {
  if(!error)return;
  if(error.message==="FORECAST_LIMIT")throw new AppError(429,"FORECAST_LIMIT","This workspace has reached 10 new forecast runs in an hour. Open a saved run or try later.");
  if(error.message==="SAMPLE_READ_ONLY")throw new AppError(403,"SAMPLE_READ_ONLY","Sample rates are illustrative and read-only. Generate forecasts in an imported workspace.");
  if(error.message==="EMPTY_CATALOG")throw new AppError(422,"EMPTY_CATALOG","Import products and sales before generating a forecast.");
  if(error.code?.startsWith("22"))throw new AppError(400,"INVALID_FORECAST_INPUT","Choose 7, 14 or 28 days, a valid cutoff on or before today, and a page from this run.");
  if(error.code==="57014")throw new AppError(503,"FORECAST_TIMEOUT","Generation timed out. Check saved runs, then retry the same inputs if needed.");
  databaseFailure(error);
}
export async function generateForecast(context:Context,input:{asOfDate:string;horizonDays:7|14|28}) {
  if(!["owner","operator"].includes(context.workspace.role))throw new AppError(403,"FORBIDDEN","Only owners and operators can generate forecasts.");
  if(context.workspace.is_sample)throw new AppError(403,"SAMPLE_READ_ONLY","Sample rates are illustrative and read-only. Generate forecasts in an imported workspace.");
  if(!generateForecastSchema.safeParse(input).success||input.asOfDate<"1900-01-01"||input.asOfDate>dhakaDate())throw new AppError(400,"INVALID_FORECAST_INPUT","Choose a valid cutoff from 1900-01-01 through today in Asia/Dhaka and a 7, 14 or 28-day horizon.");
  const result=await context.client.rpc("generate_forecast",{p_org_id:context.workspace.id,p_as_of_date:input.asOfDate,p_horizon_days:input.horizonDays});failure(result.error);
  return generationSchema.parse(result.data);
}
export async function listForecasts(context:Context,limit=25,before?:string) {
  const result=await context.client.rpc("list_forecast_runs",{p_org_id:context.workspace.id,p_limit:limit,p_before:before});failure(result.error);
  return runListSchema.parse(result.data);
}
export async function readForecast(context:Context,id:string,query:ForecastQuery) {
  if(!z.uuid().safeParse(id).success)throw new AppError(404,"FORECAST_NOT_FOUND","This forecast is not available in this workspace.");
  const result=await context.client.rpc("read_forecast_run",{p_org_id:context.workspace.id,p_run_id:id,p_limit:query.limit,p_after:query.cursor,p_product_id:query.productId});failure(result.error);
  if(result.data===null)throw new AppError(404,"FORECAST_NOT_FOUND","This forecast or product is not available in this workspace.");
  return runDetailSchema.parse(result.data);
}
