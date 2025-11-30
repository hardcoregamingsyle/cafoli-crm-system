import { query } from "./_generated/server";
import { v } from "convex/values";
import { ROLES, LEAD_STATUS } from "./schema";

// Get irrelevant leads (admin only)
export const getIrrelevantLeads = query({
  args: { currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized: Admin access required");
    }

    const leads = await ctx.db
      .query("leads")
      .filter((q) => q.eq(q.field("status"), LEAD_STATUS.NOT_RELEVANT))
      .collect();

    // Enrich with user info
    const enrichedLeads = await Promise.all(
      leads.map(async (lead) => {
        let markedByUserName = "Unknown";
        if (lead.markedIrrelevantBy) {
          const user = await ctx.db.get(lead.markedIrrelevantBy);
          markedByUserName = user?.name || user?.username || "Unknown";
        }
        
        let assignedUserName = undefined;
        if (lead.assignedTo) {
          const assignedUser = await ctx.db.get(lead.assignedTo);
          assignedUserName = assignedUser?.name || assignedUser?.username || "Unassigned";
        }

        return {
          ...lead,
          markedByUserName,
          assignedUserName,
        };
      })
    );

    return enrichedLeads;
  },
});

// Get relevant leads (admin only)
export const getRelevantLeads = query({
  args: { currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized: Admin access required");
    }

    const leads = await ctx.db
      .query("leads")
      .filter((q) => q.eq(q.field("status"), LEAD_STATUS.RELEVANT))
      .collect();

    return await enrichLeadsWithUserInfo(ctx, leads);
  },
});

// Get yet to decide leads (admin only)
export const getYetToDecideLeads = query({
  args: { currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized: Admin access required");
    }

    const leads = await ctx.db
      .query("leads")
      .filter((q) => q.eq(q.field("status"), LEAD_STATUS.YET_TO_DECIDE))
      .collect();

    return await enrichLeadsWithUserInfo(ctx, leads);
  },
});

// Get overdue leads (admin only)
export const getOverdueLeads = query({
  args: { currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized: Admin access required");
    }

    const now = Date.now();
    const allLeads = await ctx.db.query("leads").collect();
    
    const overdueLeads = allLeads.filter(
      (lead) => lead.nextFollowup && lead.nextFollowup < now
    );

    return await enrichLeadsWithUserInfo(ctx, overdueLeads);
  },
});

// Get hot leads (admin only)
export const getHotLeads = query({
  args: { currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized: Admin access required");
    }

    const allLeads = await ctx.db.query("leads").collect();
    const hotLeads = allLeads.filter((lead) => lead.heat === "hot");

    return await enrichLeadsWithUserInfo(ctx, hotLeads);
  },
});

// Get cold leads (admin only)
export const getColdLeads = query({
  args: { currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized: Admin access required");
    }

    const allLeads = await ctx.db.query("leads").collect();
    const coldLeads = allLeads.filter((lead) => lead.heat === "cold");

    return await enrichLeadsWithUserInfo(ctx, coldLeads);
  },
});

// Get mature leads (admin only)
export const getMatureLeads = query({
  args: { currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized: Admin access required");
    }

    const allLeads = await ctx.db.query("leads").collect();
    const matureLeads = allLeads.filter((lead) => lead.heat === "matured" || lead.heat === "mature");

    return await enrichLeadsWithUserInfo(ctx, matureLeads);
  },
});

// Get leads with no follow-up set (admin only)
export const getNoFollowupLeads = query({
  args: { currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized: Admin access required");
    }

    const allLeads = await ctx.db.query("leads").collect();
    const noFollowupLeads = allLeads.filter((lead) => !lead.nextFollowup);

    return await enrichLeadsWithUserInfo(ctx, noFollowupLeads);
  },
});

// Helper function to enrich leads with user information
async function enrichLeadsWithUserInfo(ctx: any, leads: any[]) {
  return await Promise.all(
    leads.map(async (lead) => {
      let assignedUserName = undefined;
      if (lead.assignedTo) {
        const assignedUser = await ctx.db.get(lead.assignedTo);
        assignedUserName = assignedUser?.name || assignedUser?.username || "Unassigned";
      }

      return {
        ...lead,
        assignedUserName,
      };
    })
  );
}
