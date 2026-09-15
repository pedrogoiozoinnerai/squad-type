"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StepShell } from "./StepShell";

const ALTURA_MAXIMA = 288;
const RESPIRO = 12;

export function SelectDropdown({
  label,
  placeholder,
  options,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  options: readonly string[];
  onSubmit: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // Para onde a lista abre e até onde ela pode crescer. O campo fica ancorado no
  // rodapé da tela, então abrir para baixo jogaria as opções fora do celular —
  // era o que acontecia: das 19 opções de segmento nenhuma aparecia.
  const [posicao, setPosicao] = useState<{ acima: boolean; altura: number }>({
    acima: true,
    altura: ALTURA_MAXIMA,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);

  const medir = useCallback(() => {
    const gatilho = gatilhoRef.current;
    if (!gatilho) return;
    const r = gatilho.getBoundingClientRect();
    const abaixo = window.innerHeight - r.bottom - RESPIRO;
    const acima = r.top - RESPIRO;
    const abrirAcima = acima > abaixo;
    setPosicao({
      acima: abrirAcima,
      altura: Math.max(140, Math.min(ALTURA_MAXIMA, abrirAcima ? acima : abaixo)),
    });
  }, []);

  useEffect(() => {
    function fechaClicandoFora(e: Event) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function fechaComEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", fechaClicandoFora);
    // No celular o toque precisa ser ouvido explicitamente: só `mousedown` deixava
    // a lista aberta atrás do dedo em parte dos navegadores móveis.
    document.addEventListener("touchstart", fechaClicandoFora);
    document.addEventListener("keydown", fechaComEsc);
    return () => {
      document.removeEventListener("mousedown", fechaClicandoFora);
      document.removeEventListener("touchstart", fechaClicandoFora);
      document.removeEventListener("keydown", fechaComEsc);
    };
  }, []);

  // O teclado virtual abrindo ou o aparelho girando mudam o espaço disponível
  // com a lista já aberta.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [open, medir]);

  function alterna() {
    if (!open) medir();
    setOpen((v) => !v);
  }

  function choose(option: string) {
    setSelected(option);
    setOpen(false);
    onSubmit(option);
  }

  return (
    <StepShell label={label}>
      <div ref={rootRef} className="relative">
        <button
          ref={gatilhoRef}
          type="button"
          onClick={alterna}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex min-h-12 w-full items-center justify-between gap-2 rounded-full border border-slate-300 bg-white px-4 py-3 text-left text-[15px] text-slate-900 shadow-sm focus:border-waz-50 focus:outline-none"
        >
          <span className={`truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>
            {selected ?? placeholder}
          </span>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div
            role="listbox"
            className={`absolute z-30 w-full overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white py-1 shadow-xl ${
              posicao.acima ? "bottom-full mb-2" : "top-full mt-2"
            }`}
            style={{ maxHeight: posicao.altura }}
          >
            {options.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected === option}
                onClick={() => choose(option)}
                className="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-[15px] text-slate-800 hover:bg-slate-100 active:bg-slate-100"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </StepShell>
  );
}
