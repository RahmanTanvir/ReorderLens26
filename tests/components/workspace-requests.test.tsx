// @vitest-environment jsdom
import "./setup";
import { render,screen,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach,describe,expect,it,vi } from "vitest";
import { z } from "zod";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
import { WorkspaceRequestProvider,useWorkspaceRequest } from "@/components/workspace/workspace-request-provider";
import { ForecastControls } from "@/components/forecasts/forecast-controls";
import { DocumentActions } from "@/components/orders/document-actions";
const a="a0000000-0000-4000-8000-000000000001",b="a0000000-0000-4000-8000-000000000002";
afterEach(()=>vi.unstubAllGlobals());
function Mutation(){const request=useWorkspaceRequest();return <button onClick={()=>void request("/api/workspace","PATCH",{name:"Rendered workspace"},z.object({saved:z.boolean()}))}>Save</button>;}
describe("rendered workspace request isolation",()=>{
  it("keeps each tab's intent even when another tab changes the shared cookie",async()=>{const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({data:{saved:true}}))));vi.stubGlobal("fetch",fetcher);const user=userEvent.setup();render(<><section aria-label="Tab A"><WorkspaceRequestProvider workspaceId={a}><Mutation/></WorkspaceRequestProvider></section><section aria-label="Tab B"><WorkspaceRequestProvider workspaceId={b}><Mutation/></WorkspaceRequestProvider></section></>);document.cookie=`rl-workspace=${b}`;await user.click(within(screen.getByRole("region",{name:"Tab A"})).getByRole("button"));await user.click(within(screen.getByRole("region",{name:"Tab B"})).getByRole("button"));expect(fetcher.mock.calls.map(c=>c[1].headers["X-Workspace-Id"])).toEqual([a,b]);});
  it("binds actual forecast creation to the rendered workspace",async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:"CHECK",message:"Stopped for test."}}),{status:422}));vi.stubGlobal("fetch",fetcher);const user=userEvent.setup();render(<WorkspaceRequestProvider workspaceId={a}><ForecastControls today="2026-11-12" run={null} canGenerate isSample={false}/></WorkspaceRequestProvider>);document.cookie=`rl-workspace=${b}`;await user.click(screen.getByRole("button",{name:"Generate forecast"}));expect(await screen.findByRole("alert")).toHaveTextContent("Stopped for test");expect(fetcher.mock.calls[0][1].headers["X-Workspace-Id"]).toBe(a);});
  it("pins saved-document exports without changing shared selection",async()=>{const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status:401}));vi.stubGlobal("fetch",fetcher);const user=userEvent.setup();render(<WorkspaceRequestProvider workspaceId={a}><DocumentActions orderId={b}/></WorkspaceRequestProvider>);await user.click(screen.getByRole("button",{name:"Export CSV"}));await screen.findByRole("alert");expect(fetcher.mock.calls[0][1].headers).toEqual({"X-Workspace-Id":a});});
});
