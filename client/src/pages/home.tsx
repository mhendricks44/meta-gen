import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import type { Opportunity } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { daysUntil, isExpired, externalUrl, formatDate } from "@/lib/meta";
import { useTracks } from "@/lib/use-tracks";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function groupKey(o: Opportunity) {
  if (!o.deadline) return "Anytime";
  const d = new Date(o.deadline + "T00:00:00");
  const y = d.getFullYear();
  const now = new Date().getFullYear();
  return MONTHS[d.getMonth()] + (y !== now ? ` ${y}` : "");
}

function shortDate(o: Opportunity) {
  if (!o.deadline) return "";
  const d = new Date(o.deadline + "T00:00:00");
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

/** Open an external site. Works standalone and inside embedded previews that block new tabs. */
export function openExternal(e: React.MouseEvent, url: string, onOpen?: () => void) {
  e.preventDefault();
  e.stopPropagation();
  onOpen?.();
  const w = window.open(url, "_blank");
  if (w) { try { w.opener = null; } catch {} return; }
  try { (window.top ?? window).location.href = url; } catch { window.location.href = url; }
}

function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "the site"; }
}

export default function Home() {
  const [, params] = useRoute("/o/:id");
  const linked = params ? Number(params.id) : null;
  const { data, isLoading } = useQuery<Opportunity[]>({ queryKey: ["/api/opportunities"] });
  const { byOpp, toggleSave } = useTracks();
  const { member } = useApp();

  const [q, setQ] = useState("");
  const [paid, setPaid] = useState(false);
  const [chicago, setChicago] = useState(false);
  const [national, setNational] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [open, setOpen] = useState<number | null>(linked);

  useEffect(() => {
    if (linked == null || !data) return;
    setOpen(linked);
    requestAnimationFrame(() => document.getElementById(`o-${linked}`)?.scrollIntoView({ block: "center" }));
  }, [linked, data]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? [])
      .filter((o) => !isExpired(o) && o.status === "live")
      .filter((o) => !paid || o.isPaid)
      .filter((o) => {
        if (!chicago && !national) return true;
        const local = isLocal(o);
        return (chicago && local) || (national && !local);
      })
      .filter((o) => !savedOnly || byOpp.has(o.id))
      .filter((o) => {
        if (!needle) return true;
        const hay = [o.title, o.org, o.value, o.eligibility, o.whyItMatters, o.locationDetail].join(" ").toLowerCase();
        return needle.split(/\s+/).every((w) => hay.includes(w));
      })
      .sort((a, b) => (daysUntil(a.deadline) ?? 1e6) - (daysUntil(b.deadline) ?? 1e6));
  }, [data, q, paid, chicago, national, savedOnly, byOpp]);

  const groups = useMemo(() => {
    const m = new Map<string, Opportunity[]>();
    for (const o of list) {
      const k = groupKey(o);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(o);
    }
    return Array.from(m.entries());
  }, [list]);

  const total = (data ?? []).filter((o) => !isExpired(o) && o.status === "live").length;

  return (
    <div className="mx-auto max-w-[50rem] px-5">
      <section className="pt-14 sm:pt-20 pb-10">
        <h1 className="font-serif text-[2.75rem] sm:text-[4.25rem] leading-[1] tracking-[-0.06em]">
          Opportunities worth your time, <span className="accent">out in the open.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-[34ch]">
          Money, work, programs, and rooms worth being in. Picked by hand, checked by hand.
        </p>
      </section>

      <div className="sticky top-16 z-20 bg-background pt-2 pb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={isLoading ? "Search" : `Search ${total} opportunities`}
          className="w-full bg-transparent border-b border-foreground py-3 text-xl placeholder:text-muted-foreground/80 focus:outline-none focus:border-foreground"
          aria-label="Search"
          data-testid="input-search"
        />
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Chip on={paid} set={setPaid} id="paid">Paid</Chip>
          <Chip on={chicago} set={setChicago} id="chicago">Chicago</Chip>
          <Chip on={national} set={setNational} id="national">National</Chip>
          {member && byOpp.size > 0 && <Chip on={savedOnly} set={setSavedOnly} id="saved">Saved ({byOpp.size})</Chip>}
        </div>
      </div>

      {isLoading ? (
        <p className="py-16 text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <p className="py-16 text-muted-foreground" data-testid="empty-feed">
          Nothing here yet. <a href="#/share" className="text-link underline underline-offset-4">Share one</a>.
        </p>
      ) : (
        groups.map(([label, items]) => (
          <section key={label} className="mt-8">
            <h2 className="text-sm text-muted-foreground pb-3 border-b">{label}</h2>
            <ol>
              {items.map((o) => (
                <Row
                  key={o.id}
                  o={o}
                  open={open === o.id}
                  onToggle={() => setOpen(open === o.id ? null : o.id)}
                  saved={byOpp.has(o.id)}
                  onSave={() => toggleSave(o.id)}
                />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}

/** Local = Chicago area / campus / Illinois-wide; everything else (remote, nationwide, abroad) is National. */
function isLocal(o: Opportunity) {
  if (o.location === "chicago" || o.location === "campus") return true;
  return /chicago|illinois/i.test(o.locationDetail ?? "");
}

function Chip({ on, set, id, children }: { on: boolean; set: (v: boolean) => void; id: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => set(!on)}
      data-testid={`switch-${id}`}
      className={cn("pill", on ? "pill-on" : "pill-quiet text-muted-foreground")}
    >
      {children}
    </button>
  );
}

function Row({ o, open, onToggle, saved, onSave }: { o: Opportunity; open: boolean; onToggle: () => void; saved: boolean; onSave: () => void }) {
  const d = daysUntil(o.deadline);
  const soon = d !== null && d <= 14;
  const url = externalUrl(o.actionUrl);
  const { member, openJoin } = useApp();
  const [flagged, setFlagged] = useState(false);
  const track = () => { apiRequest("POST", `/api/opportunities/${o.id}/open`).catch(() => {}); };
  const [inIt, setInIt] = useState(false);
  const report = useMutation({
    mutationFn: () => apiRequest("POST", "/api/reports", { opportunityId: o.id, memberId: member?.id ?? null, reason: "flagged", note: null }),
    onSuccess: () => setFlagged(true),
  });
  const interest = useMutation({
    mutationFn: () => apiRequest("POST", "/api/interests", { memberId: member!.id, opportunityId: o.id, note: null }),
    onSuccess: () => setInIt(true),
  });

  return (
    <li id={`o-${o.id}`} className="border-b" data-testid={`card-opportunity-${o.id}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        aria-expanded={open}
        className="group cursor-pointer py-4 flex gap-4 items-baseline"
        data-testid={`row-${o.id}`}
      >
        <span className="min-w-0 flex-1">
          <span className="font-serif text-[1.375rem] sm:text-[1.75rem] leading-[1.15] group-hover:text-link transition-colors" data-testid={`link-opportunity-${o.id}`}>
            {o.title}
          </span>
          <span className="block mt-1 text-sm text-muted-foreground truncate" data-testid={`text-value-${o.id}`}>
            {o.value || o.org}
          </span>
        </span>
        <span className={cn("shrink-0 text-sm tabular-nums", soon ? "text-signal" : "text-muted-foreground")} data-testid={`text-deadline-${o.id}`}>
          {d === null ? "" : d === 0 ? "Today" : d === 1 ? "Tomorrow" : soon ? `${d} days` : shortDate(o)}
        </span>
      </div>

      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="pb-6 pr-2 text-[15px] leading-relaxed">
            {o.whyItMatters && <p>{o.whyItMatters}</p>}
            <dl className="mt-4 space-y-2 text-sm">
              {o.org && <Line k="From" v={o.org} />}
              {o.eligibility && <Line k="For" v={o.eligibility} />}
              {o.requirements && <Line k="Need" v={o.requirements} />}
              <Line k="Due" v={o.deadline ? formatDate(o.deadline) + (o.deadlineNote ? ` — ${o.deadlineNote}` : "") : o.deadlineNote || "Anytime"} />
              {o.locationDetail && <Line k="Where" v={o.locationDetail} />}
            </dl>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
              {o.actionType === "interest" ? (
                inIt ? (
                  <span>You're in. We'll be in touch.</span>
                ) : (
                  <button
                    className="text-link underline underline-offset-4 decoration-1 hover:decoration-2"
                    onClick={() => (member ? interest.mutate() : openJoin("Join so we know who you are."))}
                    data-testid={`button-interest-${o.id}`}
                  >
                    I'm in →
                  </button>
                )
              ) : url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => openExternal(e, url, track)}
                  className="text-link underline underline-offset-4 decoration-1 hover:decoration-2"
                  data-testid={`button-go-${o.id}`}
                >
                  Go to {host(url)} ↗
                </a>
              ) : o.contact ? (
                <span>{o.contact}</span>
              ) : null}
              <button onClick={onSave} className="text-muted-foreground hover:text-foreground" data-testid={`button-save-${o.id}`}>
                {saved ? "Saved" : "Save"}
              </button>
              <button
                onClick={() => !flagged && report.mutate()}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                data-testid={`button-report-${o.id}`}
              >
                {flagged ? "Thanks — we'll check it" : "Something off?"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-12 shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0">{v}</dd>
    </div>
  );
}
