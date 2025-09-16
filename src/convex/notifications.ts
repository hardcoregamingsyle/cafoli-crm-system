import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";
import { ROLES } from "./schema";

// Get notifications for current user
export const getMyNotifications = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }
    
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("userId", (q) => q.eq("userId", currentUser._id))
      .collect();
    
    // Sort by creation time (newest first)
    notifications.sort((a, b) => b._creationTime - a._creationTime);
    
    return notifications;
  },
});

// Mark notification as read
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }
    
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== currentUser._id) {
      throw new Error("Notification not found or unauthorized");
    }
    
    await ctx.db.patch(args.notificationId, { read: true });
  },
});

// Send notification to user (Admin only)
export const sendNotification = mutation({
  args: {
    userId: v.id("users"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }
    
    await ctx.db.insert("notifications", {
      userId: args.userId,
      title: "Message from Admin",
      message: args.message,
      read: false,
      type: "admin_message",
    });
    
    // Log the action
    const targetUser = await ctx.db.get(args.userId);
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "SEND_NOTIFICATION",
      details: `Sent notification to ${targetUser?.name || "user"}`,
      timestamp: Date.now(),
    });
  },
});

// Get unread notification count
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return 0;
    }
    
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("userId", (q) => q.eq("userId", currentUser._id))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();
    
    return unreadNotifications.length;
  },
});
