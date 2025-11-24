import { query } from "./_generated/server";
import { v } from "convex/values";
import { ROLES } from "./schema";

export const getLeadsWithMessages = query({
  args: {
    currentUserId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate user exists and get their role
    if (!args.currentUserId) {
      return [];
    }

    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser) {
      return [];
    }

    const limit = args.limit || 100;
    
    // Fetch leads sorted by lastActivityTime
    const allLeads = await ctx.db
      .query("leads")
      .withIndex("by_lastActivityTime")
      .order("desc")
      .take(limit * 2); // Fetch more to account for filtering
    
    // Filter leads based on user role and assignment
    let filteredLeads = allLeads;
    
    if (currentUser.role !== ROLES.ADMIN) {
      // Non-admin users only see leads assigned to them
      filteredLeads = allLeads.filter((lead) => 
        String(lead.assignedTo ?? "") === String(currentUser._id)
      );
    }
    
    // Filter out deleted leads (leads without _id are deleted)
    // Also ensure lead has valid data
    filteredLeads = filteredLeads.filter((lead) => {
      // Check if lead still exists (not deleted)
      if (!lead._id) return false;
      
      // Optionally filter out "not_relevant" status leads from WhatsApp view
      // if (lead.status === "not_relevant") return false;
      
      return true;
    });
    
    // Take only the requested limit after filtering
    filteredLeads = filteredLeads.slice(0, limit);
    
    // Return leads with denormalized fields
    return filteredLeads.map((lead) => ({
      ...lead,
      lastMessage: lead.lastMessage || lead.message || "",
      lastMessageTime: lead.lastActivityTime || lead._creationTime,
      unreadCount: lead.unreadCount || 0,
    }));
  },
});