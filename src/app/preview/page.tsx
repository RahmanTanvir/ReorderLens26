import { AppShell } from "@/components/layout/app-shell";
import { InventoryPreview } from "@/components/preview/inventory-preview";

export const metadata = { title: "Visual preview — ReorderLens" };
export default function PreviewPage() {
  return <AppShell activePath="/app/inventory" previewHref="/preview"><InventoryPreview /></AppShell>;
}
