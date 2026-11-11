// @vitest-environment jsdom
import "./setup";
import { render,screen,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach,describe,expect,it,vi } from "vitest";
import { ImportWizard,ValidationReport } from "@/components/imports/import-wizard";
import { fileKinds,suggestMappings,type ImportCounts,type ImportReport,type JobView } from "@/lib/imports/contracts";
import { requestJson,RequestError } from "@/lib/client/request";

vi.mock("@/lib/client/request",async original=>({...await original<typeof import("@/lib/client/request")>(),requestJson:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock("@/lib/imports/file-manifest",()=>({describeFile:vi.fn(async(kind)=>manifest.find(file=>file.kind===kind))}));
const manifest=fileKinds.map(kind=>({kind,filename:`${kind}.csv`,size:50,sha256:"0".repeat(64),headers:kind==="suppliers"?["name","lead_time_days"]:kind==="products"?["sku","name","supplier_name","purchase_cost"]:kind==="inventory_snapshots"?["sku","as_of_date","on_hand"]:["sku","sales_date","units_sold"]}));
const counts=Object.fromEntries(fileKinds.map(kind=>[kind,{inserted:1,updated:0}])) as ImportCounts;
const good:ImportReport={valid:true,rowCount:4,errorCount:0,errors:[],preview:[],counts,mappingVersion:1,validationToken:"20000000-0000-4000-8000-000000000003"};
const job:JobView={jobId:"20000000-0000-4000-8000-000000000001",status:"uploaded",files:manifest,columnMappings:suggestMappings(manifest),report:null,committedAt:null,createdAt:"2026-11-10T10:00:00Z"};
beforeEach(()=>{vi.mocked(requestJson).mockReset();});
describe("import interaction",()=>{
  it("requires all four files before uploading and keeps invalid input local",async()=>{
    const user=userEvent.setup();render(<ImportWizard canUpload canManageJob/>);
    const next=screen.getByRole("button",{name:"Continue to column mapping"});expect(next).toBeDisabled();
    await user.upload(screen.getByLabelText("Suppliers"),new File(["name,lead_time_days\nA,2"],"suppliers.csv",{type:"text/csv"}));expect(next).toBeDisabled();expect(requestJson).not.toHaveBeenCalled();
  });
  it("prepares one job and sends four bounded file transfers before mapping",async()=>{
    const user=userEvent.setup();render(<ImportWizard canUpload canManageJob/>);
    for(const [kind,label] of [["suppliers","Suppliers"],["products","Products"],["inventory_snapshots","Stock snapshots"],["sales_daily","Daily sales"]])await user.upload(screen.getByLabelText(label),new File(["header\nvalue"],`${kind}.csv`,{type:"text/csv"}));
    vi.mocked(requestJson).mockImplementation(async(url,_method,body)=>url==="/api/imports"?{jobId:(body as {jobId:string}).jobId,files:manifest,status:"uploaded"}:{kind:url.split("/").pop(),stored:true});
    await user.click(screen.getByRole("button",{name:"Continue to column mapping"}));
    expect(await screen.findByText("Review column mappings")).toBeInTheDocument();expect(requestJson).toHaveBeenCalledTimes(5);
    expect(vi.mocked(requestJson).mock.calls.filter(call=>call[0].includes("/files/")).every(call=>call[2] instanceof FormData)).toBe(true);
  });
  it("validates mapping before confirmation, blocks unchecked commit, and retries a lost response safely",async()=>{
    const user=userEvent.setup();render(<ImportWizard initialJob={job} canUpload canManageJob/>);
    vi.mocked(requestJson).mockResolvedValueOnce(good);
    await user.click(screen.getByRole("button",{name:"Validate files"}));
    expect(await screen.findByText(/4 rows passed validation/)).toBeInTheDocument();expect(requestJson).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button",{name:"Review and confirm"}));
    const confirm=screen.getByRole("button",{name:"Confirm import"});expect(confirm).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));vi.mocked(requestJson).mockRejectedValueOnce(new RequestError("Unable to connect","NETWORK_ERROR"));
    await user.click(confirm);expect(await screen.findByRole("alert")).toHaveTextContent(/Retrying the same job is safe/);expect(confirm).toBeEnabled();
    vi.mocked(requestJson).mockResolvedValueOnce({jobId:job.jobId,counts,committedAt:"2026-11-10T12:00:00Z",alreadyCommitted:true});
    await user.click(confirm);expect(await screen.findByText(/Import confirmed. The records are saved/)).toBeInTheDocument();
    expect(screen.getByRole("link",{name:"Review inventory"})).toHaveAttribute("href","/app/inventory");
    expect(vi.mocked(requestJson).mock.calls.filter(call=>call[0].endsWith("/commit"))).toHaveLength(2);
  });
  it("does not offer confirmation after invalid rows and preserves mapping review",async()=>{
    const user=userEvent.setup();render(<ImportWizard initialJob={job} canUpload canManageJob/>);
    vi.mocked(requestJson).mockResolvedValueOnce({...good,valid:false,errorCount:1,errors:[{kind:"products",row:7,field:"purchase_cost",code:"NEGATIVE_COST",message:"Use a nonnegative cost."}],counts:undefined});
    await user.click(screen.getByRole("button",{name:"Validate files"}));expect(await screen.findByText("NEGATIVE_COST")).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Review and confirm"})).not.toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"Edit mappings"}));expect(screen.getByLabelText("Purchase cost (BDT) *")).toHaveValue("purchase_cost");
    expect(requestJson).toHaveBeenCalledTimes(1);
  });
  it("shows precise update counts and requires explicit approval",async()=>{
    const user=userEvent.setup();const updated={...good,counts:{...counts,products:{inserted:0,updated:1}}};
    render(<ImportWizard initialJob={{...job,status:"validated",report:updated}} canUpload canManageJob/>);
    await user.click(screen.getByRole("button",{name:"Review and confirm"}));expect(screen.getByText(/Updating 1 existing records/)).toBeInTheDocument();expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button",{name:"Confirm import"})).toBeDisabled();expect(requestJson).not.toHaveBeenCalled();
  });
  it("keeps viewer/other-creator reports read-only",async()=>{
    render(<ImportWizard initialJob={{...job,status:"validated",report:good}} canUpload={false} canManageJob={false}/>);
    expect(screen.getByRole("button",{name:"Review and confirm"})).toBeDisabled();expect(screen.getByRole("button",{name:"Edit mappings"})).toBeDisabled();expect(requestJson).not.toHaveBeenCalled();
  });
  it("renders untrusted preview values as text",()=>{
    render(<ValidationReport report={{...good,preview:[{kind:"products",row:2,values:{name:'<img src=x onerror="alert(1)">'}}]}}/>);
    const region=screen.getByRole("region",{name:"Mapped CSV preview"});expect(within(region).getByText(/<img src=x/)).toBeInTheDocument();expect(region.querySelector("img")).toBeNull();
  });
});
