import { z } from "@/lib/validation/zod";

export const fileKinds = ["suppliers", "products", "inventory_snapshots", "sales_daily"] as const;
export type FileKind = typeof fileKinds[number];
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const MAPPING_VERSION = 1;
export const fields: Record<FileKind, readonly string[]> = {
  suppliers: ["name", "lead_time_days"],
  products: ["sku", "name", "supplier_name", "purchase_cost", "lead_time_days_override", "pack_multiple"],
  inventory_snapshots: ["sku", "as_of_date", "on_hand"],
  sales_daily: ["sku", "sales_date", "units_sold", "availability_status", "promo_active"],
};
export const optionalFields = new Set(["lead_time_days_override", "pack_multiple", "availability_status", "promo_active"]);
// Mapping is canonical field -> exact source header. Empty optional fields use defaults.
export const mappingSchema = z.object(Object.fromEntries(fileKinds.map(kind => [kind, z.record(z.string().max(100), z.string().max(200))])) as Record<FileKind, z.ZodRecord<z.ZodString,z.ZodString>>).strict();
export type ColumnMappings = z.infer<typeof mappingSchema>;
export const validateImportSchema = z.object({ columnMappings: mappingSchema }).strict();
export const commitImportSchema = z.object({ confirmUpserts: z.boolean(), validationToken: z.uuid() }).strict();
export const manifestEntrySchema = z.object({ kind: z.enum(fileKinds), filename: z.string().max(180), size: z.number().int().min(1).max(MAX_FILE_BYTES), sha256: z.string().regex(/^[a-f0-9]{64}$/), headers: z.array(z.string().min(1).max(200)).min(1).max(30) }).strict();
export const manifestSchema = z.array(manifestEntrySchema).length(4);
export const prepareImportSchema=z.object({jobId:z.uuid(),files:manifestSchema}).strict();
export type ManifestEntry = z.infer<typeof manifestEntrySchema>;
export type ParsedFile = { headers: string[]; rows: string[][] };
export type ImportIssue = { kind: FileKind; row: number; field: string; code: string; message: string };
export type ImportBatch = {
  suppliers: { name: string; lead_time_days: number }[];
  products: { sku: string; name: string; supplier_name: string; purchase_cost: string; lead_time_days_override: number | null; pack_multiple: number }[];
  inventory_snapshots: { sku: string; as_of_date: string; on_hand: number }[];
  sales_daily: { sku: string; sales_date: string; units_sold: number; availability_status: "available" | "stockout" | "unknown"; promo_active: boolean }[];
};
export const countsSchema = z.object(Object.fromEntries(fileKinds.map(kind => [kind, z.object({ inserted: z.number().int().nonnegative(), updated: z.number().int().nonnegative() })])) as Record<FileKind,z.ZodObject<{inserted:z.ZodNumber;updated:z.ZodNumber}>>);
export type ImportCounts = z.infer<typeof countsSchema>;
export const reportSchema = z.object({
  valid: z.boolean(), rowCount: z.number().int().nonnegative(), errorCount: z.number().int().nonnegative(),
  errors: z.array(z.object({kind:z.enum(fileKinds), row:z.number().int(), field:z.string(), code:z.string(), message:z.string()})),
  preview: z.array(z.object({kind:z.enum(fileKinds), row:z.number().int(), values:z.record(z.string(),z.union([z.string(),z.number(),z.boolean(),z.null()]))})).max(20),
  counts: countsSchema.optional(), mappingVersion: z.literal(MAPPING_VERSION), validationToken: z.uuid().optional(),
});
export type ImportReport = z.infer<typeof reportSchema>;
export const commitResultSchema = z.object({ jobId: z.uuid(), committedAt: z.string(), counts: countsSchema, alreadyCommitted: z.boolean() });
export const jobViewSchema = z.object({ jobId:z.uuid(), status:z.enum(["uploaded","validated","committed","failed"]), files:manifestSchema, columnMappings:mappingSchema, report:reportSchema.nullable(), committedAt:z.string().nullable(), createdAt:z.string() });
export type JobView = z.infer<typeof jobViewSchema>;
export const uploadResultSchema = z.object({jobId:z.uuid(), files:manifestSchema, status:z.literal("uploaded")});
export function emptyMappings(): ColumnMappings { return {suppliers:{},products:{},inventory_snapshots:{},sales_daily:{}}; }
export function suggestMappings(manifest: ManifestEntry[]): ColumnMappings {
  const mapping = emptyMappings();
  for (const file of manifest) for (const field of fields[file.kind]) {
    const header = file.headers.find(value => value.trim().toLowerCase().replace(/\s+/g,"_") === field);
    mapping[file.kind][field] = header ?? "";
  }
  return mapping;
}
