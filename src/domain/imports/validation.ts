import { parse } from "csv-parse/sync";
import { fields, fileKinds, MAX_FILE_BYTES, MAX_IMPORT_ROWS, MAPPING_VERSION, optionalFields, type ColumnMappings, type FileKind, type ImportBatch, type ImportIssue, type ImportReport, type ParsedFile } from "@/lib/imports/contracts";

export class CsvFailure extends Error { constructor(public code:string, message:string) { super(message); } }
export function parseCsv(bytes: Uint8Array): ParsedFile {
  if (bytes.length > MAX_FILE_BYTES) throw new CsvFailure("FILE_TOO_LARGE","Each CSV must be no larger than 2 MiB.");
  let text:string;
  try { text = new TextDecoder("utf-8",{fatal:true}).decode(bytes); } catch { throw new CsvFailure("UNSUPPORTED_CSV","Use a UTF-8 encoded CSV file."); }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new CsvFailure("UNSUPPORTED_CSV","Binary files and control characters are not supported.");
  let records:string[][];
  try { records = parse(text,{bom:true,skip_empty_lines:true,max_record_size:65536,to:MAX_IMPORT_ROWS+2,cast:false}) as string[][]; }
  catch { throw new CsvFailure("UNSUPPORTED_CSV","Check CSV quoting and column counts. Use a comma-separated UTF-8 file."); }
  const headers=records.shift()?.map(value=>value.trim()) ?? [];
  if (!headers.length || headers.length>30 || headers.some(value=>!value || value.length>200) || new Set(headers.map(value=>value.toLowerCase())).size!==headers.length) throw new CsvFailure("UNSUPPORTED_CSV","Use 1–30 unique, nonempty column headers (up to 200 characters each).");
  if (!records.length) throw new CsvFailure("UNSUPPORTED_CSV","Each file must contain at least one data row.");
  if (records.length>MAX_IMPORT_ROWS) throw new CsvFailure("ROW_LIMIT","An import can contain no more than 5,000 data rows in total.");
  return {headers,rows:records};
}
export const normalizeName=(value:string)=>value.normalize("NFC").replace(/\s+/gu," ").trim();
export const normalizeSku=(value:string)=>normalizeName(value).toUpperCase();
export function dhakaDate(now=new Date()) { return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).format(now); }

export function validateFiles(files:Record<FileKind,ParsedFile>, mappings:ColumnMappings, existing:{suppliers:string[];skus:string[]}, today=dhakaDate()): {batch:ImportBatch;report:ImportReport} {
  const batch:ImportBatch={suppliers:[],products:[],inventory_snapshots:[],sales_daily:[]};
  const report:ImportReport={valid:false,rowCount:0,errorCount:0,errors:[],preview:[],mappingVersion:MAPPING_VERSION};
  const add=(issue:ImportIssue)=>{ report.errorCount++; if(report.errors.length<100) report.errors.push(issue); };
  report.rowCount=fileKinds.reduce((total,kind)=>total+files[kind].rows.length,0);
  if(report.rowCount>MAX_IMPORT_ROWS)add({kind:"suppliers",row:1,field:"files",code:"ROW_LIMIT",message:"Keep the four files within 5,000 combined data rows."});
  const tomorrow=new Date(`${today}T00:00:00Z`);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  const maxDate=tomorrow.toISOString().slice(0,10);
  for(const kind of fileKinds) {
    const mapping=mappings[kind]; const used=new Set<string>(); const mappingErrorsBefore=report.errorCount;
    for(const [field,source] of Object.entries(mapping)) {
      if (!fields[kind].includes(field) || (source && (!files[kind].headers.includes(source) || used.has(source)))) add({kind,row:1,field,code:"MISSING_COLUMN",message:"Choose a unique source column for each supported field."});
      if(source)used.add(source);
    }
    for(const field of fields[kind]) if(!mapping[field] && !optionalFields.has(field)) add({kind,row:1,field,code:"MISSING_COLUMN",message:"Map this required field."});
    if(report.errorCount>mappingErrorsBefore) continue;
    const keys=new Set<string>();
    files[kind].rows.forEach((row,index)=>{
      const rowNumber=index+2;
      const issue=(field:string,code:string,message:string)=>add({kind,row:rowNumber,field,code,message});
      const cell=(field:string)=>mapping[field] ? row[files[kind].headers.indexOf(mapping[field])]?.trim() ?? "" : "";
      const str=(field:string,max:number)=>{const value=normalizeName(cell(field));if(!value || value.length>max)issue(field,"INVALID_TEXT",`Use 1–${max} characters.`);return value;};
      const integer=(field:string,min:number,max:number,fallback?:number)=>{const value=cell(field); if(!value && fallback!==undefined)return fallback;if(!/^\d+$/.test(value)||Number(value)<min||Number(value)>max)issue(field,"INVALID_INTEGER",`Use a whole number from ${min} to ${max}.`);return Number(value);};
      const date=(field:string)=>{const value=cell(field);const parsed=new Date(`${value}T00:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value||value<"1900-01-01"||value>maxDate)issue(field,"INVALID_DATE","Use a real YYYY-MM-DD date from 1900 through tomorrow (Asia/Dhaka).");return value;};
      let record:ImportBatch[FileKind][number];let key:string;
      if(kind==="suppliers") { const name=str("name",150);key=name.toLowerCase();record={name,lead_time_days:integer("lead_time_days",0,365)};batch.suppliers.push(record); }
      else if(kind==="products") {
        const sku=normalizeSku(str("sku",60));key=sku;
        const cost=cell("purchase_cost");if(!/^\d{1,12}(\.\d{1,2})?$/.test(cost))issue("purchase_cost",cost.startsWith("-")?"NEGATIVE_COST":"INVALID_COST","Use a nonnegative BDT amount with at most two decimals and 12 integer digits.");
        record={sku,name:str("name",200),supplier_name:str("supplier_name",150),purchase_cost:cost,lead_time_days_override:cell("lead_time_days_override")===""?null:integer("lead_time_days_override",0,365),pack_multiple:integer("pack_multiple",1,10000,1)};batch.products.push(record);
      } else if(kind==="inventory_snapshots") { const sku=normalizeSku(str("sku",60));const as_of_date=date("as_of_date");key=`${sku}/${as_of_date}`;record={sku,as_of_date,on_hand:integer("on_hand",0,2147483647)};batch.inventory_snapshots.push(record); }
      else {const sku=normalizeSku(str("sku",60));const sales_date=date("sales_date");key=`${sku}/${sales_date}`;const availability=cell("availability_status")||"unknown";const promo=cell("promo_active")||"false";if(!["available","stockout","unknown"].includes(availability))issue("availability_status","INVALID_ENUM","Use available, stockout or unknown.");if(!["true","false"].includes(promo))issue("promo_active","INVALID_BOOLEAN","Use true or false.");record={sku,sales_date,units_sold:integer("units_sold",0,2147483647),availability_status:availability as "available"|"stockout"|"unknown",promo_active:promo==="true"};batch.sales_daily.push(record);}
      if(keys.has(key))issue(kind==="suppliers"?"name":"sku","DUPLICATE_KEY","Duplicate normalized supplier, SKU or product/date in this file. Keep one row per key.");keys.add(key);
      if(report.preview.length<20)report.preview.push({kind,row:rowNumber,values:{...record}});
    });
  }
  const supplierNames=new Set([...existing.suppliers,...batch.suppliers.map(row=>row.name)].map(value=>normalizeName(value).toLowerCase()));
  const skus=new Set([...existing.skus,...batch.products.map(row=>row.sku)].map(normalizeSku));
  batch.products.forEach((row,index)=>{if(!supplierNames.has(row.supplier_name.toLowerCase()))add({kind:"products",row:index+2,field:"supplier_name",code:"UNKNOWN_SUPPLIER",message:"Supplier must exist in this import or the current workspace."});});
  for(const kind of ["inventory_snapshots","sales_daily"] as const)batch[kind].forEach((row,index)=>{if(!skus.has(row.sku))add({kind,row:index+2,field:"sku",code:"UNKNOWN_SKU",message:"SKU must exist in this import or the current workspace."});});
  report.valid=report.errorCount===0;return {batch,report};
}
