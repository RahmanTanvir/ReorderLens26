// @vitest-environment jsdom
import "./setup";
import { render,screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect,it } from "vitest";
import { setNonce } from "get-nonce";
import { initializeStyleNonce } from "@/lib/client/style-nonce";
import { Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription } from "@/components/ui/dialog";

it("authorizes the actual dialog scroll-lock stylesheet with the document nonce",async()=>{
  const script=document.createElement("script");script.nonce="synthetic-document-nonce";document.head.append(script);initializeStyleNonce(document);
  try{const user=userEvent.setup();render(<Dialog><DialogTrigger>Open</DialogTrigger><DialogContent><DialogTitle>Test dialog</DialogTitle><DialogDescription>Keyboard and scroll-lock check.</DialogDescription></DialogContent></Dialog>);await user.click(screen.getByRole("button",{name:"Open"}));expect(await screen.findByRole("dialog")).toBeInTheDocument();expect([...document.head.querySelectorAll<HTMLStyleElement>("style[nonce]")].some(style=>style.nonce==="synthetic-document-nonce"&&style.textContent?.includes("overflow"))).toBe(true);await user.keyboard("{Escape}");expect(screen.queryByRole("dialog")).not.toBeInTheDocument();}
  finally{script.remove();setNonce("");}
});
