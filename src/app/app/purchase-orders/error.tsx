"use client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
export default function OrderError({retry}:{retry:()=>void}){return <div className="space-y-4"><h1 className="text-2xl font-bold">Purchase orders unavailable</h1><Alert tone="error">The saved drafts could not be loaded. Your saved data has not changed.</Alert><Button onClick={retry}>Try again</Button></div>;}
