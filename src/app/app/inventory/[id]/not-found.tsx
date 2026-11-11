import Link from "next/link";
import { Alert } from "@/components/ui/alert";
export default function ProductNotFound(){return <div className="space-y-5"><h1 className="text-2xl font-semibold">Product unavailable</h1><Alert>This product is not available in the selected workspace.</Alert><Link href="/app/inventory" className="inline-flex min-h-11 items-center rounded-sm text-primary underline">Back to Inventory</Link></div>;}
