import { parse } from "csv-parse/browser/esm/sync";
import { manifestEntrySchema,MAX_FILE_BYTES,type FileKind } from "@/lib/imports/contracts";
import { RequestError } from "@/lib/client/request";

export async function describeFile(kind:FileKind,file:File) {
  if(file.size>MAX_FILE_BYTES)throw new RequestError(`${kind}: the file exceeds 2 MiB.`,"FILE_TOO_LARGE");
  const bytes=await file.arrayBuffer();let headers:string[];
  try {
    const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
    headers=((parse(text,{bom:true,to:1,skip_empty_lines:true,max_record_size:65536}) as string[][])[0]??[]).map(value=>value.trim());
    if(new Set(headers.map(value=>value.toLowerCase())).size!==headers.length)throw new Error("Duplicate headers");
  }catch{throw new RequestError(`${kind}: use a UTF-8 CSV with a valid, unique header row.`,"UNSUPPORTED_CSV");}
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  const parsed=manifestEntrySchema.safeParse({kind,filename:file.name,size:file.size,sha256:Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join(""),headers});
  if(!parsed.success)throw new RequestError(`${kind}: use a nonempty CSV with 1–30 headers (up to 200 characters each).`,"UNSUPPORTED_CSV");
  return parsed.data;
}
