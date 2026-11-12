"use client";
import Link from "next/link";
import { createContext,useContext,useEffect,useRef,useState,type ReactNode } from "react";
import { Sparkles,Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Sheet,SheetContent,SheetTitle,SheetDescription } from "@/components/ui/sheet";
import { answerSchema,assistantContextSchema,routeContext,suggestions,type AssistantAnswer,type AssistantContext,type AssistantInput } from "@/lib/assistant/contracts";
import { requestJson,RequestError } from "@/lib/client/request";

type OpenInsight={context?:AssistantContext;message?:string};
const InsightContext=createContext<{open:(input?:OpenInsight)=>void}|null>(null);
export function InsightTrigger({context,message,label="Ask ReorderLens",className}:{context?:AssistantContext;message?:string;label?:string;className?:string}){
  const insight=useContext(InsightContext);
  return <Button type="button" variant="outline" className={className} disabled={!insight} aria-label={!insight&&label==="Ask ReorderLens"?"Ask ReorderLens (unavailable)":label} title={!insight?"Sign in to use read-only explanations.":undefined} onClick={()=>insight?.open({context,message})}><Sparkles className="size-4" aria-hidden="true"/><span>{label}</span></Button>;
}
export function InsightAnswer({answer,onChoice,onNavigate}:{answer:AssistantAnswer;onChoice?:(message:string,context:AssistantContext)=>void;onNavigate?:()=>void}){
  const hasEvidence=answer.evidence.length>0||answer.sources.length>0;
  return <article className="space-y-4 px-1 py-2">
    {answer.subject!=="ReorderLens Insight"?<p className="break-words text-xs text-muted-foreground">{answer.subject}{answer.isSample?" · Illustrative data":""}</p>:null}
    <div className="space-y-3">{answer.finding.split("\n\n").map((paragraph,index)=><p key={index} className="break-words text-sm leading-7">{paragraph}</p>)}</div>
    {answer.stale?<Alert>This uses older saved evidence. Check the dates before making a purchasing decision.</Alert>:null}
    {answer.choices.length?<div className="space-y-2">{answer.choices.map((choice,i)=><Button key={i} type="button" variant="outline" className="h-auto min-h-11 w-full justify-start whitespace-normal text-left" disabled={!onChoice} onClick={()=>onChoice?.(choice.message,choice.context)}>{choice.label}</Button>)}</div>:null}
    {answer.intent!=="help"?<Link className="inline-flex min-h-11 items-center rounded-sm text-sm text-primary underline" href={answer.nextStep.href} onClick={onNavigate}>{answer.nextStep.label}</Link>:null}
    {hasEvidence?<details className="rounded-lg border bg-card px-3">
      <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-secondary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">Show evidence and sources</summary>
      <div className="space-y-4 pb-4 pt-2">
        {answer.evidence.length?<dl className="space-y-3">{answer.evidence.map(f=><div key={f.id} className="text-xs leading-5"><dt className="text-muted-foreground">{f.label}</dt><dd className="mt-1 break-words font-medium tabular-nums">{f.value}</dd></div>)}</dl>:null}
        {answer.sources.length?<div className="border-t pt-3"><p className="text-xs font-medium">Saved sources</p><ul className="mt-1 space-y-1 text-xs">{answer.sources.map(s=><li key={s.id}><Link className="inline-flex min-h-11 items-center rounded-sm text-primary underline" href={s.href} onClick={onNavigate}>{s.label} · {s.asOf}</Link></li>)}</ul></div>:null}
        {answer.limitations.length?<div className="border-t pt-3"><p className="text-xs font-medium">What to keep in mind</p><ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-5 text-muted-foreground">{answer.limitations.map(text=><li key={text}>{text}</li>)}</ul></div>:null}
      </div>
    </details>:null}
    <p className="text-xs text-muted-foreground">{answer.provider.used?"Model-assisted wording · Values checked against saved records.":"Read-only · No external AI used."}</p>
  </article>;
}
type Exchange={question:string;answer:AssistantAnswer};
export function InsightProvider({children,workspaceId,isSample,path}:{children:ReactNode;workspaceId:string;isSample:boolean;path:string}){
  const [open,setOpen]=useState(false),[context,setContext]=useState<AssistantContext>(()=>routeContext(path)),[draft,setDraft]=useState(""),[exchanges,setExchanges]=useState<Exchange[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState<RequestError|null>(null),[notice,setNotice]=useState("");
  const current=useRef(context),scope=useRef(""),scopeRoute=useRef(""),controller=useRef<AbortController|null>(null),generation=useRef(0),running=useRef(false),opener=useRef<HTMLElement|null>(null),last=useRef<AssistantInput|null>(null),dialog=useRef<HTMLDivElement|null>(null),question=useRef<HTMLTextAreaElement|null>(null);
  function cancel(){generation.current++;controller.current?.abort();controller.current=null;running.current=false;setBusy(false);}
  function close(){cancel();setOpen(false);}
  useEffect(()=>{const abortPending=()=>{generation.current++;controller.current?.abort();};const reset=()=>{abortPending();running.current=false;setBusy(false);setOpen(false);setExchanges([]);setDraft("");setError(null);scope.current="";};window.addEventListener("popstate",reset);return()=>{window.removeEventListener("popstate",reset);abortPending();};},[]);
  async function ask(message:string,selected=current.current,retry=false){
    if(running.current||!message.trim()||message.trim().length>500)return;
    if(JSON.stringify(selected)!==scope.current){scope.current=JSON.stringify(selected);setExchanges([]);}
    current.current=selected;setContext(selected);setDraft(message);setError(null);setNotice("");running.current=true;setBusy(true);
    const input:AssistantInput=retry&&last.current?last.current:{requestId:crypto.randomUUID(),message:message.trim(),context:selected,history:exchanges.slice(-2).flatMap(e=>[{role:"user" as const,content:e.question},{role:"assistant" as const,content:e.answer.finding}])};last.current=input;
    const version=++generation.current,abort=new AbortController();controller.current=abort;
    try{const answer=await requestJson("/api/assistant","POST",input,answerSchema,{signal:abort.signal,workspaceId});if(version!==generation.current)return;setExchanges(old=>[...old.slice(-3),{question:input.message,answer}]);setDraft("");last.current=null;}
    catch(failure){if(version!==generation.current)return;setError(failure instanceof RequestError?failure:new RequestError("This explanation could not be loaded. Try again.","REQUEST_FAILED"));}
    finally{if(version===generation.current){running.current=false;setBusy(false);controller.current=null;}}
  }
  function show(input:OpenInsight={}){
    opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const routeKey=path+window.location.search,preserve=scopeRoute.current===routeKey&&Boolean(scope.current);
    const selected=input.context??(preserve?current.current:routeContext(path,window.location.search)),parsed=assistantContextSchema.safeParse(selected);if(!parsed.success)return;
    if(!preserve||scope.current!==JSON.stringify(parsed.data)){cancel();setExchanges([]);setError(null);setDraft("");last.current=null;scope.current=JSON.stringify(parsed.data);}
    scopeRoute.current=routeKey;
    current.current=parsed.data;setContext(parsed.data);setOpen(true);if(input.message)void ask(input.message,parsed.data);
  }
  return <InsightContext.Provider value={{open:show}}>{children}<Sheet open={open} onOpenChange={value=>{if(value)setOpen(true);else close();}}><SheetContent ref={dialog} className="flex h-dvh w-full max-w-none flex-col overflow-hidden bg-background md:w-[420px]" onOpenAutoFocus={event=>{event.preventDefault();if(running.current)dialog.current?.focus();else question.current?.focus();}} onCloseAutoFocus={event=>{event.preventDefault();if(opener.current?.isConnected)opener.current.focus();}}><div className="shrink-0 border-b px-5 py-5 pr-14"><SheetTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" aria-hidden="true"/>ReorderLens Insight</SheetTitle><SheetDescription className="mt-2 text-xs">Understand your inventory and purchasing decisions.</SheetDescription></div><div role="region" aria-label="Conversation" tabIndex={0} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" aria-busy={busy}>
    {isSample?<p className="text-xs text-primary">Sample workspace · Illustrative data</p>:null}{context.planId||context.productId||context.runId||context.orderId?<p className="text-xs text-muted-foreground">{context.orderId?"Looking at this saved draft":context.planId?"Using your saved plan":context.runId?"Using the selected forecast":"Looking at this product"}</p>:null}
    {!exchanges.length?<div className="space-y-3"><p className="text-sm leading-6 text-secondary-foreground">What would you like to understand? I can explain stock risks, forecasts and purchasing decisions.</p>{suggestions[context.screen].map(text=><Button key={text} type="button" variant="outline" disabled={busy} className="h-auto min-h-11 w-full justify-start whitespace-normal text-left" onClick={()=>void ask(text)}>{text}</Button>)}</div>:null}
    {exchanges.map((exchange,index)=><div key={index} className="space-y-3"><p className="ml-6 break-words rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm leading-6">{exchange.question}</p><InsightAnswer answer={exchange.answer} onChoice={busy?undefined:(message,selected)=>void ask(message,selected)} onNavigate={close}/></div>)}
    {busy?<div role="status" className="rounded-lg border bg-card p-4 text-sm">Looking into your saved records…</div>:null}{notice?<p role="status" className="text-xs text-muted-foreground">{notice}</p>:null}{error?<div className="space-y-3"><Alert tone="error">{error.message}</Alert><Button type="button" variant="outline" disabled={busy} onClick={()=>{if(last.current)void ask(last.current.message,last.current.context,true);}}>Retry question</Button></div>:null}</div>
    <form className="shrink-0 space-y-3 border-t bg-background p-4" onSubmit={event=>{event.preventDefault();void ask(draft);}}><label htmlFor="insight-question" className="text-xs font-medium">Your question</label><textarea ref={question} id="insight-question" maxLength={500} rows={3} value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy} className="mt-2 block w-full resize-none rounded-lg border bg-card p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Ask about your stock or purchasing plan…"/><div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{draft.length}/500 · Read-only</span>{busy?<Button type="button" variant="outline" onClick={()=>{cancel();setNotice("Question canceled. No business records changed.");}}>Cancel</Button>:<Button type="submit" disabled={!draft.trim()} aria-label="Ask question"><Send className="size-4" aria-hidden="true"/>Ask</Button>}</div></form></SheetContent></Sheet></InsightContext.Provider>;
}
