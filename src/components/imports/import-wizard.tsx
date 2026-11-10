"use client";

import { useEffect,useRef,useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ArrowLeft,ArrowRight,Check,Download,FileSpreadsheet,LoaderCircle,Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button,buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import { requestJson,RequestError } from "@/lib/client/request";
import { useMutation } from "@/lib/client/use-mutation";
import { describeFile } from "@/lib/imports/file-manifest";
import { commitResultSchema,emptyMappings,fields,fileKinds,MAX_FILE_BYTES,optionalFields,reportSchema,suggestMappings,uploadResultSchema,type FileKind,type ImportCounts,type ImportReport,type JobView } from "@/lib/imports/contracts";

const titles:Record<FileKind,string>={suppliers:"Suppliers",products:"Products",inventory_snapshots:"Stock snapshots",sales_daily:"Daily sales"};
const labels:Record<string,string>={name:"Name",lead_time_days:"Default lead time (days)",sku:"SKU",supplier_name:"Supplier name",purchase_cost:"Purchase cost (BDT)",lead_time_days_override:"SKU lead time override",pack_multiple:"Pack multiple",as_of_date:"Snapshot date",on_hand:"On-hand units",sales_date:"Sales date",units_sold:"Units sold",availability_status:"Availability status",promo_active:"Promotion active"};

export function ImportCountsTable({counts}:{counts:ImportCounts}) {
  return <Table scrollLabel="Import record counts"><TableHeader><TableRow><TableHead>Record type</TableHead><TableHead className="text-right">New records</TableHead><TableHead className="text-right">Updates</TableHead></TableRow></TableHeader><TableBody>{fileKinds.map(kind=><TableRow key={kind}><TableCell>{titles[kind]}</TableCell><TableCell className="text-right tabular-nums">{counts[kind].inserted}</TableCell><TableCell className="text-right tabular-nums">{counts[kind].updated}</TableCell></TableRow>)}</TableBody></Table>;
}
export function ValidationReport({report}:{report:ImportReport}) {
  return <div className="space-y-5">
    <Alert tone={report.valid?"success":"error"}>{report.valid?`${report.rowCount.toLocaleString()} rows passed validation. No business records have been imported yet.`:`${report.errorCount.toLocaleString()} validation issues found. No business records were imported.`}</Alert>
    {report.counts?<ImportCountsTable counts={report.counts}/>:null}
    {report.errors.length?<div><h3 className="mb-3 text-sm font-semibold">Issues to resolve</h3><Table scrollLabel="CSV validation issues"><TableHeader><TableRow><TableHead>File / row</TableHead><TableHead>Field</TableHead><TableHead>Issue</TableHead></TableRow></TableHeader><TableBody>{report.errors.map((error,index)=><TableRow key={index}><TableCell className="whitespace-nowrap">{titles[error.kind]} · {error.row}</TableCell><TableCell>{labels[error.field]??error.field}</TableCell><TableCell className="min-w-64"><span className="block text-xs text-destructive">{error.code}</span>{error.message}</TableCell></TableRow>)}</TableBody></Table><p className="mt-3 text-xs text-muted-foreground">Row numbers count CSV records, including the header; quoted multiline records count as one. Showing at most 100 issues. Correct source values in your CSV and start a new upload; mapping errors can be fixed below.</p></div>:null}
    {report.preview.length?<div><h3 className="mb-3 text-sm font-semibold">Mapped preview · first {report.preview.length} rows</h3><Table scrollLabel="Mapped CSV preview"><TableHeader><TableRow><TableHead>File / row</TableHead><TableHead>Mapped values</TableHead></TableRow></TableHeader><TableBody>{report.preview.map((row,index)=><TableRow key={index}><TableCell className="whitespace-nowrap align-top">{titles[row.kind]} · {row.row}</TableCell><TableCell className="min-w-72"><dl className="flex flex-wrap gap-x-5 gap-y-2">{Object.entries(row.values).map(([key,value])=><div key={key} className="max-w-72 break-words"><dt className="text-xs text-muted-foreground">{labels[key]??key}</dt><dd>{value===null?"Use supplier default":String(value)}</dd></div>)}</dl></TableCell></TableRow>)}</TableBody></Table></div>:null}
  </div>;
}

export function ImportWizard({initialJob=null,canUpload,canManageJob}:{initialJob?:JobView|null;canUpload:boolean;canManageJob:boolean}) {
  const mutation=useMutation();const id=useRef<string|null>(null);
  const router=useRouter();const panel=useRef<HTMLElement>(null);const mounted=useRef(false);
  const [files,setFiles]=useState<Partial<Record<FileKind,File>>>({});
  const [job,setJob]=useState<JobView|null>(initialJob);
  const [mappings,setMappings]=useState(initialJob?.columnMappings??emptyMappings());
  const [report,setReport]=useState<ImportReport|null>(initialJob?.report??null);
  const [step,setStep]=useState(initialJob?.status==="committed"?4:initialJob?.report?2:initialJob?1:0);
  const [confirmed,setConfirmed]=useState(false);
  const [template,setTemplate]=useState<FileKind>("suppliers");
  const [committedAt,setCommittedAt]=useState(initialJob?.committedAt??null);
  const [finalCounts,setFinalCounts]=useState<ImportCounts|null>(initialJob?.status==="committed"?initialJob.report?.counts??null:null);
  useEffect(()=>{if(mounted.current)panel.current?.focus();else mounted.current=true;},[step]);
  const editable=canUpload&&(!initialJob||!job||job.jobId!==initialJob.jobId||canManageJob);
  const busy=mutation.busy;
  const updates=report?.counts?fileKinds.reduce((total,kind)=>total+report.counts![kind].updated,0):0;
  function reset() {mutation.clear();setJob(null);setFiles({});setMappings(emptyMappings());setReport(null);setStep(0);setConfirmed(false);setCommittedAt(null);setFinalCounts(null);id.current=null;window.history.replaceState(null,"","/app/data");}
  async function upload(event:FormEvent) {
    event.preventDefault();
    const result=await mutation.run(async()=>{
      id.current??=crypto.randomUUID();
      // Only headers are discovered locally; the server parses/verifies every
      // original byte. Separate transfers keep each request under platform caps.
      const manifest=await Promise.all(fileKinds.map(async kind=>{
        const file=files[kind];if(!file)throw new RequestError(`Choose a ${titles[kind].toLowerCase()} CSV file.`,"MISSING_REQUIRED_FILE");if(file.size>MAX_FILE_BYTES)throw new RequestError(`${titles[kind]} exceeds 2 MiB.`,"FILE_TOO_LARGE");
        return describeFile(kind,file);
      }));
      // The server verifies these proposed headers against each original file.
      const preparation=await requestJson("/api/imports","POST",{jobId:id.current,files:manifest},uploadResultSchema);
      const transfers=await Promise.allSettled(fileKinds.map(kind=>{const form=new FormData();form.set("file",files[kind]!);return requestJson(`/api/imports/${id.current}/files/${kind}`,"POST",form,z.object({kind:z.enum(fileKinds),stored:z.literal(true)}));}));
      const failure=transfers.find(result=>result.status==="rejected");if(failure?.status==="rejected")throw failure.reason;
      return preparation;
    });
    if(result.ok) {const value=result.data;const suggested=suggestMappings(value.files);setJob({jobId:value.jobId,status:"uploaded",files:value.files,columnMappings:suggested,report:null,committedAt:null,createdAt:new Date().toISOString()});setMappings(suggested);setStep(1);window.history.replaceState(null,"",`/app/data?jobId=${value.jobId}`);}
  }
  async function validate() {
    if(!job)return;
    const result=await mutation.run(()=>requestJson(`/api/imports/${job.jobId}/validate`,"POST",{columnMappings:mappings},reportSchema));
    if(result.ok){setReport(result.data);setConfirmed(false);setStep(2);}
  }
  async function commit() {
    if(!job||!confirmed||!report?.validationToken)return;
    const result=await mutation.run(()=>requestJson(`/api/imports/${job.jobId}/commit`,"POST",{confirmUpserts:updates>0,validationToken:report.validationToken},commitResultSchema));
    if(result.ok){setCommittedAt(result.data.committedAt);setFinalCounts(result.data.counts);setStep(4);router.refresh();}
  }
  return <div className="space-y-6">
    <ol aria-label="Import progress" className="grid grid-cols-2 gap-x-5 gap-y-4 border-y py-5 text-xs sm:grid-cols-4">{["Upload","Map columns","Validate","Confirm import"].map((label,index)=><li key={label} aria-current={Math.min(step,3)===index?"step":undefined} className={`flex items-center gap-2 ${step>=index?"text-primary":"text-muted-foreground"}`}><span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current">{step>index?<Check aria-hidden="true" className="size-3"/>:index+1}</span><span>{label}</span></li>)}</ol>
    <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_290px] lg:grid-cols-[minmax(0,1fr)_260px]">
      <section ref={panel} tabIndex={-1} aria-label="CSV import workflow" aria-busy={busy} className="min-w-0 space-y-6 rounded-xl border bg-card p-5 outline-none sm:p-6">
        {mutation.error?<Alert tone="error">{mutation.error.message} {mutation.error.code==="NETWORK_ERROR"?"Retrying the same job is safe; a confirmed import will not run twice.":""}</Alert>:null}
        {!editable?<Alert>You can review import reports. Only the owner or operator who started an import can validate or confirm it.</Alert>:null}
        {step===0?<form onSubmit={upload} className="space-y-6"><div><h2 className="text-lg font-semibold">Upload your CSV files</h2><p className="mt-2 text-xs leading-6 text-secondary-foreground">One file per record type. UTF-8 CSV · up to 2 MiB each · 5,000 combined data rows.</p></div><div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-5"><Upload aria-hidden="true" className="mb-4 size-6 text-primary"/><p className="text-sm font-medium">Choose all four files</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Use the matching field for each dataset. Column names can be mapped in the next step.</p><div className="mt-5 grid gap-5 sm:grid-cols-2">{fileKinds.map(kind=><div key={kind}><label htmlFor={`import-${kind}`} className="mb-2 flex items-center gap-2 text-xs font-semibold"><FileSpreadsheet aria-hidden="true" className="size-4 text-primary"/>{titles[kind]}</label><Input id={`import-${kind}`} type="file" accept=".csv,text/csv" disabled={!editable||busy} onChange={event=>{setFiles({...files,[kind]:event.target.files?.[0]});id.current=null;}} className="h-auto min-h-11 py-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-foreground"/></div>)}</div></div><div className="flex justify-end"><Button type="submit" disabled={!editable||busy||fileKinds.some(kind=>!files[kind])}>{busy?<LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none"/>:<ArrowRight aria-hidden="true"/>}{busy?"Storing private files…":"Continue to column mapping"}</Button></div></form>:null}
        {step===1&&job?<><div><h2 className="text-lg font-semibold">Review column mappings</h2><p className="mt-2 text-xs leading-6 text-secondary-foreground">Suggested matches need your review. Each source column can map to only one field per file. Nothing is imported yet.</p></div>{job.files.map(file=><fieldset key={file.kind} disabled={busy||!editable} className="rounded-lg border p-4"><legend className="px-2 text-sm font-semibold">{titles[file.kind]} <span className="font-normal text-muted-foreground">· {file.filename}</span></legend><div className="grid gap-4 sm:grid-cols-2">{fields[file.kind].map(field=><div key={field}><label htmlFor={`map-${file.kind}-${field}`} className="mb-2 block text-xs text-secondary-foreground">{labels[field]}{optionalFields.has(field)?" (optional)":" *"}</label><Select id={`map-${file.kind}-${field}`} value={mappings[file.kind][field]??""} onChange={event=>setMappings({...mappings,[file.kind]:{...mappings[file.kind],[field]:event.target.value}})}><option value="">{optionalFields.has(field)?"Use documented default":"Choose source column"}</option>{file.headers.map(header=><option key={header} value={header}>{header}</option>)}</Select></div>)}</div></fieldset>)}<div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={busy||!canUpload} onClick={reset}>Start a new upload</Button><Button disabled={busy||!editable} onClick={validate}>{busy?<LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none"/>:<Check aria-hidden="true"/>}{busy?"Validating original files…":"Validate files"}</Button></div></>:null}
        {step===2&&report?<><h2 className="text-lg font-semibold">Validation results</h2><ValidationReport report={report}/><div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={busy||!editable} onClick={()=>setStep(1)}><ArrowLeft aria-hidden="true"/>Edit mappings</Button>{report.valid?<Button disabled={!editable||busy} onClick={()=>setStep(3)}>Review and confirm<ArrowRight aria-hidden="true"/></Button>:<Button variant="outline" disabled={busy||!canUpload} onClick={reset}>Choose corrected CSV files</Button>}</div></>:null}
        {step===3&&report?.counts?<><div><h2 className="text-lg font-semibold">Confirm your import</h2><p className="mt-2 text-sm leading-6 text-secondary-foreground">The original private files will be checked again. All four datasets are saved together, or none are saved.</p></div><ImportCountsTable counts={report.counts}/>{updates>0?<Alert>Updating {updates.toLocaleString()} existing records. Matching supplier names, SKUs and product/date records will be replaced with the imported values.</Alert>:null}<Alert>Earlier forecasts and replenishment plans become stale. Saved purchase-order snapshots stay unchanged.</Alert><label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={confirmed} disabled={busy||!editable} onChange={event=>setConfirmed(event.target.checked)}/>I reviewed the preview and approve importing these records{updates>0?", including the listed updates":""}.</label><div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={busy} onClick={()=>setStep(2)}>Back to validation</Button><Button disabled={!editable||busy||!confirmed} onClick={commit}>{busy?<LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none"/>:<Check aria-hidden="true"/>}{busy?"Confirming import…":"Confirm import"}</Button></div></>:null}
        {step===4?<><Alert tone="success">Import confirmed. The records are saved in this workspace.</Alert>{committedAt?<p className="text-xs text-muted-foreground">Confirmed {new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Dhaka",dateStyle:"medium",timeStyle:"short"}).format(new Date(committedAt))} · Asia/Dhaka</p>:null}{finalCounts?<ImportCountsTable counts={finalCounts}/>:null}<p className="text-sm leading-6 text-secondary-foreground">Inventory analysis and forecasting become available in their upcoming phases. This report confirms the saved source records.</p><div className="flex flex-wrap gap-3"><Button disabled={!canUpload||busy} variant="outline" onClick={reset}>Import another dataset</Button><a href="/app/overview" className={buttonVariants({variant:"outline"})}>Back to overview</a></div></>:null}
      </section>
      <aside className="space-y-4"><section className="rounded-xl border bg-card p-5"><p className="text-xs font-semibold tracking-wider text-primary uppercase">Data checklist</p><h2 className="mt-3 text-sm font-semibold">What you’ll need</h2><ul className="mt-5 space-y-4 text-xs leading-5 text-secondary-foreground">{["Unique supplier names and lead times","Product SKUs, names and purchase costs","Dated on-hand stock snapshots","Recorded daily sales by SKU"].map(item=><li key={item} className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-primary"/>{item}</li>)}</ul><div className="mt-5 border-t pt-4"><h3 className="text-xs font-semibold">Optional, but valuable</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Historical availability distinguishes recorded stockouts from zero-sales days. Missing days never become assumed zero sales.</p></div></section><section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-sm font-semibold">CSV templates</h2><label htmlFor="csv-template" className="sr-only">Template record type</label><Select id="csv-template" value={template} onChange={event=>setTemplate(event.target.value as FileKind)}>{fileKinds.map(kind=><option key={kind} value={kind}>{titles[kind]}</option>)}</Select><a href={`/templates/${template}.csv`} download className={buttonVariants({variant:"outline",className:"w-full"})}><Download aria-hidden="true"/>Download template</a><p className="text-xs leading-5 text-muted-foreground">Headers only. Add your records; review the mapping before confirming.</p></section></aside>
    </div>
  </div>;
}
