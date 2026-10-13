import type React from "react";
import type { Opportunity } from "@shared/schema";

export const LANE_META: Record<string, { label: string; hint: string }> = {
  earn: { label: "Earn", hint: "Paid work, gigs, internships" },
  fund: { label: "Fund", hint: "Grants, scholarships, prizes" },
  build: { label: "Build", hint: "Startups, projects, hackathons" },
  learn: { label: "Learn", hint: "Research, fellowships, programs" },
  create: { label: "Create", hint: "Art, media, creative calls" },
  access: { label: "Access", hint: "Rooms, space, tools, intros" },
  gather: { label: "Gather", hint: "Meetups, dinners, sessions" },
};

export function laneStyle(lane: string) {
  return { ["--lane" as any]: `var(--lane-${lane})` } as React.CSSProperties;
}

export const KIND_META: Record<string, { label: string; verb: string }> = {
  found: { label: "Found", verb: "I found this" },
  need: { label: "Need", verb: "I need this" },
  offer: { label: "Offer", verb: "I'm offering this" },
  collaborate: { label: "Collaborate", verb: "I'm building this" },
  invite: { label: "Invite", verb: "Come to this" },
};

export const SOURCE_META: Record<string, { label: string; desc: string }> = {
  official: { label: "Official source", desc: "Linked to and checked against the organization's own page." },
  community: { label: "Community-shared", desc: "Shared by a member or found via a reputable listing. Confirm on the official page before applying." },
  peer: { label: "Peer-created", desc: "Posted by a Meta-Gen member about their own need, offer, or project." },
};

export const LOCATION_META: Record<string, string> = {
  chicago: "Chicago",
  campus: "On campus",
  remote: "Remote",
  hybrid: "Hybrid",
  elsewhere: "Elsewhere",
};

export const ACTION_META: Record<string, string> = {
  apply: "Apply",
  contact: "Contact",
  rsvp: "RSVP",
  interest: "I'm interested",
};

export const TRACK_META: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  contacted: "Contacted",
  completed: "Done / got it",
  not_relevant: "Not for me",
};

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function daysUntil(deadline: string | null) {
  if (!deadline) return null;
  const a = new Date(todayISO() + "T00:00:00");
  const b = new Date(deadline + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function isExpired(o: Opportunity) {
  const d = daysUntil(o.deadline);
  return d !== null && d < 0;
}

export function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function deadlineLabel(o: Opportunity) {
  const d = daysUntil(o.deadline);
  if (d === null) return "Rolling";
  if (d < 0) return "Closed";
  if (d === 0) return "Closes today";
  if (d === 1) return "Closes tomorrow";
  if (d <= 30) return `${d} days left`;
  return formatDate(o.deadline);
}

export function urgency(o: Opportunity): "urgent" | "soon" | "open" | "closed" {
  const d = daysUntil(o.deadline);
  if (d === null) return "open";
  if (d < 0) return "closed";
  if (d <= 7) return "urgent";
  if (d <= 21) return "soon";
  return "open";
}

export function externalUrl(url?: string | null) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
