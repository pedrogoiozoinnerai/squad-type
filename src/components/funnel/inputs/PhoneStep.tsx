"use client";

import { useState } from "react";
import { formatBRPhone, onlyDigits } from "@/lib/phone-format";
import { StepShell, SubmitArrow } from "./StepShell";

export function PhoneStep({
  onSubmit,
}: {
  onSubmit: (phoneNumber: string) => void;
}) {
  const [display, setDisplay] = useState("");
  const [error, setError] = useState<string | null>(null);
  const digits = onlyDigits(display);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDisplay(formatBRPhone(e.target.value));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (digits.length < 10 || digits.length > 11) {
      setError("Informe um telefone válido com DDD");
      return;
    }
    setError(null);
    onSubmit(digits);
  }

  return (
    <form onSubmit={handleSubmit}>
      <StepShell label="WhatsApp" error={error}>
        <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 shadow-sm focus-within:border-waz-50">
          <span className="flex items-center gap-1.5 border-r border-slate-300 pr-3 text-sm text-slate-600">
            <span aria-hidden>🇧🇷</span>
            +55
          </span>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            className="shrink-0 text-waz-50"
            aria-hidden
          >
            <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.2-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.8-2-.2-.5-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.6.2-1.1.2-1.2-.1-.2-.3-.2-.6-.3z" />
            <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zm0 16.2a7.2 7.2 0 0 1-3.7-1l-.3-.2-2.7.7.7-2.6-.2-.3A7.2 7.2 0 1 1 12 19.2z" />
          </svg>
          <input
            autoFocus
            type="tel"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            value={display}
            onChange={handleChange}
            className="w-full bg-transparent py-1 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <SubmitArrow disabled={digits.length < 10} />
        </div>
      </StepShell>
    </form>
  );
}
