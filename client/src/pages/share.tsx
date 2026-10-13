import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useApp } from "@/lib/app-state";

const PAID = /\$|paid|stipend|grant|award|prize|funded|scholarship|salary|\/hr/i;

export default function Share() {
  const { member, openJoin } = useApp();
  const [f, setF] = useState({ title: "", link: "", value: "", who: "", deadline: "" });
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = useMutation({
    mutationFn: async () => {
      const text = [f.title, f.who, f.value].join(" ");
      const res = await apiRequest("POST", "/api/opportunities", {
        title: f.title,
        actionUrl: f.link || null,
        value: f.value || null,
        isPaid: PAID.test(f.value),
        eligibility: f.who || null,
        deadline: f.deadline || null,
        location: /chicago|chi-town|cps|csu/i.test(text) ? "chicago" : "elsewhere",
        postedById: member!.id,
      });
      return res.json();
    },
    onSuccess: () => {
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
    },
    onError: (e: Error) => setErr(e.message.replace(/^\d+:\s*/, "").replace(/^\{"message":"|"\}$/g, "")),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!member) return openJoin("Join so we know who shared it.");
    if (f.title.trim().length < 4) return setErr("Say what it is.");
    submit.mutate();
  }

  if (done) {
    return (
      <div className="mx-auto max-w-[50rem] px-5 pt-20">
        <h1 className="font-serif text-[2rem] leading-tight">Thank you.</h1>
        <p className="mt-4 text-muted-foreground">We'll check it and put it up, usually within a day.</p>
        <div className="mt-8 flex gap-6 text-sm">
          <button className="text-link underline underline-offset-4" onClick={() => { setF({ title: "", link: "", value: "", who: "", deadline: "" }); setDone(false); }} data-testid="button-share-another">
            Share another
          </button>
          <a href="#/" className="text-muted-foreground hover:text-foreground">Back to the list</a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[50rem] px-5 pt-14 sm:pt-20">
      <h1 className="font-serif text-[2.5rem] sm:text-[3.5rem] leading-[1]">Share an opportunity.</h1>
      <p className="mt-4 text-muted-foreground">Something you found, or something you're offering. We check everything before it goes up.</p>
      <form onSubmit={onSubmit} className="mt-10 space-y-7">
        <Field label="What is it" value={f.title} onChange={set("title")} placeholder="$5,000 grant for Chicago artists" testid="input-title" />
        <Field label="Link" value={f.link} onChange={set("link")} placeholder="Where people go to apply" testid="input-link" type="url" />
        <Field label="What it's worth" value={f.value} onChange={set("value")} placeholder="$5,000 · paid · free · a seat at the table" testid="input-value" />
        <Field label="Who it's for" value={f.who} onChange={set("who")} placeholder="Anyone 18–30 in Illinois" testid="input-who" />
        <Field label="Deadline" value={f.deadline} onChange={set("deadline")} testid="input-deadline" type="date" hint="Leave blank if there isn't one." />
        {err && <p className="text-sm text-signal" data-testid="text-error">{err}</p>}
        <button
          type="submit"
          disabled={submit.isPending}
          className="bg-foreground text-background rounded-full px-6 py-3 text-sm hover:bg-link hover:opacity-100 disabled:opacity-50 transition-opacity"
          data-testid="button-submit"
        >
          {submit.isPending ? "Sending…" : "Send it"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, hint, testid, ...p }: { label: string; hint?: string; testid: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        {...p}
        className="mt-1 w-full bg-transparent border-b border-foreground/30 py-2 text-[17px] placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground transition-colors"
        data-testid={testid}
      />
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
