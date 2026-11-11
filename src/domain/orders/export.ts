import type { OrderRead } from "@/lib/orders/contracts";

// Quote every field (RFC 4180), neutralize spreadsheet formula prefixes even
// behind whitespace/control characters. Never interpolate labels into filenames.
export function csvCell(value:string|number) {
  const text=String(value);const safe=/^[\s\u0000-\u001f]*[=+\-@]/u.test(text)||/^[\t\r\n]/.test(text)?`'${text}`:text;
  return `"${safe.replaceAll('"','""')}"`;
}
export function orderCsv({order,items}:OrderRead) {
  const rows:(string|number)[][]=[
    ["ReorderLens purchase-order draft","Draft — not sent"],
    ["Order",order.orderNumber],["Created",order.createdAt],["Workspace",order.document.workspaceName],
    ["Location",order.document.workspaceLocation],["Supplier",order.document.supplierName],
    ["Currency","BDT"],["Data mode",order.document.isSample?"Sample workspace — Illustrative data":"Imported workspace"],
    ["Plan",order.planId],["Reviewed revision",order.document.planRevision],["Input snapshot",order.document.inputSnapshotAt],
    [],["Product","SKU","Quantity","Pack multiple","Unit cost (BDT)","Line total (BDT)","Nominal lead days"],
    ...items.map(line=>[line.name,line.sku,line.quantity,line.packMultiple,line.unitCost,line.lineTotal,line.leadDays]),
    [],["Total draft amount (BDT)",order.total],["Additional charges","Not included"],
    ["Notice","Draft only. No order has been sent, accepted, paid or received. Lead times are estimates, not confirmed delivery dates."],
  ];
  return "\ufeff"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";
}
