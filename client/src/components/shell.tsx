import { Link, useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/lib/app-state";
import { JoinDialog } from "@/components/join-dialog";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-label="Meta-Gen" role="img" className={className}>
      <path d="M4 27V5l12 12L28 5v22" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { member, openJoin, theme, toggleTheme } = useApp();
  useEffect(() => {
    if (!loc.startsWith("/o/")) window.scrollTo({ top: 0 });
  }, [loc]);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="mx-auto max-w-[50rem] px-5 h-16 flex items-center gap-7 text-[15px]">
          <Link href="/" data-testid="link-home" className="flex items-center gap-2 mr-auto">
            <span className="text-[1.375rem] font-semibold tracking-[-0.06em] leading-none">Meta-Gen<span className="text-link">.</span></span>
          </Link>
          <Link href="/share" data-testid="button-post" className={loc === "/share" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}>
            Share
          </Link>
          {member ? (
            <span className="text-muted-foreground" data-testid="text-member">{member.name.split(" ")[0]}</span>
          ) : (
            <button onClick={() => openJoin()} className="text-muted-foreground hover:text-foreground" data-testid="button-join">Join</button>
          )}
          <button
            onClick={toggleTheme}
            aria-label="Switch light and dark"
            data-testid="button-theme"
            className="h-3.5 w-3.5 rounded-full border border-foreground/70 bg-[linear-gradient(90deg,hsl(var(--foreground))_50%,transparent_50%)] hover:scale-110 transition-transform"
          />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-24 w-full bg-[#d5e987] text-[#17241c]"><div className="mx-auto w-full max-w-[50rem] px-5 py-14 text-sm leading-relaxed">
        <p className="max-w-[46ch]">
          If someone with limited money and no connections can use it to make a real move, it belongs here. Always confirm details on the official site.
        </p>
        <p className="mt-6 flex items-baseline gap-2"><span className="font-semibold tracking-[-0.04em]">Meta-Gen</span> <span>a <span className="accent text-base !text-[#0069fd]">Net-Working</span> project · 2026</span></p>
      </div></footer>
      <JoinDialog />
    </div>
  );
}
