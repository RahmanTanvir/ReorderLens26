import { beforeEach,describe,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@/lib/auth/errors";
import { forecastDetail,forecastId,forecastRun } from "../fixtures/forecasts";
vi.mock("server-only",()=>({}));vi.mock("@/server/auth/context",()=>({requireWorkspace:vi.fn()}));
import { requireWorkspace } from "@/server/auth/context";
import { forecastQuery,generateForecast,readForecast } from "@/server/services/forecasts";
import { GET,POST } from "@/app/api/forecasts/runs/route";
import { GET as detailGET } from "@/app/api/forecasts/runs/[id]/route";
const rpc=vi.fn();const context={workspace:{id:"80000000-0000-4000-8000-000000000010",role:"owner",is_sample:false},client:{rpc}} as unknown as Parameters<typeof generateForecast>[0];
const input={asOfDate:"2026-11-10",horizonDays:7 as const};
const request=(body:unknown,origin="http://localhost")=>new NextRequest("http://localhost/api/forecasts/runs",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{rpc.mockReset();vi.mocked(requireWorkspace).mockResolvedValue(context);});
describe("forecast API boundaries",()=>{
  it.each(["limit=101","cursor=bad","runId=bad","limit=2&limit=3","org_id=forged"])("rejects malformed query %s",query=>expect(()=>forecastQuery(new URLSearchParams(query))).toThrow(AppError));
  it("enforces same-origin before parsing, authentication or RPC work",async()=>{const response=await POST(request(input,"http://evil.example"));expect(response.status).toBe(403);expect(requireWorkspace).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();});
  it.each([{...input,horizonDays:8},{...input,asOfDate:"2026-02-30"},{...input,orgId:"forged"}])("rejects unsupported/forged bodies",async body=>{expect((await POST(request(body))).status).toBe(400);expect(rpc).not.toHaveBeenCalled();});
  it("bounds JSON and rejects future cutoffs",async()=>{expect((await POST(request({...input,padding:"x".repeat(9000)}))).status).toBe(413);await expect(generateForecast(context,{...input,asOfDate:"2099-01-01"})).rejects.toMatchObject({status:400});expect(rpc).not.toHaveBeenCalled();});
  it("denies viewers and sample generation before invoking the database",async()=>{await expect(generateForecast({...context,workspace:{...context.workspace,role:"viewer"}},input)).rejects.toMatchObject({status:403});await expect(generateForecast({...context,workspace:{...context.workspace,is_sample:true}},input)).rejects.toMatchObject({code:"SAMPLE_READ_ONLY"});expect(rpc).not.toHaveBeenCalled();});
  it("returns actual persisted status/reuse and private no-store responses",async()=>{
    rpc.mockResolvedValue({data:{runId:forecastId,status:"succeeded",reused:false,errorCode:null},error:null});const response=await POST(request(input));expect(response.status).toBe(201);expect(response.headers.get("Cache-Control")).toContain("no-store");expect((await response.json()).data.runId).toBe(forecastId);expect(rpc).toHaveBeenCalledWith("generate_forecast",{p_org_id:context.workspace.id,p_as_of_date:input.asOfDate,p_horizon_days:7});
    rpc.mockResolvedValue({data:{runId:forecastId,status:"failed",reused:false,errorCode:"BASELINE_FAILED"},error:null});expect((await (await POST(request(input))).json()).data.status).toBe("failed");
    rpc.mockResolvedValue({data:{runId:forecastId,status:"succeeded",reused:true,errorCode:null},error:null});expect((await POST(request(input))).status).toBe(200);
  });
  it("uses the documented paginated read envelopes",async()=>{
    rpc.mockResolvedValue({data:{items:[forecastRun],nextCursor:null},error:null});const response=await GET(new NextRequest("http://localhost/api/forecasts/runs?limit=2"));expect((await response.json()).data).toMatchObject({items:[forecastRun],pageInfo:{nextCursor:null}});
    rpc.mockResolvedValue({data:forecastDetail,error:null});const detail=await detailGET(new NextRequest(`http://localhost/api/forecasts/runs/${forecastId}`),{params:Promise.resolve({id:forecastId})});expect((await detail.json()).data).toMatchObject({selected:{points:forecastDetail.selected!.points},pageInfo:{nextCursor:null}});
  });
  it("returns indistinguishable missing/invalid IDs and safe quota/timeout/SQL errors",async()=>{
    rpc.mockResolvedValue({data:null,error:null});await expect(readForecast(context,forecastId,forecastQuery({}))).rejects.toMatchObject({status:404});await expect(readForecast(context,"bad",forecastQuery({}))).rejects.toMatchObject({status:404});
    for(const [error,status] of [[{code:"P0001",message:"FORECAST_LIMIT"},429],[{code:"57014",message:"secret timeout"},503],[{code:"XX000",message:"SECRET CUSTOMER RECORD"},503]] as const){rpc.mockResolvedValue({data:null,error});const response=await POST(request(input));expect(response.status).toBe(status);expect(JSON.stringify(await response.json())).not.toContain("SECRET");}
  });
  it("requires verified identity before database access",async()=>{vi.mocked(requireWorkspace).mockRejectedValue(new AppError(401,"AUTH_REQUIRED","Sign in to continue."));expect((await GET(new NextRequest("http://localhost/api/forecasts/runs"))).status).toBe(401);expect(rpc).not.toHaveBeenCalled();});
});
