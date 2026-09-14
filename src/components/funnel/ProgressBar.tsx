import { STEP_ORDER } from "@/lib/funnel";
import { BotAvatar } from "./BotAvatar";

export function ProgressBar({ stepIndex }: { stepIndex: number }) {
  const total = STEP_ORDER.length;
  const pct = Math.min(100, Math.round((stepIndex / (total - 1)) * 100));
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "Squad.com";

  return (
    <header className="sticky top-0 z-10 bg-waz-40 text-white shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <BotAvatar size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">
            {brandName}
          </p>
          <p className="truncate text-xs text-white/80">
            Waz está te atendendo · passo {stepIndex + 1} de {total}
          </p>
        </div>
      </div>
      <div className="h-1 bg-black/15">
        <div
          className="h-full bg-white transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </header>
  );
}
