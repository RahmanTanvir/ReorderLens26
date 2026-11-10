import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach,describe,expect,it,vi } from "vitest";
import { fileKinds,suggestMappings } from "@/lib/imports/contracts";
import type { ImportJob,Json } from "@/lib/supabase/database.types";

vi.mock("server-only",()=>({}));
vi.mock("@/server/auth/context",()=>({requireWorkspace:vi.fn()}));
import { requireWorkspace } from "@/server/auth/context";
import { commitImport,importContext,uploadImportFile,validateImport } from "@/server/services/imports";

const sources={suppliers:"name,lead_time_days\nSupplier,2",products:"sku,name,supplier_name,purchase_cost\nSKU,Product,Supplier,2.00",inventory_snapshots:"sku,as_of_date,on_hand\nSKU,2026-11-09,3",sales_daily:"sku,sales_date,units_sold\nSKU,2026-11-09,1"};
const org="30000000-0000-4000-8000-000000000001",id="30000000-0000-4000-8000-000000000002";
const token="30000000-0000-4000-8000-000000000003";
const manifest=fileKinds.map(kind=>({kind,filename:`${kind}.csv`,size:Buffer.byteLength(sources[kind]),sha256:createHash("sha256").update(sources[kind]).digest("hex"),headers:sources[kind].split("\n")[0].split(",")}));
const job:ImportJob={id,org_id:org,created_by:"user",status:"validated",storage_prefix:`${org}/${id}`,file_manifest:manifest,column_mapping:suggestMappings(manifest),validation_report:{validationToken:token},created_at:"2026-11-10T10:00:00Z",validated_at:null,committed_at:null};
const rpc=vi.fn(),download=vi.fn(),upload=vi.fn();
const query=()=>({select:()=>({eq:()=>({order:()=>({range:async()=>({data:[],error:null})})})})});
const context={workspace:{id:org,is_sample:false},user:{id:"user"},client:{storage:{from:()=>({download,upload})},rpc,from:query}} as unknown as Parameters<typeof validateImport>[0];
beforeEach(()=>{
  rpc.mockReset();download.mockReset();upload.mockReset();upload.mockResolvedValue({error:null});
  download.mockImplementation(async(path:string)=>({data:new Blob([sources[path.split("/").pop()!.replace(".csv","") as keyof typeof sources]]),error:null}));
  vi.mocked(requireWorkspace).mockResolvedValue(context);
});
describe("bounded per-file transfers",()=>{
  function request(source=sources.products,mime="text/csv") {
    const form=new FormData();form.set("file",new File([source],"products.csv",{type:mime}));return new NextRequest("http://localhost/api/imports/id/files/products",{method:"POST",body:form});
  }
  it("verifies bytes, headers, size and tenant path before storing a declared file",async()=>{
    expect(await uploadImportFile(request(),context,job,"products")).toEqual({kind:"products",stored:true});
    expect(upload).toHaveBeenCalledWith(`${org}/${id}/products.csv`,expect.any(Uint8Array),{contentType:"text/csv",upsert:false});
  });
  it("rejects source tampering or a binary MIME type before storage",async()=>{
    await expect(uploadImportFile(request(sources.products.replace("2.00","1.00")),context,job,"products")).rejects.toMatchObject({code:"IMPORT_STALE_FILE"});
    await expect(uploadImportFile(request(sources.products,"application/octet-stream"),context,job,"products")).rejects.toMatchObject({code:"UNSUPPORTED_CSV"});expect(upload).not.toHaveBeenCalled();
  });
  it("makes an exact upload retry safe without overwriting existing source bytes",async()=>{
    upload.mockResolvedValue({error:{status:409}});expect((await uploadImportFile(request(),context,job,"products")).stored).toBe(true);
    download.mockResolvedValue({data:new Blob(["altered"]),error:null});await expect(uploadImportFile(request(),context,job,"products")).rejects.toMatchObject({code:"UPLOAD_UNAVAILABLE"});
  });
  it("bounds each request before parsing multipart or sending data to Storage",async()=>{
    const oversized=new NextRequest("http://localhost/api/imports/id/files/products",{method:"POST",headers:{"content-type":"multipart/form-data; boundary=test"},body:new Uint8Array(2*1024*1024+16385)});
    await expect(uploadImportFile(oversized,context,job,"products")).rejects.toMatchObject({code:"FILE_TOO_LARGE"});expect(upload).not.toHaveBeenCalled();
  });
});
describe("import service boundaries",()=>{
  it("verifies original checksums before a commit RPC",async()=>{
    download.mockResolvedValue({data:new Blob(["altered"]),error:null});
    await expect(commitImport(context,job,true,token)).rejects.toMatchObject({code:"IMPORT_STALE_FILE"});expect(rpc).not.toHaveBeenCalled();
  });
  it("validates originals and server-owned mappings again at confirmation",async()=>{
    rpc.mockResolvedValue({data:{jobId:id,committedAt:"2026-11-10T12:00:00Z",alreadyCommitted:false,counts:Object.fromEntries(fileKinds.map(kind=>[kind,{inserted:1,updated:0}]))},error:null});
    await commitImport(context,job,true,token);expect(download).toHaveBeenCalledTimes(4);expect(rpc).toHaveBeenCalledWith("commit_import",expect.objectContaining({p_org_id:org,p_job_id:id,p_confirm_upserts:true,p_data:expect.objectContaining({products:[expect.objectContaining({sku:"SKU",purchase_cost:"2.00"})]})}));
  });
  it("does not commit an unvalidated job or depend on Storage for an already committed replay",async()=>{
    await expect(commitImport(context,{...job,status:"uploaded"},true,token)).rejects.toMatchObject({code:"VALIDATION_REQUIRED"});
    const result={jobId:id,committedAt:"2026-11-10T12:00:00Z",alreadyCommitted:false,counts:Object.fromEntries(fileKinds.map(kind=>[kind,{inserted:1,updated:0}]))};
    expect((await commitImport(context,{...job,status:"committed",validation_report:{result} as Json},true,token)).alreadyCommitted).toBe(true);expect(download).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();
  });
  it("stores row-level validation errors without sending a business payload",async()=>{
    const mappings=suggestMappings(manifest);mappings.products.purchase_cost="";
    rpc.mockImplementation(async(_name,args)=>({data:args.p_report,error:null}));
    const report=await validateImport(context,job,mappings);expect(report.valid).toBe(false);expect(rpc).toHaveBeenCalledWith("validate_import",expect.objectContaining({p_data:null}));
  });
  it("passes workspace headers through membership validation and refuses sample writes",async()=>{
    await importContext(new NextRequest("http://localhost/api/imports",{headers:{"X-Workspace-Id":org}}),true);
    expect(requireWorkspace).toHaveBeenCalledWith({workspaceId:org,roles:["owner","operator"],writable:true});
    vi.mocked(requireWorkspace).mockResolvedValue({...context,workspace:{...context.workspace,is_sample:true}});
    await expect(importContext(new NextRequest("http://localhost/api/imports"),true)).rejects.toMatchObject({code:"SAMPLE_READ_ONLY"});
  });
});
