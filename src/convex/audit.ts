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

    // We will accumulate exactly paginationOpts.numItems WEBHOOK_LOG entries by scanning
    // auditLogs via timestamp index in descending order, stopping early once enough are collected.
    const desired = Math.max(1, Math.min(args.paginationOpts.numItems, 50)); // hard cap per page
    let items: Array<any> = [];
    let cursor: string | null = args.paginationOpts.cursor ?? null;
    let isDone = false;

    // Scan up to a bounded number of pages per call to avoid read explosions
    const maxScannedPages = 8; // reduced from 20
    let scanned = 0;

    while (items.length < desired && scanned < maxScannedPages) {
      const page = await ctx.db
        .query("auditLogs")
        .withIndex("timestamp", (q) => q.gt("timestamp", 0))
        .order("desc")
        .paginate({ numItems: 50, cursor }); // reduced from 200

      // Collect only WEBHOOK_LOG entries
      for (const doc of page.page) {
        if (doc.action === "WEBHOOK_LOG") {
          items.push(doc);
          if (items.length >= desired) break;
        }
      }

      if (items.length >= desired) {
        cursor = page.continueCursor;
        isDone = page.isDone && items.length < desired;
        break;
      }

      if (page.isDone) {
        cursor = page.continueCursor;
        isDone = true;
        break;
      }

      cursor = page.continueCursor;
      scanned += 1;
    }

    return {
      items,
      isDone,
      continueCursor: cursor,
    };
  },
});