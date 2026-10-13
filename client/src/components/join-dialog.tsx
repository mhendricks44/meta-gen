import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "@/lib/app-state";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Member } from "@shared/schema";

export function JoinDialog() {
  const { joinOpen, closeJoin, setMember, joinReason } = useApp();
  const [f, setF] = useState({ name: "", email: "" });
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      // Returning members just need their email; new members add a name.
      try {
        const res = await apiRequest("POST", "/api/members/signin", { email: f.email });
        return (await res.json()) as Member;
      } catch {
        if (f.name.trim().length < 2) throw new Error("Add your name to join.");
        const res = await apiRequest("POST", "/api/members", f);
        return (await res.json()) as Member;
      }
    },
    onSuccess: (member) => {
      setMember(member);
      queryClient.invalidateQueries();
      closeJoin();
      setError(null);
    },
    onError: (e: Error) => setError(e.message.replace(/^\d+:\s*/, "").replace(/^\{"message":"|"\}$/g, "")),
  });

  return (
    <Dialog open={joinOpen} onOpenChange={(o) => !o && closeJoin()}>
      <DialogContent className="sm:max-w-sm border-foreground/15 shadow-none p-8">
        <DialogHeader className="text-left">
          <DialogTitle className="font-serif text-2xl font-normal">Join</DialogTitle>
          <DialogDescription>{joinReason ?? "Just your name and email. Nothing else."}</DialogDescription>
        </DialogHeader>
        <form
          className="mt-2 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            m.mutate();
          }}
        >
          <Line label="Name" value={f.name} onChange={(v) => setF({ ...f, name: v })} testid="input-name" autoFocus />
          <Line label="Email" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} testid="input-email" required />
          {error && <p className="text-sm text-signal" data-testid="text-join-error">{error}</p>}
          <div className="flex items-baseline justify-between">
            <button
              type="submit"
              disabled={m.isPending}
              className="bg-foreground text-background rounded-full px-6 py-3 text-sm hover:bg-link hover:opacity-100 disabled:opacity-50"
              data-testid="button-join-submit"
            >
              {m.isPending ? "One sec…" : "Continue"}
            </button>
            <span className="text-xs text-muted-foreground">Been here before? Email is enough.</span>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, value, onChange, testid, ...p }: { label: string; value: string; onChange: (v: string) => void; testid: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        {...p}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent border-b border-foreground/30 py-2 text-[17px] focus:outline-none focus:border-foreground transition-colors"
        data-testid={testid}
      />
    </label>
  );
}
