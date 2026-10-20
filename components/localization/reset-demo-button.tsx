"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/utils/api";

export function ResetDemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/demo/reset", "POST");
          router.replace("/overview");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <RotateCcw size={14} /> Reset demo
    </Button>
  );
}
