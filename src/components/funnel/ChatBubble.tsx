import { BotAvatar } from "./BotAvatar";

/** Horário do próprio balão. Conversas retomadas de antes desta mudança não têm
 * o carimbo salvo — nesse caso não inventamos um, simplesmente não mostramos. */
function Horario({ at }: { at?: number }) {
  if (!at) return null;
  return (
    <>
      {new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </>
  );
}

function DoubleCheck({ read }: { read?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 11"
      width="14"
      height="10"
      fill="none"
      aria-hidden
      className={read ? "text-[#34B7F1]" : "text-slate-400"}
    >
      <path
        d="M1 5.3 4 8.3 9.5 1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.3 5.3 8.3 8.3 15 1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BotBubble({ text, at }: { text: string; at?: number }) {
  return (
    <div className="flex items-start gap-3">
      <BotAvatar />
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[15px] leading-relaxed text-slate-800 shadow-sm">
        <div className="whitespace-pre-line break-words">{text}</div>
        {at && (
          <div className="mt-1 text-right text-[11px] text-slate-400">
            <Horario at={at} />
          </div>
        )}
      </div>
    </div>
  );
}

export function UserBubble({
  text,
  read,
  at,
}: {
  text: string;
  read?: boolean;
  at?: number;
}) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-waz-80 px-4 py-3 text-[15px] leading-relaxed text-slate-900 shadow-sm">
        {/* E-mails e nomes de empresa longos não têm espaço para quebrar: sem
            `break-words` eles esticavam o balão e vazavam para fora da tela. */}
        <div className="break-words">{text}</div>
        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-600/80">
          <span>
            <Horario at={at} />
          </span>
          <DoubleCheck read={read} />
        </div>
      </div>
    </div>
  );
}
