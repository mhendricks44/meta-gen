import { Link } from "wouter";
import type { Opportunity } from "@shared/schema";
import { LANE_META, KIND_META, LOCATION_META, deadlineLabel, formatDate, urgency } from "@/lib/meta";
import { cn } from "@/lib/utils";

export function SourceTag({ source, className }: { source: string; className?: string }) {
  const label = source === "official" ? "Official source" : source === "peer" ? "Peer-created" : "Community-shared";
  return (
    <span className={cn("text-xs text-muted-foreground", className)} data-testid={`status-source-${source}`}>
      {label}
    </span>
  );
}

export function DeadlinePill({ o, className }: { o: Opportunity; className?: string }) {
  const u = urgency(o);
  return (
    <span
      className={cn(
        "text-xs tabular-nums whitespace-nowrap",
        u === "urgent" || u === "soon" ? "text-signal" : "text-muted-foreground",
        u === "closed" && "line-through",
        className,
      )}
      data-testid={`text-deadline-${o.id}`}
    >
      {deadlineLabel(o)}
    </span>
  );
}

export function LaneTag({ lane, className }: { lane: string; className?: string }) {
  return <span className={cn("text-xs text-muted-foreground", className)}>{LANE_META[lane]?.label}</span>;
}

/** Index row — the feed reads like a table of contents, not a wall of cards. */
export function OpportunityCard({
  o,
  saved,
  onToggleSave,
}: {
  o: Opportunity;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const dateText = o.deadline ? formatDate(o.deadline).replace(/, \d{4}$/, "") : "Rolling";
  return (
    <article
      className="group relative grid grid-cols-1 md:grid-cols-[7.5rem_1fr_15rem_2.5rem] gap-x-8 gap-y-1 border-t py-6 md:py-7"
      data-testid={`card-opportunity-${o.id}`}
    >
      <div className="flex md:flex-col gap-x-3 gap-y-1 text-xs text-muted-foreground order-1">
        <span className="text-foreground tabular-nums">{dateText}</span>
        <DeadlinePill o={o} />
      </div>

      <div className="order-2 min-w-0">
        <h3 className="font-serif text-[1.375rem] md:text-[1.5rem] leading-[1.2] tracking-[-0.01em]">
          <Link
            href={`/o/${o.id}`}
            className="after:absolute after:inset-0 focus-visible:outline-none decoration-1 underline-offset-4 group-hover:underline"
            data-testid={`link-opportunity-${o.id}`}
          >
            {o.title}
          </Link>
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {o.org}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-foreground/80 max-w-[60ch]">{o.whyItMatters}</p>
      </div>

      <div className="order-3 mt-3 md:mt-1 text-sm space-y-1.5">
        {o.value && (
          <p className="text-foreground line-clamp-2" data-testid={`text-value-${o.id}`}>{o.value}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {LANE_META[o.lane]?.label} · {LOCATION_META[o.location]} · {o.source === "official" ? "Official" : o.source === "peer" ? "Peer" : "Shared"}
        </p>
      </div>

      {onToggleSave && (
        <div className="order-4 md:text-right absolute right-0 top-6 md:static md:mt-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSave();
            }}
            className={cn(
              "relative z-10 text-xs underline-offset-4 hover:underline",
              saved ? "text-foreground font-medium" : "text-muted-foreground",
            )}
            aria-label={saved ? "Saved" : "Save"}
            aria-pressed={saved}
            data-testid={`button-save-${o.id}`}
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      )}
    </article>
  );
}
