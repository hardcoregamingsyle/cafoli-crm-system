import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ROLES } from "./schema";

// Get all tags
export const getAllTags = query({
  args: { currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) throw new Error("User not found");

    return await ctx.db.query("leadTags").collect();
  },
});

// Create a new tag
export const createTag = mutation({
  args: {
    currentUserId: v.id("users"),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) throw new Error("User not found");

    // Check if tag with same name already exists
    const existing = await ctx.db
      .query("leadTags")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      throw new Error("A tag with this name already exists");
    }

    const tagId = await ctx.db.insert("leadTags", {
      name: args.name,
      color: args.color,
      createdBy: args.currentUserId,
      createdAt: Date.now(),
    });

    return tagId;
  },
});

// Delete a tag
export const deleteTag = mutation({
  args: {
    currentUserId: v.id("users"),
    tagId: v.id("leadTags"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) throw new Error("User not found");

    // Only admin can delete tags
    if (user.role !== ROLES.ADMIN) {
      throw new Error("Only admins can delete tags");
    }

    // Delete all assignments of this tag
    const assignments = await ctx.db
      .query("leadTagAssignments")
      .withIndex("by_tagId", (q) => q.eq("tagId", args.tagId))
      .collect();

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    // Delete the tag
    await ctx.db.delete(args.tagId);
  },
});

// Assign a tag to a lead
export const assignTagToLead = mutation({
  args: {
    currentUserId: v.id("users"),
    leadId: v.id("leads"),
    tagId: v.id("leadTags"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) throw new Error("User not found");

    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");

    const tag = await ctx.db.get(args.tagId);
    if (!tag) throw new Error("Tag not found");

    // Check if already assigned
    const existing = await ctx.db
      .query("leadTagAssignments")
      .withIndex("by_leadId_and_tagId", (q) =>
        q.eq("leadId", args.leadId).eq("tagId", args.tagId)
      )
      .first();

    if (existing) {
      throw new Error("Tag already assigned to this lead");
    }

    await ctx.db.insert("leadTagAssignments", {
      leadId: args.leadId,
      tagId: args.tagId,
      assignedBy: args.currentUserId,
      assignedAt: Date.now(),
    });
  },
});

// Remove a tag from a lead
export const removeTagFromLead = mutation({
  args: {
    currentUserId: v.id("users"),
    leadId: v.id("leads"),
    tagId: v.id("leadTags"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) throw new Error("User not found");

    const assignment = await ctx.db
      .query("leadTagAssignments")
      .withIndex("by_leadId_and_tagId", (q) =>
        q.eq("leadId", args.leadId).eq("tagId", args.tagId)
      )
      .first();

    if (!assignment) {
      throw new Error("Tag not assigned to this lead");
    }

    await ctx.db.delete(assignment._id);
  },
});

// Get tags for a specific lead
export const getLeadTags = query({
  args: {
    currentUserId: v.id("users"),
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) throw new Error("User not found");

    const assignments = await ctx.db
      .query("leadTagAssignments")
      .withIndex("by_leadId", (q) => q.eq("leadId", args.leadId))
      .collect();

    const tags = await Promise.all(
      assignments.map(async (assignment) => {
        const tag = await ctx.db.get(assignment.tagId);
        return tag;
      })
    );

    return tags.filter((tag) => tag !== null);
  },
});
