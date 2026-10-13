import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import type { Opportunity, ReportWithOpp, Pulse } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeadlinePill, SourceTag, LaneTag } from "@/components/opportunity-card";
import { KIND_META, LANE_META, LOCATION_META, externalUrl, formatDate, isExpired, laneStyle } from "@/lib/meta";
import { useApp } from "@/lib/app-state";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Queue = { pending: Opportunity[]; reports: ReportWithOpp[]; live: Opportunity[] };

export default function Curate() {
  const { curatorCode, setCuratorCode } = useApp();
  if (!curatorCode) return <Gate onOk={setCuratorCode} />;
  return <Console code={curatorCode} />;
}

function Gate({ onOk }: { onOk: (c: string) => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/curator/check", undefined, { "x-curator-code": code }),
    onSuccess: () => onOk(code),
    onError: () => setErr("That code didn't work."),
  });
  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <h1 className="font-serif text-[2rem] sm:text-[2.5rem] leading-[1.08] tracking-[-0.02em]">Curator console</h1>
      <p className="text-muted-foreground mt-1 text-sm">Review submissions, handle reports, keep listings fresh, and watch the pilot metrics.</p>
      <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Input type="password" placeholder="Curator code" value={code} onChange={(e) => setCode(e.target.value)} data-testid="input-curator-code" aria-label="Curator code" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={m.isPending || !code} data-testid="button-curator-enter">Enter</Button>
      </form>
    </div>
  );
}

function Console({ code }: { code: string }) {
  const { toast } = useToast();
  const h = { "x-curator-code": code };
  const queue = useQuery<Queue>({
    queryKey: ["/api/curator/queue"],
    queryFn: async () => (await apiRequest("GET", "/api/curator/queue", undefined, h)).json(),
  });
  const pulse = useQuery<Pulse>({
    queryKey: ["/api/curator/pulse"],
    queryFn: async () => (await apiRequest("GET", "/api/curator/pulse", undefined, h)).json(),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/curator/queue"] });
    queryClient.invalidateQueries({ queryKey: ["/api/curator/pulse"] });
    queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
  };
  const patch = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/curator/opportunities/${id}`, body, h),
    onSuccess: (_d, v) => {
      refresh();
      const s = v.body.status;
      toast({ title: s === "live" ? "Approved — it's live." : s === "rejected" ? "Removed." : "Updated." });
    },
  });
  const resolve = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/curator/reports/${id}/resolve`, {}, h),
    onSuccess: refresh,
  });

  const q = queue.data;
  const stale = (q?.live ?? []).filter((o) => !isExpired(o) && (!o.lastVerified || daysSince(o.lastVerified) > 14));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <p className="text-sm text-muted-foreground">Curator</p>
      <h1 className="font-serif text-[2rem] sm:text-[2.5rem] leading-[1.08] tracking-[-0.02em] mt-3">Keep the bar high</h1>

      <Tabs defaultValue="review" className="mt-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="review" data-testid="tab-review">Review {q ? `(${q.pending.length})` : ""}</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">Reports {q ? `(${q.reports.length})` : ""}</TabsTrigger>
          <TabsTrigger value="live" data-testid="tab-live">Live {q ? `(${q.live.length})` : ""}</TabsTrigger>
          <TabsTrigger value="pulse" data-testid="tab-pulse">Pulse</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-6 space-y-4">
          {queue.isLoading ? <Skeleton className="h-40" /> : !q?.pending.length ? (
            <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center" data-testid="empty-review">Queue's clear.</p>
          ) : q.pending.map((o) => (
            <article key={o.id} className="rounded-lg border bg-card p-5" data-testid={`card-review-${o.id}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <LaneTag lane={o.lane} />
                <span>{KIND_META[o.kind]?.label}</span>·<SourceTag source={o.source} />·<span>by {o.postedByName}</span>
                <span className="ml-auto"><DeadlinePill o={o} /></span>
              </div>
              <h3 className="font-serif text-xl mt-2">{o.title}</h3>
              {o.org && <p className="text-sm text-muted-foreground">{o.org}</p>}
              <p className="text-sm mt-2">{o.whyItMatters}</p>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm">
                <Row k="Worth" v={o.value} /><Row k="Who" v={o.eligibility} />
                <Row k="Where" v={`${LOCATION_META[o.location]}${o.locationDetail ? ` · ${o.locationDetail}` : ""}`} />
                <Row k="Deadline" v={o.deadline ? formatDate(o.deadline) : "Rolling"} />
                <Row k="Needs" v={o.requirements} /><Row k="Contact" v={o.contact} />
              </dl>
              <Checklist o={o} />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => patch.mutate({ id: o.id, body: { status: "live" } })} data-testid={`button-approve-${o.id}`}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => patch.mutate({ id: o.id, body: { status: "rejected" } })} data-testid={`button-reject-${o.id}`}>Reject</Button>
                {externalUrl(o.actionUrl) && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={externalUrl(o.actionUrl)!} target="_blank" rel="noopener noreferrer">Check link <ArrowUpRight className="h-4 w-4" /></a>
                  </Button>
                )}
              </div>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          {!q?.reports.length ? (
            <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center" data-testid="empty-reports">No open reports.</p>
          ) : (
            <ul className="divide-y border rounded-lg bg-card">
              {q.reports.map((r) => (
                <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3" data-testid={`row-report-${r.id}`}>
                  <div className="flex-1 min-w-[200px]">
                    <Link href={`/o/${r.opportunityId}`} className="text-sm font-medium hover:underline">{r.opportunityTitle}</Link>
                    <p className="text-xs text-muted-foreground mt-0.5"><span className="tabular-nums">{r.reason}</span>{r.note ? ` — ${r.note}` : ""}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { patch.mutate({ id: r.opportunityId, body: { status: "rejected" } }); resolve.mutate(r.id); }} data-testid={`button-takedown-${r.id}`}>Take down</Button>
                  <Button size="sm" variant="ghost" onClick={() => resolve.mutate(r.id)} data-testid={`button-dismiss-${r.id}`}>Dismiss</Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="live" className="mt-6">
          {stale.length > 0 && (
            <p className="text-sm mb-3"><span className="font-semibold">{stale.length}</span> active listings haven't been checked in 14+ days.</p>
          )}
          <ul className="divide-y border rounded-lg bg-card">
            {(q?.live ?? []).map((o) => (
              <li key={o.id} className="px-4 py-3 flex flex-wrap items-center gap-3" data-testid={`row-live-${o.id}`}>
                <Link href={`/o/${o.id}`} className="flex-1 min-w-[200px] text-sm hover:underline truncate">{o.title}</Link>
                <span className="tabular-nums text-xs text-muted-foreground">{o.lastVerified ? `checked ${formatDate(o.lastVerified)}` : "unchecked"}</span>
                <DeadlinePill o={o} />
                <Button size="sm" variant="ghost" onClick={() => patch.mutate({ id: o.id, body: { lastVerified: new Date().toISOString().slice(0, 10) } })} data-testid={`button-verify-${o.id}`}>Mark checked</Button>
                <Button size="sm" variant="ghost" onClick={() => patch.mutate({ id: o.id, body: { status: "rejected" } })} data-testid={`button-remove-${o.id}`}>Remove</Button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="pulse" className="mt-6">
          {!pulse.data ? <Skeleton className="h-40" /> : <PulseView p={pulse.data} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PulseView({ p }: { p: Pulse }) {
  const missedPct = p.wouldHaveMissedAnswered ? Math.round((p.wouldHaveMissedYes / p.wouldHaveMissedAnswered) * 100) : null;
  const cards: [string, string, string][] = [
    ["Active opportunities", String(p.activeOpportunities), "Target: 50–100 before wider launch"],
    ["Complete fields", `${p.completeness}%`, "Value, who, deadline, link, location"],
    ["Members", String(p.members), "Target: 20–40 founding peers"],
    ["Saves", String(p.saves), "Tracked opportunities"],
    ["Real moves", String(p.actions), "Applied, contacted, or done"],
    ["Outcomes", String(p.completed), "Marked done / got it"],
    ["Peer submissions", String(p.peerSubmitted), `${p.pendingReview} waiting for review`],
    ["Hands raised", String(p.interests), "On peer posts"],
    ["Link opens", String(p.opens), "Clicks through to the source"],
    ["“I'd have missed it”", missedPct === null ? "—" : `${missedPct}%`, `${p.wouldHaveMissedYes} of ${p.wouldHaveMissedAnswered} answers`],
    ["Open reports", String(p.openReports), "Trust signal — resolve fast"],
    ["Moves per member", p.members ? (p.actions / p.members).toFixed(1) : "0", "The north star, this month"],
  ];
  return (
    <div>
      <p className="text-sm text-muted-foreground max-w-[65ch]">
        North star: <span className="text-foreground font-medium">meaningful next moves per active member per month.</span>{" "}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-border border rounded-lg overflow-hidden mt-5">
        {cards.map(([k, v, s]) => (
          <div key={k} className="bg-card p-4" data-testid={`pulse-${k.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="tabular-nums text-xl font-semibold mt-1 tabular-nums">{v}</p>
            <p className="text-xs text-muted-foreground mt-1">{s}</p>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-sm mt-8">Active by lane</h3>
      <div className="mt-3 space-y-2 max-w-lg">
        {Object.keys(LANE_META).map((l) => {
          const n = p.byLane[l] ?? 0;
          const max = Math.max(1, ...Object.values(p.byLane));
          return (
            <div key={l} className="flex items-center gap-3 text-sm" style={laneStyle(l)}>
              <span className="w-16 text-muted-foreground">{LANE_META[l].label}</span>
              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full lane-bg rounded-full" style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <span className="tabular-nums w-6 text-right">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Checklist({ o }: { o: Opportunity }) {
  const checks: [string, boolean][] = [
    ["Clear way in (link or contact)", !!(o.actionUrl || o.contact || o.actionType === "interest")],
    ["Says who it's for", !!o.eligibility],
    ["States the value", !!o.value],
    ["Has a date or is rolling", !!(o.deadline || o.deadlineNote)],
    ["Hidden costs called out", !!o.requirements],
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {checks.map(([l, ok]) => (
        <li key={l} className={ok ? "text-foreground" : "text-muted-foreground line-through"}>{ok ? "✓" : "✗"} {l}</li>
      ))}
    </ul>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return <div className="flex gap-2"><dt className="text-muted-foreground w-16 shrink-0">{k}</dt><dd>{v}</dd></div>;
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000);
}
