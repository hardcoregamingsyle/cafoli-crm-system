import { query } from "./_generated/server";
import { v } from "convex/values";

export const getLeadsWithMessages = query({
  args: {
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, _args) => {
    const leads = await ctx.db.query("leads").collect();
    
    // Return leads directly, relying on the denormalized lastMessage field
    // This avoids the N+1 query problem that was causing Server Errors
    return leads.map((lead) => ({
      ...lead,
      lastMessage: lead.lastMessage || lead.message || "",
      lastMessageTime: lead.lastActivityTime || lead._creationTime,
      unreadCount: lead.unreadCount || 0,
    })).sort((a, b) => {
      const timeA = a.lastMessageTime || 0;
      const timeB = b.lastMessageTime || 0;
      return timeB - timeA;
    });
  },
});