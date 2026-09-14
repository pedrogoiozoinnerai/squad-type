"use client";

import { useEffect, useRef, useState } from "react";
import { StepShell } from "./StepShell";

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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function choose(option: string) {
    setSelected(option);
    setOpen(false);
    onSubmit(option);
  }

  return (
    <StepShell label={label}>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-full border border-slate-300 bg-white px-4 py-3 text-left text-[15px] text-slate-900 shadow-sm focus:outline-none focus:border-waz-50"
        >
          <span className={selected ? "text-slate-900" : "text-slate-400"}>
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
          <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => choose(option)}
                className="w-full px-4 py-2.5 text-left text-[15px] text-slate-800 hover:bg-slate-100"
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
