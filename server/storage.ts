import {
  members, opportunities, tracks, interests, reports,
  type Member, type InsertMember, type Opportunity, type InsertOpportunity,
  type Track, type InsertTrack, type InterestWithMember, type Report, type InsertReport,
  type ReportWithOpp, type TrackWithOpp, type Pulse,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { and, eq, desc } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_PATH = process.env.DATABASE_PATH || "data.db";
mkdirSync(dirname(resolve(DB_PATH)), { recursive: true });
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

// Create tables on startup if they don't exist, so no separate db:push step is needed on a host.
// Mirrors shared/schema.ts.
sqlite.exec(`
CREATE TABLE IF NOT EXISTS interests (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  member_id integer NOT NULL,
  opportunity_id integer NOT NULL,
  note text,
  created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  affiliation text,
  working_on text,
  can_help_with text,
  joined_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS members_email_unique ON members (email);
CREATE TABLE IF NOT EXISTS opportunities (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  title text NOT NULL,
  org text,
  kind text NOT NULL,
  lane text NOT NULL,
  source text NOT NULL,
  value text,
  is_paid integer DEFAULT false NOT NULL,
  location text NOT NULL,
  location_detail text,
  deadline text,
  deadline_note text,
  eligibility text,
  requirements text,
  why_it_matters text NOT NULL,
  details text,
  action_type text NOT NULL,
  action_url text,
  contact text,
  posted_by_id integer,
  posted_by_name text NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  created_at text NOT NULL,
  last_verified text,
  opens integer DEFAULT 0 NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  opportunity_id integer NOT NULL,
  member_id integer,
  reason text NOT NULL,
  note text,
  resolved integer DEFAULT false NOT NULL,
  created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS tracks (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  member_id integer NOT NULL,
  opportunity_id integer NOT NULL,
  status text NOT NULL,
  would_have_missed integer,
  updated_at text NOT NULL
);
`);

export const db = drizzle(sqlite);

const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

export function isActive(o: Opportunity) {
  return o.status === "live" && (!o.deadline || o.deadline >= today());
}

export interface IStorage {
  getMemberByEmail(email: string): Member | undefined;
  getMember(id: number): Member | undefined;
  createMember(m: InsertMember): Member;
  listOpportunities(opts: { status?: string }): Opportunity[];
  getOpportunity(id: number): Opportunity | undefined;
  createOpportunity(o: InsertOpportunity & { source: string; postedByName: string; status: string; lastVerified?: string | null }): Opportunity;
  updateOpportunity(id: number, patch: Partial<Opportunity>): Opportunity | undefined;
  countOpen(id: number): void;
  listTracks(memberId: number): TrackWithOpp[];
  upsertTrack(t: InsertTrack): Track;
  deleteTrack(memberId: number, opportunityId: number): void;
  listInterests(opportunityId: number): InterestWithMember[];
  addInterest(memberId: number, opportunityId: number, note?: string | null): void;
  memberInterestIds(memberId: number): number[];
  createReport(r: InsertReport): Report;
  listReports(): ReportWithOpp[];
  resolveReport(id: number): void;
  pulse(): Pulse;
}

export class DatabaseStorage implements IStorage {
  getMemberByEmail(email: string) {
    return db.select().from(members).where(eq(members.email, email.toLowerCase().trim())).get();
  }
  getMember(id: number) {
    return db.select().from(members).where(eq(members.id, id)).get();
  }
  createMember(m: InsertMember) {
    return db.insert(members).values({ ...m, joinedAt: now() }).returning().get();
  }
  listOpportunities({ status }: { status?: string }) {
    const q = db.select().from(opportunities);
    return (status ? q.where(eq(opportunities.status, status)) : q).orderBy(desc(opportunities.createdAt)).all();
  }
  getOpportunity(id: number) {
    return db.select().from(opportunities).where(eq(opportunities.id, id)).get();
  }
  createOpportunity(o: any) {
    return db.insert(opportunities).values({ ...o, createdAt: o.createdAt ?? now() }).returning().get();
  }
  updateOpportunity(id: number, patch: Partial<Opportunity>) {
    const { id: _i, ...rest } = patch as any;
    return db.update(opportunities).set(rest).where(eq(opportunities.id, id)).returning().get();
  }
  countOpen(id: number) {
    sqlite.prepare("UPDATE opportunities SET opens = opens + 1 WHERE id = ?").run(id);
  }
  listTracks(memberId: number) {
    const rows = db.select().from(tracks).where(eq(tracks.memberId, memberId)).orderBy(desc(tracks.updatedAt)).all();
    return rows
      .map((t) => ({ ...t, opportunity: this.getOpportunity(t.opportunityId)! }))
      .filter((t) => t.opportunity);
  }
  upsertTrack(t: InsertTrack) {
    const existing = db.select().from(tracks)
      .where(and(eq(tracks.memberId, t.memberId), eq(tracks.opportunityId, t.opportunityId))).get();
    if (existing) {
      return db.update(tracks).set({
        status: t.status,
        wouldHaveMissed: t.wouldHaveMissed === undefined ? existing.wouldHaveMissed : t.wouldHaveMissed,
        updatedAt: now(),
      }).where(eq(tracks.id, existing.id)).returning().get();
    }
    return db.insert(tracks).values({ ...t, wouldHaveMissed: t.wouldHaveMissed ?? null, updatedAt: now() }).returning().get();
  }
  deleteTrack(memberId: number, opportunityId: number) {
    db.delete(tracks).where(and(eq(tracks.memberId, memberId), eq(tracks.opportunityId, opportunityId))).run();
  }
  listInterests(opportunityId: number) {
    return sqlite.prepare(`SELECT i.id, i.member_id as memberId, i.opportunity_id as opportunityId, i.note, i.created_at as createdAt,
      m.name as memberName, m.email as memberEmail, m.affiliation as memberAffiliation
      FROM interests i JOIN members m ON m.id = i.member_id WHERE i.opportunity_id = ? ORDER BY i.created_at DESC`).all(opportunityId) as InterestWithMember[];
  }
  addInterest(memberId: number, opportunityId: number, note?: string | null) {
    const existing = db.select().from(interests)
      .where(and(eq(interests.memberId, memberId), eq(interests.opportunityId, opportunityId))).get();
    if (existing) {
      db.update(interests).set({ note: note ?? existing.note }).where(eq(interests.id, existing.id)).run();
      return;
    }
    db.insert(interests).values({ memberId, opportunityId, note: note ?? null, createdAt: now() }).run();
  }
  memberInterestIds(memberId: number) {
    return db.select().from(interests).where(eq(interests.memberId, memberId)).all().map((i) => i.opportunityId);
  }
  createReport(r: InsertReport) {
    return db.insert(reports).values({ ...r, memberId: r.memberId ?? null, note: r.note ?? null, createdAt: now() }).returning().get();
  }
  listReports() {
    return sqlite.prepare(`SELECT r.id, r.opportunity_id as opportunityId, r.member_id as memberId, r.reason, r.note, r.resolved, r.created_at as createdAt,
      o.title as opportunityTitle FROM reports r JOIN opportunities o ON o.id = r.opportunity_id WHERE r.resolved = 0 ORDER BY r.created_at DESC`).all()
      .map((r: any) => ({ ...r, resolved: !!r.resolved })) as ReportWithOpp[];
  }
  resolveReport(id: number) {
    db.update(reports).set({ resolved: true }).where(eq(reports.id, id)).run();
  }
  pulse(): Pulse {
    const all = this.listOpportunities({});
    const live = all.filter((o) => o.status === "live");
    const active = live.filter(isActive);
    const fields: (keyof Opportunity)[] = ["value", "eligibility", "whyItMatters", "actionUrl", "locationDetail"];
    const complete = active.length
      ? Math.round((active.reduce((s, o) => s + fields.filter((f) => o[f] || (f === "actionUrl" && o.contact)).length / fields.length + (o.deadline || o.deadlineNote ? 1 : 0), 0) / (active.length * 2)) * 100)
      : 0;
    const t = db.select().from(tracks).all();
    const byLane: Record<string, number> = {};
    active.forEach((o) => (byLane[o.lane] = (byLane[o.lane] ?? 0) + 1));
    const answered = t.filter((x) => x.wouldHaveMissed !== null);
    return {
      members: db.select().from(members).all().length,
      liveOpportunities: live.length,
      activeOpportunities: active.length,
      pendingReview: all.filter((o) => o.status === "pending").length,
      completeness: complete,
      peerSubmitted: all.filter((o) => o.postedById !== null && o.postedById !== undefined).length,
      saves: t.length,
      actions: t.filter((x) => ["applied", "contacted", "completed"].includes(x.status)).length,
      completed: t.filter((x) => x.status === "completed").length,
      interests: db.select().from(interests).all().length,
      opens: all.reduce((s, o) => s + o.opens, 0),
      wouldHaveMissedYes: answered.filter((x) => x.wouldHaveMissed).length,
      wouldHaveMissedAnswered: answered.length,
      openReports: this.listReports().length,
      byLane,
    };
  }
}

export const storage = new DatabaseStorage();
