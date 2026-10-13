import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const KINDS = ["found", "need", "offer", "collaborate", "invite"] as const;
export const LANES = ["earn", "build", "fund", "learn", "create", "access", "gather"] as const;
export const SOURCES = ["official", "community", "peer"] as const;
export const LOCATIONS = ["chicago", "campus", "remote", "hybrid", "elsewhere"] as const;
export const ACTIONS = ["apply", "contact", "rsvp", "interest"] as const;
export const OPP_STATUS = ["pending", "live", "rejected", "filled"] as const;
export const TRACK_STATUS = ["saved", "applied", "contacted", "completed", "not_relevant"] as const;

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  affiliation: text("affiliation"),
  workingOn: text("working_on"),
  canHelpWith: text("can_help_with"),
  joinedAt: text("joined_at").notNull(),
});

export const opportunities = sqliteTable("opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  org: text("org"),
  kind: text("kind").notNull(),
  lane: text("lane").notNull(),
  source: text("source").notNull(),
  value: text("value"),
  isPaid: integer("is_paid", { mode: "boolean" }).notNull().default(false),
  location: text("location").notNull(),
  locationDetail: text("location_detail"),
  deadline: text("deadline"), // YYYY-MM-DD, null = rolling / open
  deadlineNote: text("deadline_note"),
  eligibility: text("eligibility"),
  requirements: text("requirements"),
  whyItMatters: text("why_it_matters").notNull(),
  details: text("details"),
  actionType: text("action_type").notNull(),
  actionUrl: text("action_url"),
  contact: text("contact"),
  postedById: integer("posted_by_id"),
  postedByName: text("posted_by_name").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  lastVerified: text("last_verified"),
  opens: integer("opens").notNull().default(0),
});

export const tracks = sqliteTable("tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id").notNull(),
  opportunityId: integer("opportunity_id").notNull(),
  status: text("status").notNull(),
  wouldHaveMissed: integer("would_have_missed", { mode: "boolean" }),
  updatedAt: text("updated_at").notNull(),
});

export const interests = sqliteTable("interests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id").notNull(),
  opportunityId: integer("opportunity_id").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  opportunityId: integer("opportunity_id").notNull(),
  memberId: integer("member_id"),
  reason: text("reason").notNull(),
  note: text("note"),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const insertMemberSchema = createInsertSchema(members).omit({ id: true, joinedAt: true }).extend({
  name: z.string().trim().min(2, "Add your name"),
  email: z.string().trim().toLowerCase().email("Use a real email"),
});

export const insertOpportunitySchema = createInsertSchema(opportunities)
  .omit({ id: true, status: true, createdAt: true, lastVerified: true, opens: true, source: true, postedByName: true })
  .extend({
    title: z.string().trim().min(4, "Say what it is"),
    kind: z.enum(KINDS).default("found"),
    lane: z.enum(LANES).default("access"),
    location: z.enum(LOCATIONS).default("elsewhere"),
    actionType: z.enum(ACTIONS).default("apply"),
    whyItMatters: z.string().trim().default(""),
    postedById: z.number(),
  });

export const insertTrackSchema = z.object({
  memberId: z.number(),
  opportunityId: z.number(),
  status: z.enum(TRACK_STATUS),
  wouldHaveMissed: z.boolean().nullable().optional(),
});

export const insertInterestSchema = z.object({
  memberId: z.number(),
  opportunityId: z.number(),
  note: z.string().max(400).optional().nullable(),
});

export const insertReportSchema = z.object({
  opportunityId: z.number(),
  memberId: z.number().nullable().optional(),
  reason: z.string().min(2),
  note: z.string().max(600).optional().nullable(),
});

export type Member = typeof members.$inferSelect;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Track = typeof tracks.$inferSelect;
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Interest = typeof interests.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export type InterestWithMember = Interest & { memberName: string; memberEmail: string; memberAffiliation: string | null };
export type ReportWithOpp = Report & { opportunityTitle: string };
export type TrackWithOpp = Track & { opportunity: Opportunity };

export type Pulse = {
  members: number;
  liveOpportunities: number;
  activeOpportunities: number;
  pendingReview: number;
  completeness: number; // 0-100
  peerSubmitted: number;
  saves: number;
  actions: number; // applied + contacted + completed
  completed: number;
  interests: number;
  opens: number;
  wouldHaveMissedYes: number;
  wouldHaveMissedAnswered: number;
  openReports: number;
  byLane: Record<string, number>;
};
