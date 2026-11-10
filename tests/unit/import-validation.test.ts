import { describe,expect,it } from "vitest";
import { CsvFailure,parseCsv,validateFiles } from "@/domain/imports/validation";
import { fileKinds,MAX_FILE_BYTES,suggestMappings,type ColumnMappings,type FileKind,type ParsedFile } from "@/lib/imports/contracts";

const encode=(text:string)=>new TextEncoder().encode(text);
const csv:Record<FileKind,string>={suppliers:"name,lead_time_days\nEastern Essentials,6",products:"sku,name,supplier_name,purchase_cost,lead_time_days_override,pack_multiple\nrl-102,Oil,Eastern Essentials,210.00,,",inventory_snapshots:"sku,as_of_date,on_hand\nRL-102,2026-11-09,38",sales_daily:"sku,sales_date,units_sold,availability_status,promo_active\nRL-102,2026-11-08,7,,"};
const files=()=>Object.fromEntries(fileKinds.map(kind=>[kind,parseCsv(encode(csv[kind]))])) as Record<FileKind,ParsedFile>;
const mapping=(input:Record<FileKind,ParsedFile>)=>suggestMappings(fileKinds.map(kind=>({kind,filename:`${kind}.csv`,size:1,sha256:"0".repeat(64),headers:input[kind].headers})));
const validate=(input=files(),maps:ColumnMappings=mapping(input))=>validateFiles(input,maps,{suppliers:[],skus:[]},"2026-11-10");

describe("CSV source parsing",()=>{
  it("supports UTF-8 BOM, quoted commas, multiline values and CRLF",()=>{
    expect(parseCsv(encode('\uFEFFsku,name\r\nRL-1,"Rice, premium\n5 kg"\r\n'))).toEqual({headers:["sku","name"],rows:[["RL-1","Rice, premium\n5 kg"]]});
  });
  it.each(["sku,SKU\na,b","sku,\na,b","sku,name\na","sku,name\na,\"broken","sku,name\n","sku,name\na,\u0000"])("rejects ambiguous or malformed source %j",text=>expect(()=>parseCsv(encode(text))).toThrow(CsvFailure));
  it("rejects unsupported encoding and oversized source before parsing",()=>{
    expect(()=>parseCsv(new Uint8Array([255,254,0,0]))).toThrow(/UTF-8/);
    expect(()=>parseCsv(new Uint8Array(MAX_FILE_BYTES+1))).toThrow(/2 MiB/);
  });
  it("does not silently truncate a file exceeding the row cap",()=>expect(()=>parseCsv(encode("sku\n"+"a\n".repeat(5001)))).toThrow(/5,000/));
});
describe("mapped import validation",()=>{
  it("normalizes SKU and preserves exact cost strings and explicit optional defaults",()=>{
    const {batch,report}=validate();expect(report.valid).toBe(true);expect(batch.products[0]).toMatchObject({sku:"RL-102",purchase_cost:"210.00",lead_time_days_override:null,pack_multiple:1});expect(batch.sales_daily[0]).toMatchObject({availability_status:"unknown",promo_active:false});
  });
  it("requires unique reviewed mappings and rejects unsupported fields",()=>{
    const input=files(),maps=mapping(input);maps.products.name="sku";maps.products.user_id="name";const {report}=validate(input,maps);expect(report.valid).toBe(false);expect(report.errors.some(error=>error.code==="MISSING_COLUMN")).toBe(true);
  });
  it("rejects case/whitespace duplicate suppliers and SKU duplicates",()=>{
    const input=files();input.suppliers.rows.push([" eastern   essentials ","3"]);input.products.rows.push([...input.products.rows[0]]);expect(validate(input).report.errors.filter(error=>error.code==="DUPLICATE_KEY")).toHaveLength(2);
  });
  it("rejects decimal/negative counts, invalid enums and booleans without coercion",()=>{
    const input=files();input.inventory_snapshots.rows[0][2]="1.5";input.sales_daily.rows[0]=["RL-102","2026-11-08","-1","unknownish","1"];
    const report=validate(input).report;expect(report.valid).toBe(false);expect(report.errorCount).toBe(4);
  });
  it.each(["2026-02-30","2026-13-01","2026-11-12","1899-12-31","2026-1-01"])("rejects invalid or out-of-window date %s",date=>{
    const input=files();input.inventory_snapshots.rows[0][1]=date;expect(validate(input).report.errors.some(error=>error.code==="INVALID_DATE")).toBe(true);
  });
  it.each(["-1","1.234","1e3","NaN","1000000000000"])("rejects invalid cost %s",cost=>{const input=files();input.products.rows[0][3]=cost;expect(validate(input).report.valid).toBe(false);});
  it("reports orphan references but accepts current-workspace references",()=>{
    const input=files();input.products.rows[0][2]="Current supplier";input.inventory_snapshots.rows[0][0]="CURRENT";
    expect(validate(input).report.errors.map(error=>error.code)).toEqual(["UNKNOWN_SUPPLIER","UNKNOWN_SKU"]);
    expect(validateFiles(input,mapping(input),{suppliers:["Current supplier"],skus:["CURRENT"]},"2026-11-10").report.valid).toBe(true);
  });
  it("rejects duplicate product/day and caps preview at 20 and error details at 100",()=>{
    const input=files();input.sales_daily.rows=Array.from({length:150},()=>[...input.sales_daily.rows[0]]);
    const {report}=validate(input);expect(report.errorCount).toBe(149);expect(report.errors).toHaveLength(100);expect(report.preview).toHaveLength(20);
  });
  it("enforces the combined row limit across individually valid files",()=>{
    const input=files();input.sales_daily.rows=Array.from({length:4998},()=>[...input.sales_daily.rows[0]]);expect(validate(input).report.errors.some(error=>error.code==="ROW_LIMIT")).toBe(true);
  });
});
