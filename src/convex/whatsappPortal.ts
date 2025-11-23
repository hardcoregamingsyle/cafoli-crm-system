import { query } from "./_generated/server";
import { v } from "convex/values";

export const getLeadsWithMessages = query({
  args: {
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, _args) => {
    const leads = await ctx.db.query("leads").collect();
    
    // Get latest message for each lead to populate lastMessage
    const leadsWithDetails = await Promise.all(
      leads.map(async (lead) => {
        const lastMsg = await ctx.db
          .query("whatsappMessages")
          .withIndex("by_leadId", (q) => q.eq("leadId", lead._id))
          .order("desc")
          .first();

        // Ensure lastMessage is a string to prevent React errors
        let lastMessage = "";
        if (lastMsg) {
          lastMessage = String(lastMsg.message || "");
        } else if (lead.message) {
          lastMessage = String(lead.message);
        }

        return {
          ...lead,
          lastMessage,
          lastMessageTime: lastMsg ? lastMsg.timestamp : lead.lastActivityTime,
          unreadCount: typeof lead.unreadCount === 'number' ? lead.unreadCount : 0,
        };
      })
    );

    return leadsWithDetails.sort((a, b) => {
      const timeA = a.lastMessageTime || a._creationTime || 0;
      const timeB = b.lastMessageTime || b._creationTime || 0;
      return timeB - timeA;
    });
  },
});