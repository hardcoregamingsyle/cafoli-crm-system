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

    // Use indexed, descending pagination and stop early when we've collected enough
    const desired = Math.max(1, Math.min(args.limit ?? 100, 500)); // clamp 1..500
    const pageSize = 200; // small page to keep reads low
    const maxPages = 100; // hard cap to stay below read limits
    let pagesScanned = 0;
    let cursor: string | null = null;
    const results: Array<any> = [];

    while (pagesScanned < maxPages && results.length < desired) {
      const page = await ctx.db
        .query("auditLogs")
        .withIndex("timestamp", (q) => q.gt("timestamp", 0))
        .order("desc")
        .paginate({ numItems: pageSize, cursor });

      for (const doc of page.page) {
        if (doc.action === "WEBHOOK_LOG") {
          results.push(doc);
          if (results.length >= desired) break;
        }
      }

      if (results.length >= desired || page.isDone) break;

      cursor = page.continueCursor;
      pagesScanned += 1;
    }

    return results.slice(0, desired);
  },
});