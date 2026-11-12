// @vitest-environment jsdom
import "./setup";
import { render,screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe,expect,it,vi } from "vitest";
import WorkspaceError from "@/app/app/error";
import SetupError from "@/app/setup/error";
import ForecastError from "@/app/app/forecasts/error";
import PlanningError from "@/app/app/replenishment/error";
import ScenarioError from "@/app/app/scenarios/error";
import OrderError from "@/app/app/purchase-orders/error";
describe("Next request-time error recovery",()=>{
  it.each([WorkspaceError,SetupError,ForecastError,PlanningError,ScenarioError,OrderError])("re-fetches a failed segment instead of only clearing cached error state",async Component=>{const retry=vi.fn(),user=userEvent.setup();render(<Component retry={retry}/>);await user.click(screen.getByRole("button"));expect(retry).toHaveBeenCalledOnce();expect(screen.queryByText(/development upgrade/)).not.toBeInTheDocument();});
});
