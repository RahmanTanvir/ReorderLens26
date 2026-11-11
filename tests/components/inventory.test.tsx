// @vitest-environment jsdom
import "./setup";
import { render,screen,within } from "@testing-library/react";
import axe from "axe-core";
import { describe,expect,it } from "vitest";
import { InventoryWorkspace } from "@/components/inventory/inventory-workspace";
import { ProductDetails } from "@/components/inventory/product-detail";
import { OverviewWorkspace } from "@/components/inventory/overview-workspace";
import { inventoryQuerySchema,inventoryBack } from "@/lib/inventory/contracts";
import { list,detail } from "../fixtures/inventory";

describe("inventory product interactions",()=>{
  it("keeps filter/search/sort state in GET controls and detail return links",()=>{
    render(<InventoryWorkspace data={list} query={inventoryQuerySchema.parse({q:"Oil",status:"at_risk",supplierId:list.suppliers[0].id,sort:"risk"})}/>);
    expect(screen.getByRole("form",{name:"Inventory filters"})).toHaveAttribute("method","get");expect(screen.getByLabelText("Search inventory")).toHaveValue("Oil");expect(screen.getByLabelText("Sort inventory")).toHaveValue("risk");expect(screen.getByRole("button",{name:"Apply filters"})).toBeEnabled();
    const link=screen.getByRole("link",{name:"Fictional QA Oil"});expect(link.getAttribute("href")).toContain("back=");expect(screen.getByRole("link",{name:"Open Replenishment Planner"})).toHaveAttribute("href","/app/replenishment");
  });
  it("renders unknown demand separately from healthy and exposes a useful empty filter state",()=>{
    render(<InventoryWorkspace data={{...list,items:[],matchCount:0,summary:{...list.summary,at_risk:0,unknown:1}}} query={inventoryQuerySchema.parse({q:"unmatched"})}/>);
    expect(screen.getByText("No matching products")).toBeInTheDocument();expect(screen.getByText(/Insufficient data is not zero demand/)).toBeInTheDocument();
  });
  it("shows recorded zero stockout dates without inventing missing days or a forecast line",()=>{
    render(<ProductDetails data={detail} back="/app/inventory?q=Oil"/>);
    expect(screen.getByRole("link",{name:"Back to Inventory"})).toHaveAttribute("href","/app/inventory?q=Oil");expect(screen.getByText("5.4 days")).toBeInTheDocument();expect(screen.getByText("0.6 days")).toBeInTheDocument();
    const table=screen.getByRole("region",{name:"Recorded sales and historical availability"});expect(within(table).getByText("stockout")).toBeInTheDocument();expect(within(table).queryByText("2026-11-08")).not.toBeInTheDocument();expect(screen.queryByText("Saved forecast points")).not.toBeInTheDocument();
    expect(inventoryBack("https://evil.example/app/inventory")).toBe("/app/inventory");
  });
  it("does not invent a budget or expose an unimplemented planner action on overview",()=>{
    render(<OverviewWorkspace data={{inventory:list,budget:null}}/>);expect(screen.getByText(/No valid replenishment draft is saved/)).toBeInTheDocument();expect(screen.getByRole("link",{name:"View product"})).toHaveAttribute("href",`/app/inventory/${detail.item.id}`);
  });
  it("keeps form, table and chart semantics accessible",async()=>{
    const {container}=render(<ProductDetails data={detail}/>);const result=await axe.run(container,{runOnly:{type:"rule",values:["label","aria-prohibited-attr","aria-valid-attr-value","svg-img-alt"]}});expect(result.violations).toEqual([]);
  });
});
