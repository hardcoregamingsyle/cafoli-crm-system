import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";

// Get comments for a lead
export const getLeadComments = query({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
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

// Add comment to lead
export const addComment = mutation({
  args: {
    leadId: v.id("leads"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
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
