import { PlugZap } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ScanControl } from "./scan-control";

export function EmptyLive({ configured }: { configured: boolean }) {
  return (
    <Card className="mx-auto mt-10 max-w-xl p-10 text-center">
      <PlugZap className="mx-auto text-accent" size={28} aria-hidden />
      <h2 className="mt-4 text-lg font-bold">No Contentstack scan yet</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        {configured
          ? "Run a read-only scan to load real content types, locales and entries. Nothing is shown until real data exists — no demo numbers are mixed in."
          : "Contentstack credentials are not configured. Add them to .env.local (see .env.example), or switch to the DEMO dataset from the stack menu."}
      </p>
      <div className="mt-5 flex justify-center">{configured ? <ScanControl /> : <Link className="text-xs font-bold text-accent underline" href="/settings">Open integration settings</Link>}</div>
    </Card>
  );
}
