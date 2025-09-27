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
    const page = await ctx.db
      .query("auditLogs")
      .withIndex("by_action_and_timestamp", (q) => q.eq("action", "WEBHOOK_LOG"))
      .order("desc")
      .paginate({ numItems: desired, cursor: args.paginationOpts.cursor ?? null });

    return {
      items: page.page,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});