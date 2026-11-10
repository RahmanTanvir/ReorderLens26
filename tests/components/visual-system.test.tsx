// @vitest-environment jsdom

import "./setup";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/app-shell";
import { ComponentPreview } from "@/components/preview/component-preview";
import { InventoryPreview } from "@/components/preview/inventory-preview";
import { SidebarNav } from "@/components/layout/sidebar-nav";

vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt || "Brand symbol"} data-src={src} /> }));

describe("component examples", () => {
  it("keeps dialog and example labels valid in the error state", async () => {
    const user = userEvent.setup();
    render(<ComponentPreview />);
    await user.click(screen.getByRole("button", { name: "View components" }));
    const dialog = screen.getByRole("dialog", { name: "Graphite components" });
    await user.click(within(dialog).getByRole("button", { name: "Validate example" }));
    const report = await axe.run(dialog, { runOnly: { type: "rule", values: ["aria-prohibited-attr", "aria-dialog-name", "label"] } });
    expect(report.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("opens an accessible dialog, validates locally and restores focus after Escape", async () => {
    const user = userEvent.setup();
    render(<ComponentPreview />);
    const trigger = screen.getByRole("button", { name: "View components" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Graphite components" });
    expect(dialog).toHaveAccessibleDescription(/nothing is saved/i);
    await user.click(within(dialog).getByRole("button", { name: "Validate example" }));
    const input = within(dialog).getByLabelText("Workspace name (example)");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter at least two characters");
    await user.type(input, "Example store");
    await user.click(within(dialog).getByRole("button", { name: "Validate example" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent("Nothing was saved");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("changes the example status style and resets the examples", async () => {
    const user = userEvent.setup();
    render(<ComponentPreview />);
    await user.click(screen.getByRole("button", { name: "View components" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Status style (example)"), "critical");
    const styles = within(dialog).getByLabelText("Illustrative status styles");
    expect(within(styles).getByText("At risk")).toBeInTheDocument();
    expect(within(styles).queryByText("Healthy")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Workspace name (example)"), "Test");
    await user.click(within(dialog).getByRole("button", { name: "Reset example" }));
    expect(within(dialog).getByLabelText("Workspace name (example)")).toHaveValue("");
    expect(within(styles).getByText("Healthy")).toBeInTheDocument();
  });
});

describe("shell access and navigation", () => {
  it("does not link to unavailable product routes", () => {
    render(<SidebarNav activePath="/app/inventory" previewHref="/" />);
    const active = screen.getByRole("link", { name: "Inventory" });
    expect(active).toHaveAttribute("href", "/");
    expect(active).toHaveAttribute("aria-current", "page");
    const future = screen.getByRole("link", { name: "Forecasts" });
    expect(future).toHaveAttribute("aria-disabled", "true");
    expect(future).not.toHaveAttribute("href");
  });

  it("keeps the mobile sheet closed initially, closes with Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<AppShell activePath="/app/inventory" previewHref="/"><InventoryPreview /></AppShell>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Main navigation" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole("button", { name: "Ask ReorderLens (unavailable)" })).toBeDisabled();
  });

  it("presents empty data honestly and disables data actions with an explanation", () => {
    render(<InventoryPreview />);
    expect(screen.getByText("Visual preview")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your inventory starts here" })).toBeInTheDocument();
    const action = screen.getByRole("button", { name: "Import Data" });
    expect(action).toBeDisabled();
    expect(action).toHaveAccessibleDescription(/no workspace is connected/i);
    expect(screen.getByRole("textbox", { name: "Search inventory" })).toBeDisabled();
    expect(screen.getAllByLabelText("Not available")).toHaveLength(4);
    expect(screen.queryByText(/Northgate|48,750|50,000/)).not.toBeInTheDocument();
  });
});
