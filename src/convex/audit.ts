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

    // Apply optional timestamp range to reduce scanned documents
    const page = await ctx.db
      .query("auditLogs")
      .withIndex("by_action_and_timestamp", (q) => {
        const base = q.eq("action", "WEBHOOK_LOG");
        const hasSince = typeof args.sinceTs === "number";
        const hasUntil = typeof args.untilTs === "number";
        if (hasSince && hasUntil) {
          return base.gte("timestamp", args.sinceTs!).lte("timestamp", args.untilTs!);
        }
        if (hasSince) {
          return base.gte("timestamp", args.sinceTs!);
        }
        if (hasUntil) {
          return base.lte("timestamp", args.untilTs!);
        }
        return base;
      })
      .order("desc")
      .paginate({ numItems: desired, cursor: args.paginationOpts.cursor ?? null });

    return {
      items: page.page,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});