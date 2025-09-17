import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";
import { ROLES } from "./schema";

// Returns latest webhook logs from auditLogs where action === "WEBHOOK_LOG"
export const getWebhookLogs = query({
  args: {
    limit: v.optional(v.number()),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      return [];
    }

    const all = await ctx.db.query("auditLogs").withIndex("timestamp", (q) => q.gt("timestamp", 0)).collect();
    const logs = all
      .filter((l) => l.action === "WEBHOOK_LOG")
      .sort((a, b) => b.timestamp - a.timestamp);

    const limit = args.limit ?? 100;
    return logs.slice(0, limit);
  },
});
