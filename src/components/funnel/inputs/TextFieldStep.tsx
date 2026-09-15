"use client";

import { useState } from "react";
import { StepShell, SubmitArrow } from "./StepShell";
import { ConsentFooter } from "../ConsentFooter";

export function TextFieldStep({
  label,
  placeholder,
  type = "text",
  autoComplete,
  validate,
  onSubmit,
  showConsent,
}: {
  label: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  validate: (value: string) => string | null;
  onSubmit: (value: string) => void;
  showConsent?: boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Enter e toque no botão podem chegar praticamente juntos; sem trava o mesmo
  // passo era enviado duas vezes, gerando dois balões e dois PATCH.
  const [enviando, setEnviando] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const trimmed = value.trim();
    const validationError = validate(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setEnviando(true);
    onSubmit(trimmed);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <StepShell label={label} error={error}>
          <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 shadow-sm focus-within:border-waz-50">
            <input
              autoFocus
              type={type}
              inputMode={type === "email" ? "email" : undefined}
              enterKeyHint="send"
              autoComplete={autoComplete}
              autoCapitalize={type === "email" ? "none" : "words"}
              autoCorrect="off"
              spellCheck={false}
              disabled={enviando}
              placeholder={placeholder}
              aria-label={label}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full min-w-0 bg-transparent py-1 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
            />
            <SubmitArrow disabled={value.trim().length === 0 || enviando} />
          </div>
        </StepShell>
      </form>
      {showConsent && <ConsentFooter />}
    </div>
  );
}
