import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Mutation to update lead's lastActivityTime after SMS is sent
export const recordSmsSent = mutation({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.db.patch(args.leadId, {
        lastActivityTime: Date.now(),
      });
    } catch (e) {
      // Lead might not exist, ignore error
    }
  },
});
