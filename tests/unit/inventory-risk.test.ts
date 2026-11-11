import { describe,expect,it } from "vitest";
import { classifyStock,formatBDT,fractionString } from "@/domain/inventory/risk";
describe("inventory risk",()=>{
  it("matches Oil and Milk evidence without rounding comparisons",()=>{
    expect(classifyStock(38,"7.0000","sufficient",6)).toEqual({code:"at_risk",coverDays:"5.4286",gapDays:"0.5714",noDemand:false});
    expect(classifyStock(24,"5.0000","sufficient",3).code).toBe("reorder_soon");
    expect(classifyStock(6,"1.0001","sufficient",6).code).toBe("at_risk");
  });
  it.each([[null,"7","sufficient",6],[38,null,"sufficient",6],[38,"7","insufficient",6],[38,"7","unavailable",6],[38,"7","sufficient",null]] as const)("keeps missing/insufficient inputs unknown %j",(h,d,q,l)=>expect(classifyStock(h,d,q,l).code).toBe("unknown"));
  it("handles zero demand, zero stock and both threshold equalities",()=>{
    expect(classifyStock(0,"0.0000","sufficient",0)).toMatchObject({code:"healthy",noDemand:true,coverDays:null});
    expect(classifyStock(0,"1","sufficient",0).code).toBe("at_risk");
    expect(classifyStock(6,"1","sufficient",6).code).toBe("reorder_soon");
    expect(classifyStock(13,"1","sufficient",6).code).toBe("reorder_soon");
    expect(classifyStock(14,"1","sufficient",6).code).toBe("healthy");
  });
  it("rounds positive ratios half-up and formats money without floating-point conversion",()=>{
    expect(fractionString(125n,100n,1)).toBe("1.3");expect(fractionString(124996n,100000n,1)).toBe("1.2");
    expect(formatBDT("999999999999.99")).toBe("৳999,999,999,999.99");expect(formatBDT("-1250.50")).toBe("−৳1,250.50");
  });
});
