"use client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
export default function PlanningError({reset}:{reset:()=>void}){return <div className="space-y-5"><Alert tone="error">Planning could not be loaded. Check your connection and confirm the P6 development upgrade is applied. An interrupted response does not prove a save failed; reload the saved plan before retrying edits.</Alert><Button onClick={reset}>Retry loading planner</Button></div>;}
