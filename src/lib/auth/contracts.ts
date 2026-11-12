import { z } from "@/lib/validation/zod";

export const roleSchema = z.enum(["owner", "operator", "viewer"]);
export type WorkspaceRole = z.infer<typeof roleSchema>;
export const emailSchema = z.email().trim().max(254);
export const newPasswordSchema = z.string().min(12, "Use at least 12 characters.").max(128);
export const credentialsSchema = z.object({ email: emailSchema, password: z.string().min(1).max(1024), next: z.string().max(1000).optional() }).strict();
export const signupSchema = z.object({ email: emailSchema, password: newPasswordSchema }).strict();
export const emailRequestSchema = z.object({ email: emailSchema }).strict();
export const passwordUpdateSchema = z.object({ password: newPasswordSchema, confirmPassword: z.string() }).strict().refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords must match." });
export const workspaceFields = { name: z.string().trim().min(2).max(120), location: z.string().trim().min(1).max(160) };
export const workspaceCreateSchema = z.object({ ...workspaceFields, isSample: z.boolean().default(false) }).strict();
export const workspaceUpdateSchema = z.object(workspaceFields).strict();
export const profileUpdateSchema = z.object({ displayName: z.string().trim().max(120) }).strict();
export const workspaceSelectionSchema = z.object({ workspaceId: z.uuid() }).strict();

export type Workspace = { id: string; name: string; location: string; currency_code: "BDT"; timezone: "Asia/Dhaka"; is_sample: boolean; created_by: string; created_at: string; updated_at: string };
export type MembershipWorkspace = Workspace & { role: WorkspaceRole };
export type AccountSummary = { displayName: string; role: WorkspaceRole };

export function safeNextPath(value: string | null | undefined, fallback = "/app/overview") {
  if (!value || value.length > 1000) return fallback;
  try {
    let decoded = value;
    for (let index = 0; index < 3; index++) decoded = decodeURIComponent(decoded);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u0020]/.test(decoded)) return fallback;
    const url = new URL(value, "https://reorderlens.invalid");
    if (url.origin !== "https://reorderlens.invalid") return fallback;
    if (!(url.pathname === "/setup" || url.pathname === "/auth/reset" || url.pathname === "/app" || url.pathname.startsWith("/app/"))) return fallback;
    return `${url.pathname}${url.search}`;
  } catch { return fallback; }
}
