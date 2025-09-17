import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { ROLES, roleValidator } from "./schema";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      return null;
    }
    return user;
  },
});

export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

// Custom login for predefined users
export const loginWithCredentials = mutation({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", args.username))
      .unique();
    
    if (!user || user.password !== args.password) {
      throw new Error("Invalid credentials");
    }
    
    return user;
  },
});

// Get all users (Admin only)
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    // Return empty list when unauthorized to avoid client-side errors
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      return [];
    }
    
    return await ctx.db.query("users").collect();
  },
});

// Create user (Admin can create Manager/Staff, Manager can create Staff)
export const createUser = mutation({
  args: {
    name: v.string(),
    username: v.string(),
    password: v.string(),
    role: roleValidator,
    email: v.optional(v.string()),
    createdByUserId: v.id("users"), // Pass the current user ID from frontend
  },
  handler: async (ctx, args) => {
    // Get the current user who is creating this user
    const currentUser = await ctx.db.get(args.createdByUserId);
    if (!currentUser) {
      throw new Error("Creator user not found");
    }
    
    // Check permissions
    if (currentUser.role === ROLES.ADMIN) {
      // Admin can create Manager or Staff
      if (args.role !== ROLES.MANAGER && args.role !== ROLES.STAFF) {
        throw new Error("Admin can only create Manager or Staff accounts");
      }
    } else if (currentUser.role === ROLES.MANAGER) {
      // Manager can only create Staff
      if (args.role !== ROLES.STAFF) {
        throw new Error("Manager can only create Staff accounts");
      }
    } else {
      throw new Error("Unauthorized to create users");
    }
    
    // Check if username already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", args.username))
      .unique();
    
    if (existingUser) {
      throw new Error("Username already exists");
    }
    
    const userId = await ctx.db.insert("users", {
      name: args.name,
      username: args.username,
      password: args.password,
      role: args.role,
      email: args.email,
      createdBy: currentUser._id,
    });
    
    // Log the action
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "CREATE_USER",
      details: `Created user ${args.username} with role ${args.role}`,
      timestamp: Date.now(),
    });
    
    return userId;
  },
});

// Update user role (Admin only)
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: roleValidator,
    currentUserId: v.id("users"), // Pass current user ID from frontend
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }
    
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }
    
    await ctx.db.patch(args.userId, { role: args.role });
    
    // Log the action
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "UPDATE_USER_ROLE",
      details: `Changed ${targetUser.username} role to ${args.role}`,
      timestamp: Date.now(),
    });
  },
});

// Delete user (Admin only)
export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
    currentUserId: v.id("users"), // Pass current user ID from frontend
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }
    
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }
    
    // Don't allow deleting self
    if (args.userId === currentUser._id) {
      throw new Error("Cannot delete your own account");
    }
    
    await ctx.db.delete(args.userId);
    
    // Log the action
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "DELETE_USER",
      details: `Deleted user ${targetUser.username}`,
      timestamp: Date.now(),
    });
  },
});

// Initialize default users
export const initializeDefaultUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const defaultUsers = [
      { name: "Owner", username: "Owner", password: "Belive*8", role: ROLES.ADMIN },
      { name: "Ankush", username: "Ankush", password: "Ankush1234", role: ROLES.MANAGER },
      { name: "Shiwani", username: "Shiwani", password: "Shiwani1234", role: ROLES.MANAGER },
      { name: "Rozi", username: "Rozi", password: "Rozi1234", role: ROLES.MANAGER },
      { name: "Reena", username: "Reena", password: "Reena1234", role: ROLES.MANAGER },
      { name: "Bandana", username: "Bandana", password: "Bandana1234", role: ROLES.MANAGER },
      { name: "Amit", username: "Amit", password: "Amit1234", role: ROLES.MANAGER },
      { name: "Shiv", username: "Shiv", password: "Shiv1234", role: ROLES.MANAGER },
      { name: "Anju", username: "Anju", password: "Anju1234", role: ROLES.MANAGER },
      { name: "Kajal", username: "Kajal", password: "Kajal1234", role: ROLES.MANAGER },
      { name: "Manpreet", username: "Manpreet", password: "Manpreet1234", role: ROLES.MANAGER },
    ];
    
    for (const user of defaultUsers) {
      const existing = await ctx.db
        .query("users")
        .withIndex("username", (q) => q.eq("username", user.username))
        .unique();
      
      if (!existing) {
        await ctx.db.insert("users", user);
      }
    }
  },
});

export const getAssignableUsers = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    // Gracefully return empty list when not authenticated to avoid client-side errors
    if (!currentUser) {
      return [];
    }
    // Admin: can assign to anyone
    if (currentUser.role === ROLES.ADMIN) {
      return await ctx.db.query("users").collect();
    }
    // Manager: can assign to Managers and Staff
    if (currentUser.role === ROLES.MANAGER) {
      const managersAndStaff = await ctx.db.query("users").collect();
      return managersAndStaff.filter(
        (u) => u.role === ROLES.MANAGER || u.role === ROLES.STAFF
      );
    }
    // Staff or others: no access, return empty list to avoid throwing
    return [];
  },
});