"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Sheet = Dialog.Root;

export function SheetContent({ className, children, title, description, eyebrow = "AI-assisted editorial review" }: { className?: string; children: React.ReactNode; title: string; description: string; eyebrow?: string }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="overlay fixed inset-0 z-40 bg-[rgba(9,25,37,.45)]" />
      <Dialog.Content className={cn("sheet-content fixed bottom-0 right-0 top-0 z-50 flex w-[min(640px,100vw)] flex-col bg-white shadow-[-20px_0_60px_#09223420]", className)}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <div className="eyebrow">{eyebrow}</div>
            <Dialog.Title className="mt-1.5 truncate text-[22px] font-bold tracking-tight">{title}</Dialog.Title>
            <Dialog.Description className="mt-1 text-xs leading-relaxed text-muted">{description}</Dialog.Description>
          </div>
          <Dialog.Close className="rounded-lg border border-line p-2 text-muted hover:bg-canvas" aria-label="Close review">
            <X size={16} />
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
