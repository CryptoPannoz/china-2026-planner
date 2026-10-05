"use client";

import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { Currency } from "@/lib/planner/types";

// Campi "a bozza": mentre scrivi il testo resta locale, e viene salvato una volta sola quando esci
// dal campo (o premi Invio). Così una sincronizzazione in arrivo non cancella ciò che stai scrivendo
// e il registro modifiche riceve una voce per modifica, non una per tasto.

type BaseInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "onBlur">;

export function TextInput({ value, onCommit, ...rest }: BaseInputProps & { value: string; onCommit: (next: string, previous: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input
    {...rest}
    value={draft ?? value}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={() => {
      if (draft !== null && draft !== value) onCommit(draft, value);
      setDraft(null);
    }}
    onKeyDown={(event) => {
      if (event.key === "Enter") event.currentTarget.blur();
    }}
  />;
}

export function TextArea({ value, onCommit, ...rest }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "defaultValue" | "onChange" | "onBlur"> & { value: string; onCommit: (next: string, previous: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <textarea
    {...rest}
    value={draft ?? value}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={() => {
      if (draft !== null && draft !== value) onCommit(draft, value);
      setDraft(null);
    }}
  />;
}

/** Numero modificabile liberamente (anche vuoto o con la virgola) e convalidato all'uscita. */
export function NumberInput({ value, onCommit, min = 0, ...rest }: Omit<BaseInputProps, "min"> & { value: number; min?: number; onCommit: (next: number, previous: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input
    {...rest}
    type="text"
    inputMode="decimal"
    value={draft ?? (Number.isFinite(value) ? String(value) : "")}
    onChange={(event) => setDraft(event.target.value)}
    onFocus={(event) => event.currentTarget.select()}
    onBlur={() => {
      if (draft !== null) {
        const parsed = draft.trim() === "" ? 0 : Number(draft.replace(",", "."));
        if (Number.isFinite(parsed)) {
          const next = Math.max(min, Math.round(parsed * 100) / 100);
          if (next !== value) onCommit(next, value);
        }
      }
      setDraft(null);
    }}
    onKeyDown={(event) => {
      if (event.key === "Enter") event.currentTarget.blur();
    }}
  />;
}

export function MoneyInput({ amount, currency, onAmount, onCurrency, label }: { amount: number; currency: Currency | undefined; onAmount: (next: number, previous: number) => void; onCurrency: (next: Currency) => void; label: string }) {
  return <span className="money-input">
    <NumberInput aria-label={label} value={amount} onCommit={onAmount} />
    <select aria-label={`Valuta · ${label}`} value={currency || "EUR"} onChange={(event) => onCurrency(event.target.value as Currency)}>
      <option value="EUR">€</option>
      <option value="CNY">¥</option>
    </select>
  </span>;
}
