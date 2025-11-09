import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";
import { ROLES } from "./schema";
import { paginationOptsValidator } from "convex/server";

// Returns latest webhook logs from auditLogs where action === "WEBHOOK_LOG"
export const getWebhookLogs = query({
  args: {
    paginationOpts: paginationOptsValidator, // { numItems, cursor }
    currentUserId: v.optional(v.id("users")),
    // New: Optional timestamp range to reduce scanned documents
    sinceTs: v.optional(v.number()),
    untilTs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      return { items: [], isDone: true, continueCursor: null as string | null };
    }

    // Use a selective index to fetch only WEBHOOK_LOG entries, ordered by newest first.
    const desired = Math.max(1, Math.min(args.paginationOpts.numItems, 50));

    // Fetch webhook logs and filter by timestamp in memory
    const page = await ctx.db
      .query("auditLogs")
      .withIndex("by_action", (q) => q.eq("action", "WEBHOOK_LOG"))
      .order("desc")
      .paginate({ numItems: desired, cursor: args.paginationOpts.cursor ?? null });

    // Apply timestamp filtering in memory if needed
    let filteredItems = page.page;
    if (args.sinceTs && args.untilTs) {
      filteredItems = filteredItems.filter(log => log.timestamp >= args.sinceTs! && log.timestamp <= args.untilTs!);
    } else if (args.sinceTs) {
      filteredItems = filteredItems.filter(log => log.timestamp >= args.sinceTs!);
    } else if (args.untilTs) {
      filteredItems = filteredItems.filter(log => log.timestamp <= args.untilTs!);
    }

    return {
      items: filteredItems,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const getAuditLogs = query({
  args: {
    action: v.optional(v.string()),
    sinceTs: v.optional(v.number()),
    untilTs: v.optional(v.number()),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      return [];
    }

    let logs;
    if (args.action) {
      logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_action", (q) => q.eq("action", args.action!))
        .collect();
    } else {
      logs = await ctx.db.query("auditLogs").collect();
    }

    // Filter by timestamp in memory since we can't use compound index
    if (args.sinceTs && args.untilTs) {
      logs = logs.filter(log => log.timestamp >= args.sinceTs! && log.timestamp <= args.untilTs!);
    } else if (args.sinceTs) {
      logs = logs.filter(log => log.timestamp >= args.sinceTs!);
    } else if (args.untilTs) {
      logs = logs.filter(log => log.timestamp <= args.untilTs!);
    }

    logs.sort((a, b) => b.timestamp - a.timestamp);
    return logs;
  },
});