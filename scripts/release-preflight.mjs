import { execFileSync } from "node:child_process";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { secretFindings } from "../src/lib/security/release-scan.ts";

const requireNext=createRequire(import.meta.resolve("next/package.json"));
// Use Next's dotenv precedence, quoting and expansion without logging values.
requireNext("@next/env").loadEnvConfig(process.cwd(),false,{info(){},error(){throw Error("Release environment configuration could not be loaded.");}});
const failures=[],files=execFileSync("git",["ls-files","--cached","--others","--exclude-standard","-z"],{encoding:"utf8"}).split("\0").filter(Boolean);
const setting=name=>process.env[name];
const textFile=name=>/\.(?:[cm]?js|tsx?|json|ya?ml|sql|md|toml|txt|csv|html|css)$/.test(name)||name===".env.example";
for(const file of files.filter(textFile)){
  const content=await readFile(file,"utf8").catch(()=>null);if(content===null)continue;
  for(const finding of secretFindings(content))failures.push(`${file}:${finding.line}: ${finding.kind}`);
}
if(files.some(name=>name.startsWith("ReorderLens_Docs/")||/^\.env(?!\.example$)/.test(name)))failures.push("Private documentation/environment file is visible to Git.");
const example=await readFile(".env.example","utf8");
for(const line of example.split(/\r?\n/))if(/^(?:OPENROUTER_API_KEY|SUPABASE_SECRET_KEY|NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)=.+/.test(line))failures.push("Shared environment template must contain blank service values.");
if(setting("AI_ASSISTANT_ENABLED")==="true")failures.push("Accepted P8 release mode requires external inference disabled.");
if(setting("OPENROUTER_SAMPLE_EVALUATION")==="true")failures.push("Sample model evaluation must remain disabled for the accepted release mode.");
if(process.argv.includes("--production")){
  try{const url=new URL(setting("NEXT_PUBLIC_APP_URL")??"");if(url.protocol!=="https:"||/^(localhost|127\.|\[::1\])/.test(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=="/")throw Error();}catch{failures.push("Production app URL must be an explicit HTTPS deployment origin.");}
  if(!setting("NEXT_PUBLIC_SUPABASE_URL")||!setting("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")?.startsWith("sb_publishable_"))failures.push("Production requires an isolated approved Supabase URL and publishable key.");
}
const hash=createHash("sha256").update(await readFile("public/branding/reorderlens-logo.png")).digest("hex");
if(hash!=="34dc3a487cc24a6bc99c710fd1227ef45b5028f9c6b7d0c36219c92c2ea3cc85")failures.push("Runtime logo differs from the supplied approved asset.");
let chunks=0;
async function scanBrowser(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+"/"+entry.name;if(entry.isDirectory())await scanBrowser(path);else if(/\.(js|css|html|map)$/.test(path)){chunks++;const content=await readFile(path,"utf8");for(const finding of secretFindings(content))failures.push(`Browser artifact ${path}: ${finding.kind}`);if(/OPENROUTER_API_KEY|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(content))failures.push(`Server credential setting found in browser artifact ${path}`);}}}
try{await scanBrowser(".next/static");}catch(error){if(error.code==="ENOENT")failures.push("Build is missing; run the production build before release preflight.");else throw error;}
const result={mode:process.argv.includes("--production")?"production-config":"local-build",gitFilesChecked:files.length,browserArtifactsChecked:chunks,logoPreserved:hash==="34dc3a487cc24a6bc99c710fd1227ef45b5028f9c6b7d0c36219c92c2ea3cc85",failures,passed:failures.length===0,scope:"Static credential/config/branding checks only; not hosted security or release approval."};
await mkdir("artifacts",{recursive:true});await writeFile("artifacts/p9-preflight.json",JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
