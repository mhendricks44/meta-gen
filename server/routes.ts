import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import { storage, isActive } from "./storage";
import {
  insertMemberSchema, insertOpportunitySchema, insertTrackSchema,
  insertInterestSchema, insertReportSchema,
} from "@shared/schema";
import { SEED, FOUNDER_POSTS } from "./seed";

const CURATOR_CODE = process.env.CURATOR_CODE || "metagen-curator";

function seedIfEmpty() {
  if (storage.listOpportunities({}).length > 0) return;
  const verified = "2026-09-23";
  [...FOUNDER_POSTS, ...SEED].forEach((s, i) => {
    storage.createOpportunity({
      ...s,
      postedById: null,
      postedByName: s.source === "peer" ? "Meta-Gen founder" : "Meta-Gen curator",
      status: "live",
      lastVerified: verified,
      createdAt: new Date(Date.parse("2026-09-23T12:00:00Z") - i * 60000).toISOString(),
    } as any);
  });
}

function curator(req: Request, res: Response, next: NextFunction) {
  if (req.header("x-curator-code") !== CURATOR_CODE) return res.status(401).json({ message: "Curator code required" });
  next();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  seedIfEmpty();

  // Members
  app.post("/api/members", (req, res) => {
    const parsed = insertMemberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });
    const existing = storage.getMemberByEmail(parsed.data.email);
    if (existing) return res.json(existing);
    res.json(storage.createMember(parsed.data));
  });
  app.post("/api/members/signin", (req, res) => {
    const m = storage.getMemberByEmail(String(req.body?.email ?? ""));
    if (!m) return res.status(404).json({ message: "No member with that email yet — join instead." });
    res.json(m);
  });

  // Opportunities (public feed = live only)
  app.get("/api/opportunities", (_req, res) => {
    res.json(storage.listOpportunities({ status: "live" }));
  });
  app.get("/api/opportunities/:id", (req, res) => {
    const o = storage.getOpportunity(Number(req.params.id));
    if (!o || o.status === "rejected") return res.status(404).json({ message: "Not found" });
    res.json(o);
  });
  app.post("/api/opportunities", (req, res) => {
    const parsed = insertOpportunitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });
    const member = storage.getMember(parsed.data.postedById);
    if (!member) return res.status(401).json({ message: "Join first to post" });
    const source = parsed.data.kind === "found" ? "community" : "peer";
    res.json(storage.createOpportunity({ ...parsed.data, source, postedByName: member.name, status: "pending" }));
  });
  app.post("/api/opportunities/:id/open", (req, res) => {
    storage.countOpen(Number(req.params.id));
    res.json({ ok: true });
  });
  app.get("/api/members/:id/posts", (req, res) => {
    const id = Number(req.params.id);
    res.json(storage.listOpportunities({}).filter((o) => o.postedById === id));
  });
  app.post("/api/opportunities/:id/filled", (req, res) => {
    const o = storage.getOpportunity(Number(req.params.id));
    if (!o || o.postedById !== Number(req.body?.memberId)) return res.status(403).json({ message: "Only the poster can close this" });
    res.json(storage.updateOpportunity(o.id, { status: "filled" }));
  });

  // Tracking
  app.get("/api/members/:id/tracks", (req, res) => res.json(storage.listTracks(Number(req.params.id))));
  app.post("/api/tracks", (req, res) => {
    const parsed = insertTrackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });
    res.json(storage.upsertTrack(parsed.data));
  });
  app.delete("/api/tracks/:memberId/:oppId", (req, res) => {
    storage.deleteTrack(Number(req.params.memberId), Number(req.params.oppId));
    res.json({ ok: true });
  });

  // Interest (peer posts)
  app.get("/api/members/:id/interests", (req, res) => res.json(storage.memberInterestIds(Number(req.params.id))));
  app.get("/api/opportunities/:id/interests", (req, res) => {
    const o = storage.getOpportunity(Number(req.params.id));
    const viewer = Number(req.query.memberId);
    const isCurator = req.header("x-curator-code") === CURATOR_CODE;
    if (!o) return res.status(404).json({ message: "Not found" });
    // Only the poster (or a curator, for founder posts) sees who is interested
    if (o.postedById !== viewer && !isCurator) return res.json({ count: storage.listInterests(o.id).length, people: [] });
    const people = storage.listInterests(o.id);
    res.json({ count: people.length, people });
  });
  app.post("/api/interests", (req, res) => {
    const parsed = insertInterestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });
    storage.addInterest(parsed.data.memberId, parsed.data.opportunityId, parsed.data.note);
    res.json({ ok: true });
  });

  // Reports
  app.post("/api/reports", (req, res) => {
    const parsed = insertReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });
    res.json(storage.createReport(parsed.data));
  });

  // Curator
  app.post("/api/curator/check", curator, (_req, res) => res.json({ ok: true }));
  app.get("/api/curator/queue", curator, (_req, res) => {
    res.json({
      pending: storage.listOpportunities({ status: "pending" }),
      reports: storage.listReports(),
      live: storage.listOpportunities({ status: "live" }),
    });
  });
  app.patch("/api/curator/opportunities/:id", curator, (req, res) => {
    const allowed = ["status", "lastVerified", "whyItMatters", "title", "deadline", "deadlineNote", "value", "eligibility"] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    if (patch.status === "live" && !("lastVerified" in patch)) patch.lastVerified = new Date().toISOString().slice(0, 10);
    const o = storage.updateOpportunity(Number(req.params.id), patch as any);
    if (!o) return res.status(404).json({ message: "Not found" });
    res.json(o);
  });
  app.post("/api/curator/reports/:id/resolve", curator, (req, res) => {
    storage.resolveReport(Number(req.params.id));
    res.json({ ok: true });
  });
  app.post("/api/curator/opportunities", curator, (req, res) => {
    // Curator can add official/community finds directly to the live feed
    const b = req.body ?? {};
    const parsed = insertOpportunitySchema.omit({ postedById: true }).safeParse(b);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });
    res.json(storage.createOpportunity({
      ...parsed.data, postedById: null, source: b.source === "official" ? "official" : "community",
      postedByName: "Meta-Gen curator", status: "live", lastVerified: new Date().toISOString().slice(0, 10),
    } as any));
  });
  app.get("/api/curator/pulse", curator, (_req, res) => res.json(storage.pulse()));

  // Public count helper for feed header
  app.get("/api/stats", (_req, res) => {
    const live = storage.listOpportunities({ status: "live" });
    res.json({ active: live.filter(isActive).length });
  });

  return httpServer;
}
