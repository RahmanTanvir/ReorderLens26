import Image from "next/image";

export function Brand() {
  return (
    <span className="inline-flex items-center">
      <Image src="/branding/reorderlens-logo.png" alt="" width={52} height={48} className="h-12 w-[52px] shrink-0 object-contain" priority />
      <span className="text-[19px] font-bold tracking-[-0.035em]">ReorderLens</span>
    </span>
  );
}
