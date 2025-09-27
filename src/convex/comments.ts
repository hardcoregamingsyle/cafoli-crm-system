import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";

// Get comments for a lead
export const getLeadComments = query({
  args: {
    leadId: v.id("leads"),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Accept local auth
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }
    
    const comments = await ctx.db
      .query("comments")
      .withIndex("leadId", (q) => q.eq("leadId", args.leadId))
      .collect();
    
    // Get user names for comments
    const commentsWithUser = await Promise.all(
      comments.map(async (comment) => {
        const user = await ctx.db.get(comment.userId);
        return {
          ...comment,
          userName: user?.name || user?.username || "Unknown",
        };
      })
    );
    
    // Sort by timestamp (newest first)
    commentsWithUser.sort((a, b) => b.timestamp - a.timestamp);
    
    return commentsWithUser;
  },
});

// Get all comments for leads assigned to a user (for dashboard followup completion checking)
export const getAllCommentsForUser = query({
  args: {
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser) {
      return [];
    }
    
    // Get all leads assigned to this user
    let userLeads: any[] = [];
    try {
      userLeads = await ctx.db
        .query("leads")
        .withIndex("assignedTo", (q) => q.eq("assignedTo", currentUser._id))
        .collect();
    } catch {
      // Fallback to full table scan if index fails
      const all = await ctx.db.query("leads").collect();
      userLeads = all.filter((l) => String(l.assignedTo ?? "") === String(currentUser._id));
    }
    
    const leadIds = userLeads.map(lead => lead._id);
    
    // Get all comments for these leads
    const allComments = await ctx.db.query("comments").collect();
    const userLeadComments = allComments.filter(comment => 
      leadIds.includes(comment.leadId)
    );
    
    return userLeadComments;
  },
});

// Add comment to lead
export const addComment = mutation({
  args: {
    leadId: v.id("leads"),
    content: v.string(),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Accept local auth
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }
    
    const commentId = await ctx.db.insert("comments", {
      leadId: args.leadId,
      userId: currentUser._id,
      content: args.content,
      timestamp: Date.now(),
    });
    
    // Log the action
    const lead = await ctx.db.get(args.leadId);
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "ADD_COMMENT",
      details: `Added comment to lead "${lead?.name}"`,
      timestamp: Date.now(),
      relatedLeadId: args.leadId,
    });
    
    return commentId;
  },
});