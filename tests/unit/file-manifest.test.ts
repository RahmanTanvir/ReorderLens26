import { describe,expect,it } from "vitest";
import { createHash } from "node:crypto";
import { describeFile } from "@/lib/imports/file-manifest";

describe("browser-compatible source manifest",()=>{
  it("discovers a quoted UTF-8 BOM header and hashes the exact original bytes",async()=>{
    const source='\uFEFF"Product SKU","Display, name"\r\nSKU,Test\r\n';
    const result=await describeFile("products",new File([source],"products.csv",{type:"text/csv"}));
    expect(result.headers).toEqual(["Product SKU","Display, name"]);expect(result.sha256).toBe(createHash("sha256").update(source).digest("hex"));expect(result.size).toBe(Buffer.byteLength(source));
  });
  it("rejects duplicate headers and invalid encoding before job creation",async()=>{
    await expect(describeFile("products",new File(["sku,SKU\na,b"],"products.csv"))).rejects.toMatchObject({code:"UNSUPPORTED_CSV"});
    await expect(describeFile("products",new File([new Uint8Array([255,254])],"products.csv"))).rejects.toMatchObject({code:"UNSUPPORTED_CSV"});
  });
});
