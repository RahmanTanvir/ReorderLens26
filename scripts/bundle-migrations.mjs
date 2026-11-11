import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const phase = process.argv[2] ?? "p2";
if (!["p2","p3","p4","p5","p6","p7"].includes(phase)) throw new Error("Choose p2, p3, p4, p5, p6 or p7.");
const files = (await readdir("supabase/migrations")).filter((name) => name.endsWith(".sql") && (phase === "p2" ? name < "20261110000400" : phase === "p3" ? name >= "20261110000400" && name < "20261111000600" : phase === "p4" ? name >= "20261111000600" && name < "20261111000800" : phase === "p5" ? name >= "20261111000800" && name < "20261111001000" : phase === "p6" ? name >= "20261111001000" && name < "20261111001200" : name >= "20261111001200" && name < "20261111001400")).sort();
const statements = await Promise.all(files.map(async (name) => `-- ${name}\n${(await readFile(`supabase/migrations/${name}`, "utf8")).replace(/^\s*(BEGIN|COMMIT);\s*$/gim, "")}`));
await mkdir("artifacts", { recursive: true });
const target = resolve(`artifacts/${phase === "p2" ? "p2-bootstrap" : phase+"-upgrade"}.sql`);
await writeFile(target, `-- Apply ONCE to the isolated ReorderLens development project only.\n-- Atomic bootstrap: existing application objects cause a rollback, never an overwrite.\nBEGIN;\n${statements.join("\n\n")}\nCOMMIT;\n`);
console.log(`Prepared ${files.length} reviewed migrations: ${target}`);
