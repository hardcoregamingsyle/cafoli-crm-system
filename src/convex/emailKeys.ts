import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ROLES } from "./schema";
import { internal } from "./_generated/api";

// Upsert or create an email API key record
export const upsertEmailApiKey = internalMutation({
  args: {
    name: v.string(),
    apiKey: v.string(),
    dailyLimit: v.optional(v.number()), // default 295 if not provided
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const existing = await ctx.db
      .query("emailApiKeys")
      .withIndex("by_name", (q: any) => q.eq("name", name))
      .collect();
    const patch = {
      apiKey: args.apiKey,
      dailyLimit: args.dailyLimit ?? 295,
      active: args.active ?? true,
      // Initialize lastResetAt to start of today (ms) if not set on create
    } as any;

    if (existing[0]) {
      await ctx.db.patch(existing[0]._id, patch);
      return existing[0]._id;
    } else {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const id = await ctx.db.insert("emailApiKeys", {
        name,
        apiKey: args.apiKey,
        dailyLimit: args.dailyLimit ?? 295,
        sentToday: 0,
        lastResetAt: startOfToday.getTime(),
        active: args.active ?? true,
      } as any);
      return id;
    }
  },
});

// Pick any active key under its daily limit
export const getAvailableKey = internalQuery({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("emailApiKeys")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();
    // Prefer keys with most remaining quota to balance load
    const candidates = active
      .filter((k: any) => (k.sentToday ?? 0) < (k.dailyLimit ?? 295))
      .sort((a: any, b: any) => (b.dailyLimit - b.sentToday) - (a.dailyLimit - a.sentToday));
    return candidates[0] ?? null;
  },
});

export const incrementKeySent = internalMutation({
  args: { keyId: v.id("emailApiKeys"), by: v.optional(v.number()) },
  handler: async (ctx, { keyId, by }) => {
    const key = await ctx.db.get(keyId);
    if (!key) return;
    await ctx.db.patch(keyId, { sentToday: (key.sentToday ?? 0) + (by ?? 1) });
  },
});

export const resetDailyCounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("emailApiKeys").collect();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const ts = startOfToday.getTime();

    for (const k of all) {
      // Only reset if lastResetAt < today
      const last = (k as any).lastResetAt ?? 0;
      if (last < ts) {
        await ctx.db.patch(k._id, { sentToday: 0, lastResetAt: ts });
      }
    }
  },
});

// Queue operations
export const enqueueEmail = internalMutation({
  args: {
    to: v.string(),
    subject: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("emailQueue", {
      to: args.to,
      subject: args.subject,
      text: args.text,
      status: "queued",
      attempts: 0,
      lastError: undefined,
    } as any);
    return true;
  },
});

export const getQueuedBatch = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    // Simple status index selection
    const queued = await ctx.db
      .query("emailQueue")
      .withIndex("by_status", (q: any) => q.eq("status", "queued"))
      .collect();
    return queued.slice(0, limit);
  },
});

export const markSent = internalMutation({
  args: { id: v.id("emailQueue") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "sent", lastError: undefined });
  },
});

export const markFailed = internalMutation({
  args: { id: v.id("emailQueue"), error: v.string() },
  handler: async (ctx, { id, error }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return;
    await ctx.db.patch(id, { status: "queued", attempts: (doc.attempts ?? 0) + 1, lastError: error });
  },
});

// Public: List keys (Admin only) - hardened to never throw, just return []
export const listEmailApiKeys = query({
  // Accept either a proper Id("users") or a string (stale/invalid); handle safely
  args: { currentUserId: v.union(v.id("users"), v.string()) },
  handler: async (ctx, { currentUserId }) => {
    try {
      // Attempt to load the user; guard invalid formats
      const user = await ctx.db.get(currentUserId as any);
      const role = (user as any)?.role; // Cast to any to avoid TS union type issues
      if (!user || role !== ROLES.ADMIN) return [];

      const all = await ctx.db.query("emailApiKeys").collect();
      // Sort by name for stable UI
      return all.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    } catch {
      // On any error, return empty for stability
      return [];
    }
  },
});

// Public: Upsert key (Admin only) -> wraps internal upsert
export const saveEmailApiKey = mutation({
  args: {
    currentUserId: v.id("users"),
    name: v.string(),
    apiKey: v.string(),
    dailyLimit: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { currentUserId, name, apiKey, dailyLimit, active }) => {
    const user = await ctx.db.get(currentUserId);
    if (!user || user.role !== ROLES.ADMIN) throw new Error("Unauthorized");

    await ctx.runMutation(internal.emailKeys.upsertEmailApiKey, {
      name,
      apiKey,
      dailyLimit,
      active,
    });
    return true;
  },
});

// Public: Toggle active (Admin only)
export const setEmailKeyActive = mutation({
  args: { currentUserId: v.id("users"), id: v.id("emailApiKeys"), active: v.boolean() },
  handler: async (ctx, { currentUserId, id, active }) => {
    const user = await ctx.db.get(currentUserId);
    if (!user || user.role !== ROLES.ADMIN) throw new Error("Unauthorized");
    const key = await ctx.db.get(id);
    if (!key) throw new Error("Key not found");
    await ctx.db.patch(id, { active });
    return true;
  },
});

// Public: Reset sentToday (single key) (Admin only)
export const resetEmailKeyCount = mutation({
  args: { currentUserId: v.id("users"), id: v.id("emailApiKeys") },
  handler: async (ctx, { currentUserId, id }) => {
    const user = await ctx.db.get(currentUserId);
    if (!user || user.role !== ROLES.ADMIN) throw new Error("Unauthorized");
    const key = await ctx.db.get(id);
    if (!key) throw new Error("Key not found");
    // Set sentToday=0 and lastResetAt to start of today
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    await ctx.db.patch(id, { sentToday: 0, lastResetAt: d.getTime() });
    return true;
  },
});

// Public: Delete key (Admin only)
export const deleteEmailKey = mutation({
  args: { currentUserId: v.id("users"), id: v.id("emailApiKeys") },
  handler: async (ctx, { currentUserId, id }) => {
    const user = await ctx.db.get(currentUserId);
    if (!user || user.role !== ROLES.ADMIN) throw new Error("Unauthorized");
    const key = await ctx.db.get(id);
    if (!key) throw new Error("Key not found");
    await ctx.db.delete(id);
    return true;
  },
});