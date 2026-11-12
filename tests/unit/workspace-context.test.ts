import { beforeEach,describe,expect,it,vi } from "vitest";
const m=vi.hoisted(()=>({user:vi.fn(),from:vi.fn(),cookie:vi.fn(),header:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:m.user},from:m.from})}));
vi.mock("next/headers",()=>({cookies:async()=>({get:m.cookie}),headers:async()=>({get:m.header})}));
import { requireWorkspace } from "@/server/auth/context";
const a="a0000000-0000-4000-8000-000000000001",b="a0000000-0000-4000-8000-000000000002",foreign="a0000000-0000-4000-8000-000000000003";
beforeEach(()=>{vi.clearAllMocks();m.user.mockResolvedValue({data:{user:{id:a}},error:null});m.cookie.mockReturnValue({value:b});m.from.mockImplementation(table=>({select:()=>table==="organization_members"?{eq:async()=>({data:[{org_id:a,role:"owner"},{org_id:b,role:"viewer"}],error:null})}:{in:async()=>({data:[{id:a,name:"Workspace A"},{id:b,name:"Workspace B"}],error:null})}}));});
describe("verified workspace selector boundary",()=>{
  it("honors the rendered workspace header over a cookie changed by another tab",async()=>{const selected=await requireWorkspace({workspaceId:a,roles:["owner"]});expect(selected.workspace.id).toBe(a);expect(m.user).toHaveBeenCalledOnce();});
  it("rejects nonmember, invalid and unauthorized role selectors",async()=>{await expect(requireWorkspace({workspaceId:foreign})).rejects.toMatchObject({status:403,code:"WORKSPACE_DENIED"});await expect(requireWorkspace({workspaceId:"bad"})).rejects.toMatchObject({status:400});await expect(requireWorkspace({workspaceId:b,roles:["owner"]})).rejects.toMatchObject({status:403,code:"FORBIDDEN"});});
  it("requires verified user identity before consulting membership or selector",async()=>{m.user.mockResolvedValue({data:{user:null},error:{code:"invalid_jwt"}});await expect(requireWorkspace({workspaceId:a})).rejects.toMatchObject({status:401});expect(m.from).not.toHaveBeenCalled();});
});
