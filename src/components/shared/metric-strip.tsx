export function MetricStrip({ items }: { items: ReadonlyArray<{ label: string; value: string | null; description?: string }> }) {
  return (
    <dl className="grid grid-cols-2 gap-y-6 border-y py-6 sm:grid-cols-4">
      {items.map((item, index) => (
        <div key={item.label} className={`flex flex-col px-4 first:pl-0 sm:px-6 ${index % 2 ? "border-l" : ""} ${index === 2 ? "sm:border-l" : ""}`}>
          <dt className="mt-1 text-sm text-secondary-foreground">{item.label}</dt>
          <dd className="order-first text-[28px] leading-9 font-semibold tabular-nums" aria-label={item.value === null ? "Not available" : undefined}>{item.value ?? "—"}</dd>
          {item.description ? <dd className="mt-1 text-xs text-muted-foreground">{item.description}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
