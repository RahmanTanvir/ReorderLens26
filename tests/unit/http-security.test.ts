import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
import { endpoint, readJson } from "../../src/server/http";

describe("protected request parsing and envelopes", () => {
  it("rejects cross-origin mutations before running an operation", async () => {
    const handler = vi.fn();
    const response = await endpoint(handler, true)(new NextRequest("http://localhost:3000/api/workspace", { method: "PATCH", headers: { origin: "https://evil.example" } }));
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it("returns safe errors with a request ID instead of raw exceptions", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await endpoint(async () => { throw new Error("private-db-detail"); })(new NextRequest("http://localhost:3000/api/workspace"));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.stringify(body)).not.toContain("private-db-detail");
    expect(response.headers.get("cache-control")).toContain("no-store");
    vi.restoreAllMocks();
  });
  it("rejects oversized bodies, invalid JSON and unknown fields", async () => {
    const request = (body: string) => new NextRequest("http://localhost:3000/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
    const schema = z.object({ name: z.string() }).strict();
    await expect(readJson(request('"' + "x".repeat(9000) + '"'), schema)).rejects.toMatchObject({ status: 413 });
    await expect(readJson(request("{"), schema)).rejects.toMatchObject({ status: 400, code: "INVALID_JSON" });
    await expect(readJson(request(JSON.stringify({ name: "Test", role: "owner" })), schema)).rejects.toMatchObject({ status: 400 });
    await expect(readJson(request(JSON.stringify({ name: "Test" })), schema)).resolves.toEqual({ name: "Test" });
  });
});
