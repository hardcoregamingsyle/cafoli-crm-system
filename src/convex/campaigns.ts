import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ROLES } from "./schema";

export const createCampaign = mutation({
  args: {
    currentUserId: v.id("users"),
    name: v.string(),
    recipientIds: v.array(v.id("leads")),
    workflow: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const campaignId = await ctx.db.insert("campaigns", {
      name: args.name,
      recipientIds: args.recipientIds,
      workflow: args.workflow || { blocks: [], connections: [] },
      status: "draft",
      createdBy: args.currentUserId,
      createdAt: Date.now(),
    });

    return campaignId;
  },
});

export const updateCampaign = mutation({
  args: {
    currentUserId: v.id("users"),
    campaignId: v.id("campaigns"),
    name: v.optional(v.string()),
    recipientIds: v.optional(v.array(v.id("leads"))),
    workflow: v.optional(v.any()),
    status: v.optional(v.string()),
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
    if (args.name !== undefined) updates.name = args.name;
    if (args.recipientIds !== undefined) updates.recipientIds = args.recipientIds;
    if (args.workflow !== undefined) updates.workflow = args.workflow;
    if (args.status !== undefined) updates.status = args.status;

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
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) return [];

    if (user.role === ROLES.ADMIN) {
      return await ctx.db.query("campaigns").collect();
    } else {
      return await ctx.db
        .query("campaigns")
        .withIndex("by_createdBy", (q) => q.eq("createdBy", args.currentUserId))
        .collect();
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
    currentUserId: v.id("users"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) return { leads: [], hasMore: false, nextCursor: null };

    const limit = args.limit || 1000;
    let query;

    if (user.role === ROLES.ADMIN) {
      query = ctx.db.query("leads");
    } else if (user.role === ROLES.MANAGER || user.role === ROLES.STAFF) {
      query = ctx.db
        .query("leads")
        .withIndex("assignedTo", (q) => q.eq("assignedTo", args.currentUserId));
    } else {
      return { leads: [], hasMore: false, nextCursor: null };
    }

    // Apply pagination
    const results = await query
      .order("desc")
      .paginate({ numItems: limit, cursor: args.cursor || null });

    return {
      leads: results.page,
      hasMore: !results.isDone,
      nextCursor: results.continueCursor,
    };
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
      status: "active",
    });

    return { success: true };
  },
});
