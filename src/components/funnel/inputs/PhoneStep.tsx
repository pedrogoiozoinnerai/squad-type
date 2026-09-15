"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatBRPhone, onlyDigits } from "@/lib/phone-format";
import { StepShell, SubmitArrow } from "./StepShell";

/** Posição, no texto já formatado, logo após o n-ésimo dígito. */
function posicaoAposDigitos(texto: string, n: number): number {
  if (n <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] >= "0" && texto[i] <= "9") {
      vistos++;
      if (vistos === n) return i + 1;
    }
  }
  return texto.length;
}

export function PhoneStep({
  onSubmit,
}: {
  onSubmit: (phoneNumber: string) => void;
}) {
  const [display, setDisplay] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);
  // Onde o cursor deve parar depois que o React reescrever o valor formatado.
  const cursorRef = useRef<number | null>(null);
  const digits = onlyDigits(display);

  // A máscara reescreve o campo a cada tecla — e ao trocar "(11) 9876-5432" por
  // "(11) 98765-4321" o navegador joga o cursor para o fim. Quem estivesse
  // corrigindo um dígito no meio via os próximos caracteres irem parar no lugar
  // errado. Recolocamos o cursor contando dígitos, não caracteres.
  useLayoutEffect(() => {
    const alvo = cursorRef.current;
    if (alvo === null || !campoRef.current) return;
    cursorRef.current = null;
    campoRef.current.setSelectionRange(alvo, alvo);
  }, [display]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const bruto = e.target.value;
    const cursor = e.target.selectionStart ?? bruto.length;
    const digitosAntesDoCursor = onlyDigits(bruto.slice(0, cursor)).length;
    const formatado = formatBRPhone(bruto);
    cursorRef.current = posicaoAposDigitos(formatado, digitosAntesDoCursor);
    setDisplay(formatado);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (digits.length < 10 || digits.length > 11) {
      setError("Informe um telefone válido com DDD");
      return;
    }
    setError(null);
    setEnviando(true);
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
            ref={campoRef}
            autoFocus
            type="tel"
            inputMode="tel"
            enterKeyHint="send"
            maxLength={15}
            disabled={enviando}
            placeholder="(11) 99999-9999"
            aria-label="Número de WhatsApp com DDD"
            value={display}
            onChange={handleChange}
            className="w-full min-w-0 bg-transparent py-1 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
          />
          <SubmitArrow disabled={digits.length < 10 || enviando} />
        </div>
      </StepShell>
    </form>
  );
}
