import { query } from "./_generated/server";
import { v } from "convex/values";
import { ROLES } from "./schema";

// Get leads with WhatsApp messages for the portal
export const getLeadsWithMessages = query({
  args: {
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser) {
      throw new Error("User not found");
    }

    let leads: any[] = [];

    // Admin sees all leads, Manager sees only assigned leads
    if (currentUser.role === ROLES.ADMIN) {
      leads = await ctx.db.query("leads").collect();
    } else if (currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.STAFF) {
      leads = await ctx.db
        .query("leads")
        .withIndex("assignedTo", (q) => q.eq("assignedTo", currentUser._id))
        .collect();
    } else {
      return [];
    }

    // Get message counts and last message for each lead
    const leadsWithMessageInfo = await Promise.all(
      leads.map(async (lead) => {
        const messages = await ctx.db
          .query("whatsappMessages")
          .withIndex("by_leadId", (q) => q.eq("leadId", lead._id))
          .collect();

        const sortedMessages = messages.sort((a, b) => b.timestamp - a.timestamp);
        const lastMessage = sortedMessages[0] || null;
        const unreadCount = messages.filter(
          (m) => m.direction === "inbound" && m.status !== "read"
        ).length;

        return {
          ...lead,
          messageCount: messages.length,
          lastMessage: lastMessage
            ? {
                message: lastMessage.message,
                timestamp: lastMessage.timestamp,
                direction: lastMessage.direction,
              }
            : null,
          unreadCount,
        };
      })
    );

    // Sort by last message timestamp (most recent first)
    return leadsWithMessageInfo.sort((a, b) => {
      const aTime = a.lastMessage?.timestamp || 0;
      const bTime = b.lastMessage?.timestamp || 0;
      return bTime - aTime;
    });
  },
});
