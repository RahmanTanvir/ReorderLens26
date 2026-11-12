"use client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
export default function ScenarioError({retry}:{retry:()=>void}){return <div className="space-y-5"><Alert tone="error">Scenario inputs could not be loaded. Check your connection, then retry. No plan, supplier or order was changed.</Alert><Button onClick={retry}>Retry loading scenario inputs</Button></div>;}
