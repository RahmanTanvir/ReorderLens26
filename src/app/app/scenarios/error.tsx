"use client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
export default function ScenarioError({reset}:{reset:()=>void}){return <div className="space-y-5"><Alert tone="error">Scenario inputs could not be loaded. Check your connection and the P6 development upgrade, then retry. No plan, supplier or order was changed.</Alert><Button onClick={reset}>Retry loading scenario inputs</Button></div>;}
