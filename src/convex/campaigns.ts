import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ROLES } from "./schema";

export const createCampaign = mutation({
  args: {
    currentUserId: v.id("users"),
    subject: v.string(),
    content: v.string(),
    senderPrefix: v.string(),
    recipientType: v.union(v.literal("my_leads"), v.literal("all_leads"), v.literal("custom")),
    recipientIds: v.array(v.id("leads")),
    attachments: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user || (user.role !== ROLES.ADMIN && user.role !== ROLES.MANAGER)) {
      throw new Error("Unauthorized");
    }

    const campaignId = await ctx.db.insert("campaigns", {
      subject: args.subject,
      content: args.content,
      senderPrefix: args.senderPrefix,
      recipientType: args.recipientType,
      recipientIds: args.recipientIds,
      attachments: args.attachments,
      status: "draft",
      sentCount: 0,
      failedCount: 0,
      createdBy: args.currentUserId,
    });

    return campaignId;
  },
});

export const updateCampaign = mutation({
  args: {
    currentUserId: v.id("users"),
    campaignId: v.id("campaigns"),
    subject: v.optional(v.string()),
    content: v.optional(v.string()),
    senderPrefix: v.optional(v.string()),
    recipientType: v.optional(v.union(v.literal("my_leads"), v.literal("all_leads"), v.literal("custom"))),
    recipientIds: v.optional(v.array(v.id("leads"))),
    attachments: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) throw new Error("Unauthorized");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    if (campaign.createdBy !== args.currentUserId && user.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }

    const updates: any = {};
    if (args.subject !== undefined) updates.subject = args.subject;
    if (args.content !== undefined) updates.content = args.content;
    if (args.senderPrefix !== undefined) updates.senderPrefix = args.senderPrefix;
    if (args.recipientType !== undefined) updates.recipientType = args.recipientType;
    if (args.recipientIds !== undefined) updates.recipientIds = args.recipientIds;
    if (args.attachments !== undefined) updates.attachments = args.attachments;

    await ctx.db.patch(args.campaignId, updates);
  },
});

export const deleteCampaign = mutation({
  args: {
    currentUserId: v.id("users"),
    campaignId: v.id("campaigns"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) throw new Error("Unauthorized");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    if (campaign.createdBy !== args.currentUserId && user.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.campaignId);
  },
});

export const getCampaigns = query({
  args: {
    currentUserId: v.union(v.id("users"), v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // Validate that we have a non-empty ID
      if (!args.currentUserId || typeof args.currentUserId === 'string' && args.currentUserId.trim() === '') {
        console.error("Empty or invalid currentUserId in getCampaigns");
        return [];
      }

      // Handle invalid ID format gracefully
      let user;
      try {
        user = await ctx.db.get(args.currentUserId as any);
      } catch (e) {
        console.error("Invalid user ID format in getCampaigns:", args.currentUserId, e);
        return [];
      }
      
      if (!user) {
        console.error("User not found in getCampaigns:", args.currentUserId);
        return [];
      }

      if ((user as any).role === ROLES.ADMIN) {
        return await ctx.db.query("campaigns").collect();
      } else {
        return await ctx.db
          .query("campaigns")
          .withIndex("by_createdBy", (q) => q.eq("createdBy", args.currentUserId as any))
          .collect();
      }
    } catch (error) {
      console.error("Error in getCampaigns:", error);
      return [];
    }
  },
});

export const getCampaignById = query({
  args: {
    currentUserId: v.id("users"),
    campaignId: v.id("campaigns"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) return null;

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return null;

    if (campaign.createdBy !== args.currentUserId && user.role !== ROLES.ADMIN) {
      return null;
    }

    return campaign;
  },
});

export const getLeadsForCampaign = query({
  args: {
    currentUserId: v.union(v.id("users"), v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // Validate that we have a non-empty ID
      if (!args.currentUserId || typeof args.currentUserId === 'string' && args.currentUserId.trim() === '') {
        console.error("Empty or invalid currentUserId in getLeadsForCampaign");
        return [];
      }

      // Handle invalid ID format gracefully
      let user;
      try {
        user = await ctx.db.get(args.currentUserId as any);
      } catch (e) {
        console.error("Invalid user ID format in getLeadsForCampaign:", args.currentUserId, e);
        return [];
      }
      
      if (!user) {
        console.error("User not found in getLeadsForCampaign:", args.currentUserId);
        return [];
      }

      if ((user as any).role === ROLES.ADMIN) {
        return await ctx.db.query("leads").collect();
      } else if ((user as any).role === ROLES.MANAGER) {
        return await ctx.db
          .query("leads")
          .withIndex("assignedTo", (q) => q.eq("assignedTo", args.currentUserId as any))
          .collect();
      }

      return [];
    } catch (error) {
      console.error("Error in getLeadsForCampaign:", error);
      return [];
    }
  },
});

export const startCampaign = mutation({
  args: {
    currentUserId: v.id("users"),
    campaignId: v.id("campaigns"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) throw new Error("Unauthorized");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    if (campaign.createdBy !== args.currentUserId && user.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.campaignId, {
      status: "sending",
    });

    // Schedule the actual sending as an action
    await ctx.scheduler.runAfter(0, "campaigns:sendCampaignEmails" as any, {
      campaignId: args.campaignId,
    });

    return { success: true };
  },
});
