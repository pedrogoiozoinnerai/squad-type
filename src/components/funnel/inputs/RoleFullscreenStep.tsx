"use client";

import { ROLE_OPTIONS } from "@/lib/funnel";

export function RoleFullscreenStep({
  company,
  onSubmit,
}: {
  company?: string;
  onSubmit: (role: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-900">Qual é o seu cargo?</h2>
        {company && <p className="text-sm text-slate-500">na {company}</p>}
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-6">
        {ROLE_OPTIONS.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => onSubmit(role)}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left text-[15px] font-medium text-slate-800 shadow-sm transition hover:border-waz-50 hover:bg-slate-50"
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
              className="text-slate-500"
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
