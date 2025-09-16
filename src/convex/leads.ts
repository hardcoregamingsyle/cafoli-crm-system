import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";
import { ROLES, LEAD_STATUS, leadStatusValidator } from "./schema";

// Get all leads (Admin and Manager only)
export const getAllLeads = query({
  args: {
    filter: v.optional(v.union(v.literal("all"), v.literal("assigned"), v.literal("unassigned"))),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || (currentUser.role !== ROLES.ADMIN && currentUser.role !== ROLES.MANAGER)) {
      // Return empty list when unauthorized to avoid client-side errors
      return [];
    }
    
    let leads = await ctx.db.query("leads").collect();
    
    // Apply filter
    if (args.filter === "assigned") {
      leads = leads.filter(lead => lead.assignedTo !== undefined);
    } else if (args.filter === "unassigned") {
      leads = leads.filter(lead => lead.assignedTo === undefined);
    }
    
    // Sort oldest to newest
    leads.sort((a, b) => a._creationTime - b._creationTime);
    
    // Get assigned user names
    const leadsWithAssignedUser = await Promise.all(
      leads.map(async (lead) => {
        let assignedUserName = null;
        if (lead.assignedTo) {
          const assignedUser = await ctx.db.get(lead.assignedTo);
          assignedUserName = assignedUser?.name || assignedUser?.username || "Unknown";
        }
        return { ...lead, assignedUserName };
      })
    );
    
    return leadsWithAssignedUser;
  },
});

// Get leads assigned to current user (Manager and Staff only)
export const getMyLeads = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || currentUser.role === ROLES.ADMIN) {
      // Return empty list when unauthorized
      return [];
    }
    
    const leads = await ctx.db
      .query("leads")
      .withIndex("assignedTo", (q) => q.eq("assignedTo", currentUser._id))
      .collect();
    
    // Sort oldest to newest
    leads.sort((a, b) => a._creationTime - b._creationTime);
    
    return leads;
  },
});

// Create lead
export const createLead = mutation({
  args: {
    name: v.string(),
    subject: v.string(),
    message: v.string(),
    mobileNo: v.string(),
    email: v.string(),
    altMobileNo: v.optional(v.string()),
    altEmail: v.optional(v.string()),
    state: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const leadId = await ctx.db.insert("leads", {
      ...args,
      status: LEAD_STATUS.YET_TO_DECIDE,
    });
    
    return leadId;
  },
});

// Assign lead
export const assignLead = mutation({
  args: {
    leadId: v.id("leads"),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || (currentUser.role !== ROLES.ADMIN && currentUser.role !== ROLES.MANAGER)) {
      throw new Error("Unauthorized");
    }
    
    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }
    
    await ctx.db.patch(args.leadId, { assignedTo: args.assignedTo });
    
    // Create notification if assigning to someone
    if (args.assignedTo) {
      await ctx.db.insert("notifications", {
        userId: args.assignedTo,
        title: "New Lead Assigned",
        message: "A new Lead has Been Assigned",
        read: false,
        type: "lead_assigned",
        relatedLeadId: args.leadId,
      });
    }
    
    // Log the action
    const assignedUser = args.assignedTo ? await ctx.db.get(args.assignedTo) : null;
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "ASSIGN_LEAD",
      details: `Assigned lead "${lead.name}" to ${assignedUser?.name || "unassigned"}`,
      timestamp: Date.now(),
      relatedLeadId: args.leadId,
    });
  },
});

// Update lead status
export const updateLeadStatus = mutation({
  args: {
    leadId: v.id("leads"),
    status: leadStatusValidator,
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || currentUser.role === ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }
    
    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }
    
    // Check if user is assigned to this lead
    if (lead.assignedTo !== currentUser._id) {
      throw new Error("You can only update leads assigned to you");
    }
    
    if (args.status === LEAD_STATUS.NOT_RELEVANT) {
      // Delete the lead
      await ctx.db.delete(args.leadId);
      
      // Log the action
      await ctx.db.insert("auditLogs", {
        userId: currentUser._id,
        action: "DELETE_LEAD",
        details: `Marked lead "${lead.name}" as not relevant and deleted`,
        timestamp: Date.now(),
      });
    } else {
      await ctx.db.patch(args.leadId, { status: args.status });
      
      // Log the action
      await ctx.db.insert("auditLogs", {
        userId: currentUser._id,
        action: "UPDATE_LEAD_STATUS",
        details: `Updated lead "${lead.name}" status to ${args.status}`,
        timestamp: Date.now(),
        relatedLeadId: args.leadId,
      });
    }
  },
});

// Set next followup
export const setNextFollowup = mutation({
  args: {
    leadId: v.id("leads"),
    followupTime: v.number(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }
    
    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }
    
    // Check permissions
    if (currentUser.role !== ROLES.ADMIN && lead.assignedTo !== currentUser._id) {
      throw new Error("You can only set followup for leads assigned to you");
    }
    
    await ctx.db.patch(args.leadId, { nextFollowup: args.followupTime });
    
    // Log the action
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "SET_FOLLOWUP",
      details: `Set followup for lead "${lead.name}" at ${new Date(args.followupTime).toLocaleString()}`,
      timestamp: Date.now(),
      relatedLeadId: args.leadId,
    });
  },
});

// Cancel followup (Admin only)
export const cancelFollowup = mutation({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }
    
    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }
    
    await ctx.db.patch(args.leadId, { nextFollowup: undefined });
    
    // Log the action
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "CANCEL_FOLLOWUP",
      details: `Cancelled followup for lead "${lead.name}"`,
      timestamp: Date.now(),
      relatedLeadId: args.leadId,
    });
  },
});

// Get leads with upcoming followups
export const getUpcomingFollowups = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      // Return empty list for unauthenticated users
      return [];
    }

    const now = Date.now();
    const fiveMinutesFromNow = now + (5 * 60 * 1000);
    
    const leads = await ctx.db.query("leads").collect();
    
    return leads.filter(lead => 
      lead.nextFollowup && 
      lead.nextFollowup <= fiveMinutesFromNow && 
      lead.nextFollowup > now
    );
  },
});