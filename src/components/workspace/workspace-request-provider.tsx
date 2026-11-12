"use client";

import { createContext, useContext, type ReactNode } from "react";
import { requestJson } from "@/lib/client/request";

const WorkspaceRequestContext = createContext<string | undefined>(undefined);

export function WorkspaceRequestProvider({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  return <WorkspaceRequestContext.Provider value={workspaceId}>{children}</WorkspaceRequestContext.Provider>;
}

export function useWorkspaceId() { return useContext(WorkspaceRequestContext); }

// Capture the rendered workspace, not the cookie another browser tab can change.
// This header is an untrusted selector: server membership/RLS checks still apply.
export function useWorkspaceRequest(): typeof requestJson {
  const workspaceId = useWorkspaceId();
  return workspaceId ? (url, method, body, schema, options) => requestJson(url, method, body, schema, { ...options, workspaceId }) : requestJson;
}
