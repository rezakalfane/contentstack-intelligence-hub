"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "./button";

export interface ConfirmRow {
  label: string;
  value: string;
  mono?: boolean;
}

/** Centered, focus-trapped confirmation modal (replaces window.confirm). */
export function ConfirmDialog({
  open, onOpenChange, title, description, rows, checks, confirmLabel, onConfirm, busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  rows: ConfirmRow[];
  checks?: string[];
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-[60] bg-[rgba(9,25,37,.55)] backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-white p-6 shadow-[0_30px_80px_rgba(9,25,37,.35)] outline-none">
          <div className="mb-1 flex items-center gap-2 text-accent"><ShieldCheck size={16} aria-hidden /><span className="eyebrow">Guarded write</span></div>
          <Dialog.Title className="text-lg font-bold tracking-tight">{title}</Dialog.Title>
          <Dialog.Description className="mt-1.5 text-xs leading-relaxed text-muted">{description}</Dialog.Description>
          <dl className="mt-4 divide-y divide-[#eef1f3] rounded-lg border border-line bg-[#fafcfb] text-xs">
            {rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[110px_1fr] gap-3 px-3.5 py-2.5">
                <dt className="text-[#8595a0]">{r.label}</dt>
                <dd className={`break-words font-semibold text-text ${r.mono ? "font-mono text-[11px]" : ""}`}>{r.value}</dd>
              </div>
            ))}
          </dl>
          {checks && (
            <ul className="mt-3 space-y-1 text-[11px] text-[#46606f]">
              {checks.map((c) => <li key={c} className="flex gap-2"><span className="text-accent" aria-hidden>✓</span>{c}</li>)}
            </ul>
          )}
          <div className="mt-6 flex justify-end gap-2.5">
            <Dialog.Close asChild><Button disabled={busy}>Cancel</Button></Dialog.Close>
            <Button variant="primary" onClick={onConfirm} disabled={busy}>
              {busy && <Loader2 size={14} className="animate-spin" />} {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
