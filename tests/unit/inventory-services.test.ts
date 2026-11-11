import { beforeEach,describe,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@/lib/auth/errors";
import { orgId,productId,rawList,rawRow } from "../fixtures/inventory";
vi.mock("server-only",()=>({}));
vi.mock("@/server/auth/context",()=>({requireWorkspace:vi.fn()}));
import { requireWorkspace } from "@/server/auth/context";
import { inventoryQuery,readInventory,readProduct } from "@/server/services/inventory";
import { GET } from "@/app/api/products/route";

const rpc=vi.fn();const context={workspace:{id:orgId,is_sample:false},client:{rpc}} as unknown as Parameters<typeof readInventory>[0];
beforeEach(()=>{rpc.mockReset();vi.mocked(requireWorkspace).mockResolvedValue(context);});
describe("inventory API boundaries",()=>{
  it.each(["q=a&q=b","sort=DROP%20TABLE","status=sent","supplierId=bad","limit=101","user_id=forged"])("rejects invalid filters %s",query=>expect(()=>inventoryQuery(new URLSearchParams(query))).toThrow(AppError));
  it("binds cursor to the workspace and all filters",async()=>{
    rpc.mockResolvedValue({data:{...rawList,nextPosition:{missing:false,number:"5.4285714285714286",text:rawRow.sku,id:productId}},error:null});
    const query=inventoryQuery(new URLSearchParams("q=Oil&limit=1"));const first=await readInventory(context,query);
    await readInventory(context,{...query,cursor:first.nextCursor!});expect(rpc).toHaveBeenLastCalledWith("read_inventory",expect.objectContaining({p_org_id:orgId,p_revision:rawList.revision,p_after:expect.objectContaining({id:productId})}));
    const calls=rpc.mock.calls.length;await expect(readInventory(context,{...query,q:"other",cursor:first.nextCursor!})).rejects.toMatchObject({code:"INVALID_CURSOR"});expect(rpc).toHaveBeenCalledTimes(calls);
  });
  it("rejects oversized/foreign cursors and unexpected tenant rows before returning data",async()=>{
    expect(()=>inventoryQuery(new URLSearchParams({cursor:"a".repeat(4097)}))).toThrow(AppError);
    rpc.mockResolvedValue({data:{...rawList,items:[{...rawRow,org_id:"60000000-0000-4000-8000-000000000099"}]},error:null});
    await expect(readInventory(context,inventoryQuery(new URLSearchParams()))).rejects.toMatchObject({code:"INVENTORY_UNAVAILABLE"});
  });
  it("returns safe stale-query errors and indistinguishable invalid/missing product errors",async()=>{
    rpc.mockResolvedValue({data:null,error:{code:"P0001",message:"STALE_CURSOR"}});await expect(readInventory(context,inventoryQuery(new URLSearchParams()))).rejects.toMatchObject({status:409,code:"STALE_CURSOR"});
    await expect(readProduct(context,"bad")).rejects.toMatchObject({status:404,code:"PRODUCT_NOT_FOUND"});rpc.mockResolvedValue({data:null,error:null});await expect(readProduct(context,productId)).rejects.toMatchObject({status:404,code:"PRODUCT_NOT_FOUND"});
  });
  it("returns the documented decimal-string product envelope and private headers",async()=>{
    rpc.mockResolvedValue({data:rawList,error:null});const response=await GET(new NextRequest("http://localhost/api/products"));const body=await response.json();
    expect(response.status).toBe(200);expect(response.headers.get("Cache-Control")).toContain("no-store");expect(body.data.pageInfo.nextCursor).toBeNull();expect(body.data.items[0]).toMatchObject({supplier:{defaultLeadTimeDays:6},effectiveLeadTimeDays:6,demand:{estimatedDailyUnits:"7.0000"},coverDays:"5.4286",risk:{gapBeforeArrivalDays:"0.5714"}});
  });
  it("returns 401 before querying the database for unauthenticated requests",async()=>{
    vi.mocked(requireWorkspace).mockRejectedValue(new AppError(401,"AUTH_REQUIRED","Sign in to continue."));const response=await GET(new NextRequest("http://localhost/api/products"));expect(response.status).toBe(401);expect(rpc).not.toHaveBeenCalled();
  });
});
