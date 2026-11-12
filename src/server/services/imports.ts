import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "@/lib/validation/zod";

import { CsvFailure, parseCsv, validateFiles } from "@/domain/imports/validation";
import { AppError } from "@/lib/auth/errors";
import { commitResultSchema, emptyMappings, jobViewSchema, manifestSchema, mappingSchema, MAX_FILE_BYTES, reportSchema, type ColumnMappings, type FileKind, type ParsedFile } from "@/lib/imports/contracts";
import type { ImportJob, Json } from "@/lib/supabase/database.types";
import { requireWorkspace } from "@/server/auth/context";
import { databaseFailure } from "@/server/http";

type Context=Awaited<ReturnType<typeof requireWorkspace>>;
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const bucket="retail-imports";
export async function importContext(request:NextRequest,edit=false) {
  const context=await requireWorkspace({workspaceId:request.headers.get("X-Workspace-Id"),roles:edit?["owner","operator"]:undefined,writable:edit});
  if(edit && context.workspace.is_sample)throw new AppError(422,"SAMPLE_READ_ONLY","Sample workspaces cannot receive business CSV files. Create a separate real workspace.");
  return context;
}
export function importFailure(error:{code?:string;message?:string}|null) {
  if(!error)return;
  const messages:Record<string,[number,string]>={
    IMPORT_STALE_FILE:[409,"The source or validation changed. Review and validate the import again."],
    IMPORT_ALREADY_COMMITTED:[409,"This import has already been confirmed. Open its saved report."],
    CONFLICT_REQUIRES_CONFIRMATION:[409,"Existing records would be updated. Review the counts and confirm updates."],
    IMPORT_FILES_MISSING:[409,"Some source files are missing. Retry the original upload before validation."],
    IMPORT_RATE_LIMIT:[429,"This workspace has reached its hourly upload limit. Try again later."],
  };
  const known=messages[error.message??""];
  if(known)throw new AppError(known[0],error.message!,known[1]);
  if(error.code?.startsWith("22") || error.code?.startsWith("23"))throw new AppError(422,"IMPORT_VALIDATION_FAILED","The import no longer passes database validation. Check duplicate keys, references and values, then validate again.");
  databaseFailure(error);
}
export async function readJob(context:Context,id:string,edit=false) {
  if(!z.uuid().safeParse(id).success)throw new AppError(404,"IMPORT_NOT_FOUND","This import is not available.");
  const result=await context.client.from("import_jobs").select("*").eq("org_id",context.workspace.id).eq("id",id).maybeSingle();
  databaseFailure(result.error);
  if(!result.data || (edit && result.data.created_by!==context.user.id))throw new AppError(404,"IMPORT_NOT_FOUND","This import is not available.");
  return result.data;
}
export function jobView(job:ImportJob) {
  const report=reportSchema.safeParse(job.validation_report);
  return jobViewSchema.parse({jobId:job.id,status:job.status,files:job.file_manifest,columnMappings:mappingSchema.safeParse(job.column_mapping).success?job.column_mapping:emptyMappings(),report:report.success?report.data:null,committedAt:job.committed_at,createdAt:job.created_at});
}
async function boundedMultipart(request:NextRequest,maxBytes=MAX_FILE_BYTES+16384) {
  const contentType=request.headers.get("content-type")??"";
  if(!contentType.startsWith("multipart/form-data;"))throw new AppError(400,"INVALID_BODY","Choose the four CSV files.");
  const reader=request.body?.getReader();if(!reader)throw new AppError(400,"INVALID_BODY","Choose the four CSV files.");
  const chunks:Uint8Array[]=[];let size=0;
  try { for(;;) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw new AppError(413,"FILE_TOO_LARGE","Upload no more than the required CSV files, each up to 2 MiB.");}chunks.push(value);} }
  finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try {return await new Response(bytes,{headers:{"Content-Type":contentType}}).formData();}catch{throw new AppError(400,"INVALID_BODY","The upload could not be read. Choose the files again.");}
}
function checkedFile(value:FormDataEntryValue|null):File {
  if(!(value instanceof File))throw new AppError(400,"MISSING_REQUIRED_FILE","Choose the required CSV file.");
  if(!/^[^/\\]+\.csv$/i.test(value.name)||value.name.length>180||/[\u0000-\u001f]/.test(value.name)||!["","text/csv","application/csv","application/vnd.ms-excel","text/plain"].includes(value.type))throw new AppError(422,"UNSUPPORTED_CSV","Use a CSV filename and supported text MIME type.");
  if(value.size>MAX_FILE_BYTES)throw new AppError(413,"FILE_TOO_LARGE","Each CSV must be no larger than 2 MiB.");
  return value;
}
export async function prepareImport(context:Context,jobId:string,manifest:ReturnType<typeof manifestSchema.parse>) {
  if(new Set(manifest.map(file=>file.kind)).size!==4||manifest.some(file=>!file.filename.toLowerCase().endsWith(".csv")||/[\\/\u0000-\u001f]/.test(file.filename)||new Set(file.headers).size!==file.headers.length))throw new AppError(422,"UNSUPPORTED_CSV","Declare one CSV per file kind with unique headers.");
  const result=await context.client.rpc("begin_import",{p_org_id:context.workspace.id,p_job_id:jobId,p_manifest:manifest});importFailure(result.error);
  const job=await readJob(context,jobId,true);
  if(job.status==="committed")throw new AppError(409,"IMPORT_ALREADY_COMMITTED","This import has already been confirmed. Open its saved report.");
  return {jobId,files:manifest,status:"uploaded" as const};
}
export async function uploadImportFile(request:NextRequest,context:Context,job:ImportJob,kind:FileKind) {
  const form=await boundedMultipart(request,MAX_FILE_BYTES+16384);
  if([...form.keys()].some(key=>key!=="file")||form.getAll("file").length!==1)throw new AppError(400,"INVALID_BODY","Send one CSV file for this record type.");
  const file=checkedFile(form.get("file"));
  const expected=manifestSchema.parse(job.file_manifest).find(item=>item.kind===kind)!;
  const bytes=new Uint8Array(await file.arrayBuffer());let parsed:ParsedFile;
  try{parsed=parseCsv(bytes);}catch(error){if(error instanceof CsvFailure)throw new AppError(422,error.code,error.message);throw error;}
  if(file.name!==expected.filename||bytes.length!==expected.size||hash(bytes)!==expected.sha256||JSON.stringify(parsed.headers)!==JSON.stringify(expected.headers))throw new AppError(409,"IMPORT_STALE_FILE","The file differs from this job's manifest. Start a new upload with the intended files.");
  const path=`${context.workspace.id}/${job.id}/${kind}.csv`;
  const result=await context.client.storage.from(bucket).upload(path,bytes,{contentType:"text/csv",upsert:false});
  if(result.error){const prior=await context.client.storage.from(bucket).download(path);if(prior.error||!prior.data||hash(new Uint8Array(await prior.data.arrayBuffer()))!==expected.sha256)throw new AppError(503,"UPLOAD_UNAVAILABLE","The private source could not be stored. Retry these files or start a new job.");}
  return {kind,stored:true as const};
}
async function originalFiles(context:Context,job:ImportJob) {
  const manifest=manifestSchema.parse(job.file_manifest);
  const entries=await Promise.all(manifest.map(async file=>{
    const result=await context.client.storage.from(bucket).download(`${context.workspace.id}/${job.id}/${file.kind}.csv`);
    if(result.error||!result.data)throw new AppError(503,"SOURCE_UNAVAILABLE","The private source files could not be loaded. Retry shortly, or retry the original upload.");
    const bytes=new Uint8Array(await result.data.arrayBuffer());
    if(bytes.length!==file.size||hash(bytes)!==file.sha256)throw new AppError(409,"IMPORT_STALE_FILE","Source file verification failed. Start a new upload with the intended files.");
    try { return [file.kind,parseCsv(bytes)] as const; }catch {throw new AppError(422,"UNSUPPORTED_CSV","The original file could not be parsed. Start a new import.");}
  }));
  return Object.fromEntries(entries) as Record<FileKind,ParsedFile>;
}
async function references(context:Context) {
  const suppliers:string[]=[];const skus:string[]=[];
  for(let offset=0;;offset+=1000) { const result=await context.client.from("suppliers").select("name").eq("org_id",context.workspace.id).order("id").range(offset,offset+999);databaseFailure(result.error);suppliers.push(...(result.data??[]).map(row=>row.name));if((result.data?.length??0)<1000)break;if(offset>=100000)throw new AppError(422,"CATALOG_LIMIT","This catalog is too large for this import version."); }
  for(let offset=0;;offset+=1000) { const result=await context.client.from("products").select("sku").eq("org_id",context.workspace.id).order("id").range(offset,offset+999);databaseFailure(result.error);skus.push(...(result.data??[]).map(row=>row.sku));if((result.data?.length??0)<1000)break;if(offset>=100000)throw new AppError(422,"CATALOG_LIMIT","This catalog is too large for this import version."); }
  return {suppliers,skus};
}
export async function validateImport(context:Context,job:ImportJob,mapping:ColumnMappings) {
  const files=await originalFiles(context,job);
  const {batch,report}=validateFiles(files,mapping,await references(context));
  const result=await context.client.rpc("validate_import",{p_org_id:context.workspace.id,p_job_id:job.id,p_mapping:mapping,p_data:report.valid?batch:null,p_report:report as Json});importFailure(result.error);
  return reportSchema.parse(result.data);
}
export async function commitImport(context:Context,job:ImportJob,confirmUpserts:boolean,validationToken:string) {
  if(job.status==="committed") {
    const report=job.validation_report as {result?:unknown};
    return commitResultSchema.parse({...commitResultSchema.parse(report.result),alreadyCommitted:true});
  }
  if(job.status!=="validated")throw new AppError(409,"VALIDATION_REQUIRED","Validate the files before confirming this import.");
  if((job.validation_report as {validationToken?:string}).validationToken!==validationToken)throw new AppError(409,"IMPORT_STALE_FILE","The reviewed validation changed in another session. Validate and review again.");
  const files=await originalFiles(context,job);
  const {batch,report}=validateFiles(files,mappingSchema.parse(job.column_mapping),await references(context));
  if(!report.valid)throw new AppError(422,"IMPORT_VALIDATION_FAILED","The files no longer pass validation. Review and validate again.",report.errors.map(error=>({path:`${error.kind}.${error.row}.${error.field}`,message:error.message})));
  const result=await context.client.rpc("commit_import",{p_org_id:context.workspace.id,p_job_id:job.id,p_data:batch,p_confirm_upserts:confirmUpserts,p_validation_token:validationToken});importFailure(result.error);
  return commitResultSchema.parse(result.data);
}
