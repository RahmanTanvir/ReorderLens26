-- ReorderLens P2: initial schema, derived from the reviewed specification.
-- New application tables only; no destructive statements.
BEGIN;
-- gen_random_uuid() is built into the supported PostgreSQL version.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  location text not null default 'Dhaka, Bangladesh',
  currency_code char(3) not null default 'BDT' check (currency_code = 'BDT'),
  timezone text not null default 'Asia/Dhaka' check (timezone = 'Asia/Dhaka'),
  is_sample boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','operator','viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id, org_id);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 120),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 150),
  lead_time_days integer not null check (lead_time_days between 0 and 365),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id,id),
  unique (org_id,name)
);
create index suppliers_org_active_idx on public.suppliers(org_id, active);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null,
  sku text not null check (length(trim(sku)) between 1 and 60),
  name text not null check (length(trim(name)) between 1 and 200),
  purchase_cost numeric(14,2) not null check (purchase_cost >= 0),
  lead_time_days_override integer check (lead_time_days_override between 0 and 365),
  pack_multiple integer not null default 1 check (pack_multiple between 1 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id,id),
  unique (org_id,sku),
  foreign key (org_id,supplier_id) references public.suppliers(org_id,id)
);
create index products_org_supplier_idx on public.products(org_id,supplier_id);

create table public.inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  as_of_date date not null,
  on_hand integer not null check (on_hand >= 0),
  imported_at timestamptz not null default now(),
  unique (org_id,id),
  unique (org_id,product_id,as_of_date),
  foreign key (org_id,product_id) references public.products(org_id,id)
);
create index inventory_latest_idx on public.inventory_snapshots(org_id,product_id,as_of_date desc);

create table public.sales_daily (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  sales_date date not null,
  units_sold integer not null check (units_sold >= 0),
  availability_status text not null default 'unknown'
     check (availability_status in ('available','stockout','unknown')),
  promo_active boolean not null default false,
  imported_at timestamptz not null default now(),
  unique (org_id,id),
  unique (org_id,product_id,sales_date),
  foreign key (org_id,product_id) references public.products(org_id,id)
);
create index sales_org_product_date_idx on public.sales_daily(org_id,product_id,sales_date desc);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  status text not null default 'uploaded'
    check (status in ('uploaded','validated','committed','failed')),
  storage_prefix text not null,
  file_manifest jsonb not null default '[]'::jsonb,
  column_mapping jsonb not null default '{}'::jsonb,
  validation_report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  committed_at timestamptz,
  unique (org_id,id)
);
create index import_jobs_org_created_idx on public.import_jobs(org_id,created_at desc);

create table public.forecast_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  method text not null check (method in ('seasonal_baseline','sample_fixture','ml_v1')),
  status text not null default 'running' check (status in ('running','succeeded','failed')),
  as_of_date date not null,
  history_start date,
  history_end date,
  horizon_days integer not null check (horizon_days in (7,14,28)),
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (org_id,id)
);
create index forecast_runs_latest_idx on public.forecast_runs(org_id,status,created_at desc);

create table public.forecast_product_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null,
  product_id uuid not null,
  estimated_daily_units numeric(14,4),
  eligible_history_days integer not null default 0 check (eligible_history_days >= 0),
  availability_used boolean not null default false,
  quality text not null check (quality in ('sufficient','insufficient','unavailable')),
  limitation text,
  created_at timestamptz not null default now(),
  unique (org_id,id),
  unique (org_id,run_id,product_id),
  foreign key (org_id,run_id) references public.forecast_runs(org_id,id),
  foreign key (org_id,product_id) references public.products(org_id,id),
  check (estimated_daily_units is null or estimated_daily_units >= 0),
  check (quality <> 'sufficient' or estimated_daily_units is not null)
);
create index forecast_product_result_product_idx on public.forecast_product_results(org_id,product_id,created_at desc);

create table public.forecast_points (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  result_id uuid not null,
  forecast_date date not null,
  projected_units numeric(14,4) not null check (projected_units >= 0),
  unique (org_id,result_id,forecast_date),
  foreign key (org_id,result_id) references public.forecast_product_results(org_id,id)
);

create table public.replenishment_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  forecast_run_id uuid not null,
  status text not null default 'building'
    check (status in ('building','draft','converted','failed')),
  budget numeric(14,2) not null check (budget >= 0),
  review_period_days integer not null default 7 check (review_period_days between 1 and 30),
  safety_days integer not null default 2 check (safety_days between 0 and 30),
  revision integer not null default 0 check (revision >= 0),
  input_snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id,id),
  foreign key (org_id,forecast_run_id) references public.forecast_runs(org_id,id)
);
create index plans_org_created_idx on public.replenishment_plans(org_id,created_at desc);

create table public.plan_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null,
  product_id uuid not null,
  supplier_id uuid not null,
  suggested_qty integer not null check (suggested_qty >= 0),
  approved_qty integer not null check (approved_qty >= 0),
  purchase_cost_snapshot numeric(14,2) not null check (purchase_cost_snapshot >= 0),
  pack_multiple_snapshot integer not null check (pack_multiple_snapshot between 1 and 10000),
  on_hand_snapshot integer not null check (on_hand_snapshot >= 0),
  estimated_daily_snapshot numeric(14,4),
  lead_time_days_snapshot integer not null check (lead_time_days_snapshot between 0 and 365),
  risk_class text not null check (risk_class in ('at_risk','reorder_soon','healthy','unknown')),
  reason_codes text[] not null default array[]::text[],
  note text,
  unique (org_id,id),
  unique (org_id,plan_id,product_id),
  foreign key (org_id,plan_id) references public.replenishment_plans(org_id,id),
  foreign key (org_id,product_id) references public.products(org_id,id),
  foreign key (org_id,supplier_id) references public.suppliers(org_id,id),
  check (estimated_daily_snapshot is null or estimated_daily_snapshot >= 0),
  check (suggested_qty % pack_multiple_snapshot = 0 and approved_qty % pack_multiple_snapshot = 0)
);
create index plan_lines_org_plan_idx on public.plan_lines(org_id,plan_id);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null,
  supplier_id uuid not null,
  order_number text not null,
  status text not null default 'draft' check (status = 'draft'),
  total_cost numeric(14,2) not null check (total_cost >= 0),
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (org_id,id),
  unique (org_id,order_number),
  unique (org_id,plan_id,supplier_id),
  foreign key (org_id,plan_id) references public.replenishment_plans(org_id,id),
  foreign key (org_id,supplier_id) references public.suppliers(org_id,id)
);
create index purchase_orders_org_created_idx on public.purchase_orders(org_id,created_at desc);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null,
  product_id uuid not null,
  sku_snapshot text not null,
  product_name_snapshot text not null,
  qty integer not null check (qty > 0),
  purchase_cost_snapshot numeric(14,2) not null check (purchase_cost_snapshot >= 0),
  line_total numeric(14,2) generated always as (qty * purchase_cost_snapshot) stored,
  unique (org_id,id),
  unique (org_id,purchase_order_id,product_id),
  foreign key (org_id,purchase_order_id) references public.purchase_orders(org_id,id),
  foreign key (org_id,product_id) references public.products(org_id,id)
);
create index purchase_order_lines_order_idx on public.purchase_order_lines(org_id,purchase_order_id);

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  status text not null check (status in ('accepted','error','rate_limited')),
  tokens_in integer check (tokens_in is null or tokens_in >= 0),
  tokens_out integer check (tokens_out is null or tokens_out >= 0)
);
create index ai_usage_window_idx on public.ai_usage_events(org_id,user_id,created_at desc);
COMMIT;
