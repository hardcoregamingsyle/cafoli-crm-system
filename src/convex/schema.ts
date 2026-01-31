import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(v.string()),
    isVerified: v.optional(v.boolean()),
    otp: v.optional(v.string()),
    otpExpiresAt: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_email", ["email"])
    .index("by_username", ["username"])
    .index("by_role", ["role"]),

  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.id("users"),
    githubUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  chatMessages: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    timestamp: v.number(),
  }).index("by_project", ["projectId"]),

  codeFiles: defineTable({
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
    language: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),
});