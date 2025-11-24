import { query } from "./_generated/server";
import { v } from "convex/values";

export const getLeadsWithMessages = query({
  args: {
    currentUserId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100; // Default to 100 leads for performance
    
    // Use the new index to efficiently sort by lastActivityTime
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_lastActivityTime")
      .order("desc")
      .take(limit);
    
    // Return leads directly, relying on the denormalized lastMessage field
    // This avoids the N+1 query problem that was causing Server Errors
    return leads.map((lead) => ({
      ...lead,
      lastMessage: lead.lastMessage || lead.message || "",
      lastMessageTime: lead.lastActivityTime || lead._creationTime,
      unreadCount: lead.unreadCount || 0,
    }));
  },
});