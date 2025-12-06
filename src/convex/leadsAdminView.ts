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
      .take(1000);

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

    // Sort by marked date (most recently marked first)
    return enrichedLeads.sort((a, b) => {
      const aTime = a.markedIrrelevantAt || a._creationTime;
      const bTime = b.markedIrrelevantAt || b._creationTime;
      return bTime - aTime;
    });
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
      .take(1000);

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
      .take(1000);

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
    // Use index and limit to 1000 leads for performance
    const allLeads = await ctx.db.query("leads").take(1000);
    
    const overdueLeads = allLeads.filter(
      (lead) => lead.nextFollowup && lead.nextFollowup < now
    );

    // Sort overdue leads by how overdue they are (most overdue first)
    const sortedOverdue = overdueLeads.sort((a, b) => {
      const aOverdue = a.nextFollowup || 0;
      const bOverdue = b.nextFollowup || 0;
      return aOverdue - bOverdue;
    });

    return await enrichLeadsWithUserInfo(ctx, sortedOverdue);
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

    // Limit to 1000 leads for performance
    const allLeads = await ctx.db.query("leads").take(1000);
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

    // Limit to 1000 leads for performance
    const allLeads = await ctx.db.query("leads").take(1000);
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

    // Limit to 1000 leads for performance
    const allLeads = await ctx.db.query("leads").take(1000);
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

    // Limit to 1000 leads for performance
    const allLeads = await ctx.db.query("leads").take(1000);
    const noFollowupLeads = allLeads.filter((lead) => !lead.nextFollowup);

    return await enrichLeadsWithUserInfo(ctx, noFollowupLeads);
  },
});

// Helper function to enrich leads with user information and sort them
async function enrichLeadsWithUserInfo(ctx: any, leads: any[]) {
  const enriched = await Promise.all(
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

  // Sort by creation time (newest first)
  return enriched.sort((a, b) => b._creationTime - a._creationTime);
}
