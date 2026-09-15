"use client";

import { useRef } from "react";
import { ROLE_OPTIONS } from "@/lib/funnel";

export function RoleFullscreenStep({
  company,
  onSubmit,
}: {
  company?: string;
  onSubmit: (role: string) => void;
}) {
  const jaEscolheu = useRef(false);

  function escolher(role: string) {
    if (jaEscolheu.current) return;
    jaEscolheu.current = true;
    onSubmit(role);
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Cabeçalho na cor da marca: em tela cheia, um topo branco fazia parecer
          que o usuário tinha saído do atendimento e caído em outro site. */}
      <div
        className="bg-waz-40 px-6 pb-5 text-white"
        style={{ paddingTop: "calc(1.25rem + var(--safe-top))" }}
      >
        <h2 className="text-lg font-semibold">Qual é o seu cargo?</h2>
        {company && <p className="truncate text-sm text-white/80">na {company}</p>}
      </div>
      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-6 py-6"
        style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}
      >
        {ROLE_OPTIONS.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => escolher(role)}
            className="flex min-h-14 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left text-[15px] font-medium text-slate-800 shadow-sm transition hover:border-waz-50 hover:bg-slate-50 active:bg-slate-100"
          >
            {role}
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-slate-500"
              aria-hidden
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
