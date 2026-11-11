import type { Workspace, WorkspaceRole } from "@/lib/auth/contracts";

// Checked P2/P3 query contract, not a complete generated database schema.
// Reconcile with CLI-generated hosted types before the production release gate.
type ReadTable<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };
export type Profile = { user_id: string; display_name: string; updated_at: string };
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type ImportJob = { id:string;org_id:string;created_by:string;status:"uploaded"|"validated"|"committed"|"failed";storage_prefix:string;file_manifest:Json;column_mapping:Json;validation_report:Json;created_at:string;validated_at:string|null;committed_at:string|null };
export type Database = {
  public: {
    Tables: {
      organizations: ReadTable<Workspace>;
      organization_members: ReadTable<{ org_id: string; user_id: string; role: WorkspaceRole; created_at: string }>;
      profiles: { Row: Profile; Insert: never; Update: { display_name?: string }; Relationships: [] };
      import_jobs: ReadTable<ImportJob>;
      suppliers: ReadTable<{id:string;org_id:string;name:string;lead_time_days:number}>;
      products: ReadTable<{id:string;org_id:string;sku:string;name:string;purchase_cost:number;lead_time_days_override:number|null;pack_multiple:number;supplier_id:string}>;
      inventory_snapshots: ReadTable<{id:string;org_id:string;product_id:string;as_of_date:string;on_hand:number}>;
    };
    Views: Record<string, never>;
    Functions: {
      create_workspace: { Args: { p_name: string; p_location: string; p_is_sample?: boolean }; Returns: string };
      update_workspace_settings: { Args: { p_org_id: string; p_name: string; p_location: string }; Returns: Workspace[] };
      create_sample_workspace: { Args: Record<string,never>; Returns:string };
      begin_import: { Args:{p_org_id:string;p_job_id:string;p_manifest:Json}; Returns:string };
      validate_import: { Args:{p_org_id:string;p_job_id:string;p_mapping:Json;p_data:Json;p_report:Json}; Returns:Json };
      commit_import: { Args:{p_org_id:string;p_job_id:string;p_data:Json;p_confirm_upserts:boolean;p_validation_token:string}; Returns:Json };
      read_inventory: {Args:{p_org_id:string;p_q?:string;p_status?:string;p_supplier_id?:string;p_sort?:string;p_limit?:number;p_after?:Json;p_revision?:string};Returns:Json};
      read_product: {Args:{p_org_id:string;p_product_id:string};Returns:Json};
      read_inventory_budget: {Args:{p_org_id:string};Returns:Json};
      generate_forecast: {Args:{p_org_id:string;p_as_of_date:string;p_horizon_days:number};Returns:Json};
      list_forecast_runs: {Args:{p_org_id:string;p_limit?:number;p_before?:string};Returns:Json};
      read_forecast_run: {Args:{p_org_id:string;p_run_id:string;p_limit?:number;p_after?:string;p_product_id?:string};Returns:Json};
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
