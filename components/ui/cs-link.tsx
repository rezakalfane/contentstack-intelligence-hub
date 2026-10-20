import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Opens the item in the Contentstack web app (new tab). Renders nothing when there is no link (demo mode). */
export function CsLink({ href, children, label, className, onClick }: { href: string | null | undefined; children?: React.ReactNode; label: string; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (opens Contentstack in a new tab)`}
      title={label}
      onClick={onClick}
      className={cn("inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline", className)}
    >
      {children}
      <ExternalLink size={12} aria-hidden />
    </a>
  );
}
