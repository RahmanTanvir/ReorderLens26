// @vitest-environment jsdom
import "./setup";
import { render,screen,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach,describe,expect,it,vi } from "vitest";
import { ForecastWorkspace } from "@/components/forecasts/forecast-workspace";
import { ForecastControls } from "@/components/forecasts/forecast-controls";
import { RequestError } from "@/lib/client/request";
import { forecastQuerySchema } from "@/lib/forecast/contracts";
import { forecastDetail,forecastId,forecastRun } from "../fixtures/forecasts";
vi.mock("next/navigation",()=>({useRouter:()=>({push,refresh})}));vi.mock("@/lib/client/request",async original=>({...await original<typeof import("@/lib/client/request")>(),requestJson:vi.fn()}));
import { requestJson } from "@/lib/client/request";
const push=vi.fn(),refresh=vi.fn();beforeEach(()=>{push.mockReset();refresh.mockReset();vi.mocked(requestJson).mockReset();});
const props={today:"2026-11-10",isSample:false,canGenerate:true,runs:[forecastRun],runsCursor:null,detail:forecastDetail,query:forecastQuerySchema.parse({})};
describe("forecast workflows",()=>{
  it("shows real saved estimates/provenance without an uncertainty or accuracy claim",async()=>{
    const {container}=render(<ForecastWorkspace {...props}/>);expect(screen.getByText("Run complete")).toBeInTheDocument();expect(screen.getByLabelText("Saved runs")).toHaveValue(forecastId);expect(screen.getByRole("link",{name:"Review Replenishment"})).toHaveAttribute("href",`/app/replenishment?forecastRunId=${forecastId}`);expect(screen.getByRole("img",{name:/Saved observations/})).toBeInTheDocument();expect(screen.getByRole("link",{name:"View evidence for Fictional QA product"}).getAttribute("href")).toContain("productId=");
    const result=await axe.run(container,{runOnly:{type:"rule",values:["label","aria-prohibited-attr","aria-valid-attr-value","svg-img-alt"]}});expect(result.violations).toEqual([]);
  });
  it("generates chosen horizon and opens the persisted run",async()=>{
    vi.mocked(requestJson).mockResolvedValue({runId:forecastId,status:"succeeded",reused:false,errorCode:null});const user=userEvent.setup();render(<ForecastControls today="2026-11-10" run={null} canGenerate isSample={false}/>);await user.selectOptions(screen.getByLabelText("Forecast horizon"),"28");await user.click(screen.getByRole("button",{name:"Generate forecast"}));await waitFor(()=>expect(push).toHaveBeenCalledWith(`/app/forecasts?runId=${forecastId}`));expect(requestJson).toHaveBeenCalledWith("/api/forecasts/runs","POST",{asOfDate:"2026-11-10",horizonDays:28},expect.anything());expect(refresh).toHaveBeenCalled();
  });
  it("synchronizes the saved-run picker after navigation to a different horizon",()=>{
    const second={...forecastRun,id:"80000000-0000-4000-8000-000000000099",horizonDays:14 as const};
    const {rerender}=render(<ForecastWorkspace {...props} runs={[second,forecastRun]}/>);
    expect(screen.getByLabelText("Saved runs")).toHaveValue(forecastId);
    rerender(<ForecastWorkspace {...props} runs={[second,forecastRun]} detail={{...forecastDetail,run:second}}/>);
    expect(screen.getByLabelText("Saved runs")).toHaveValue(second.id);
    expect(screen.getByText(/14-day horizon · Cutoff/)).toBeInTheDocument();
  });
  it("prevents duplicate generation while pending, then reports failures without false completion",async()=>{
    let resolve!:(value:unknown)=>void;vi.mocked(requestJson).mockImplementation(()=>new Promise(done=>{resolve=done;}));const user=userEvent.setup();render(<ForecastControls today="2026-11-10" run={null} canGenerate isSample={false}/>);await user.click(screen.getByRole("button",{name:"Generate forecast"}));expect(screen.getByRole("button",{name:"Generating…"})).toBeDisabled();expect(requestJson).toHaveBeenCalledTimes(1);resolve({runId:forecastId,status:"failed",reused:false,errorCode:"BASELINE_FAILED"});await waitFor(()=>expect(screen.getByText(/This run failed/)).toBeInTheDocument());expect(screen.queryByText(/Run saved/)).not.toBeInTheDocument();
  });
  it("supports retry after interrupted responses and preserves selected inputs",async()=>{
    vi.mocked(requestJson).mockRejectedValue(new RequestError("Unable to connect.","NETWORK_ERROR"));const user=userEvent.setup();render(<ForecastControls today="2026-11-10" run={null} canGenerate isSample={false}/>);await user.selectOptions(screen.getByLabelText("Forecast horizon"),"14");await user.click(screen.getByRole("button",{name:"Generate forecast"}));expect(await screen.findByRole("alert")).toHaveTextContent(/retry the same inputs/);expect(screen.getByLabelText("Forecast horizon")).toHaveValue("14");expect(push).not.toHaveBeenCalled();expect(screen.getByRole("button",{name:"Generate forecast"})).toBeEnabled();
  });
  it("keeps viewers and samples read-only with explanations",()=>{render(<ForecastControls today="2026-11-10" run={null} canGenerate={false} isSample/>);expect(screen.getByRole("button",{name:"Generate forecast"})).toBeDisabled();expect(screen.getByText(/Sample workspace · Illustrative data/)).toBeInTheDocument();});
  it("separates completed insufficient runs from failures and zero demand",()=>{const item={...forecastDetail.items[0],quality:"insufficient" as const,dailyUnits:null,horizonTotal:null,reasonCodes:["INSUFFICIENT_HISTORY"],eligibleDays:9,observedDays:9};render(<ForecastWorkspace {...props} detail={{...forecastDetail,run:{...forecastRun,summary:{total:1,sufficient:0,insufficient:1}},items:[item],selected:{item,history:[],points:[]}}}/>);expect(screen.getByText("Run complete")).toBeInTheDocument();expect(screen.getByText(/Insufficient data is not zero demand/)).toBeInTheDocument();expect(screen.queryByRole("img")).not.toBeInTheDocument();});
  it("provides useful empty and stale states with real navigation",()=>{const {rerender}=render(<ForecastWorkspace {...props} runs={[]} detail={null}/>);expect(screen.getByText("No saved forecast runs")).toBeInTheDocument();expect(screen.getByRole("link",{name:"Review imported data"})).toHaveAttribute("href","/app/data");rerender(<ForecastWorkspace {...props} detail={{...forecastDetail,run:{...forecastRun,staleAt:"2026-11-10T13:00:00Z"}}}/>);expect(screen.getByText(/This saved run is stale/)).toBeInTheDocument();});
});
