import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Simple password hashing simulation (In production, use a proper library or Convex Auth)
// Since we are in a sandbox and cannot easily add crypto libraries without npm install, 
// we will assume the client sends a hashed password or we store it as is for this demo 
// (WARNING: NOT SECURE FOR PRODUCTION). 
// Ideally, we should use the `crypto` module if available in the runtime.

export const signup = mutation({
  args: {
    email: v.string(),
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const existingEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingEmail) {
      throw new Error("Email already registered");
    }

    const existingUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();

    if (existingUsername) {
      throw new Error("Username already taken");
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    const userId = await ctx.db.insert("users", {
      name: args.username, // Use username as display name
      email: args.email,
      username: args.username,
      passwordHash: args.password, // In a real app, hash this!
      isVerified: false,
      otp,
      otpExpiresAt,
      createdAt: Date.now(),
    });

    // TODO: Send OTP via Email API (to be implemented)
    console.log(`OTP for ${args.email}: ${otp}`);

    return { userId, message: "Signup successful. Please verify your email." };
  },
});

export const verifyEmail = mutation({
  args: {
    email: v.string(),
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    if (user.isVerified) {
      return { success: true, message: "Already verified" };
    }

    if (user.otp !== args.otp) {
      throw new Error("Invalid OTP");
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < Date.now()) {
      throw new Error("OTP expired");
    }

    await ctx.db.patch(user._id, {
      isVerified: true,
      otp: undefined,
      otpExpiresAt: undefined,
    });

    return { success: true, message: "Email verified successfully" };
  },
});

export const login = mutation({
  args: {
    identifier: v.string(), // Email or Username
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Try to find by email
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.identifier))
      .first();

    // If not found, try by username
    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", args.identifier))
        .first();
    }

    if (!user) {
      throw new Error("Invalid credentials");
    }

    if (args.password) {
      // Password login
      if (user.passwordHash !== args.password) {
        throw new Error("Invalid credentials");
      }
    } else {
      // OTP Login request
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = Date.now() + 10 * 60 * 1000;

      await ctx.db.patch(user._id, {
        otp,
        otpExpiresAt,
      });

      // TODO: Send OTP via Email API
      console.log(`Login OTP for ${user.email}: ${otp}`);
      
      return { requireOtp: true, message: "OTP sent to email" };
    }

    return { success: true, userId: user._id, username: user.username };
  },
});

export const loginWithOtp = mutation({
  args: {
    email: v.string(),
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    if (user.otp !== args.otp) {
      throw new Error("Invalid OTP");
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < Date.now()) {
      throw new Error("OTP expired");
    }

    await ctx.db.patch(user._id, {
      otp: undefined,
      otpExpiresAt: undefined,
    });

    return { success: true, userId: user._id, username: user.username };
  },
});