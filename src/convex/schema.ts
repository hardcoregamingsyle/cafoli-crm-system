import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const LEAD_STATUS = {
  NEW: "new",
  CONTACTED: "contacted",
  QUALIFIED: "qualified",
  CLOSED: "closed",
};

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
};

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    username: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    role: v.optional(v.string()),
    phone: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  auditLogs: defineTable({
    userId: v.id("users"),
    action: v.string(),
    timestamp: v.number(),
  }),

  notifications: defineTable({
    userId: v.id("users"),
    message: v.string(),
    createdAt: v.number(),
  }),

  comments: defineTable({
    leadId: v.id("leads"),
    text: v.string(),
    createdAt: v.number(),
  }),

  leads: defineTable({
    name: v.string(),
    email: v.string(),
    mobileNo: v.string(),
    status: v.optional(v.string()),
    state: v.string(),
    createdAt: v.number(),
    serialNo: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  whatsappMessages: defineTable({
    leadId: v.id("leads"),
    phoneNumber: v.string(),
    message: v.string(),
    timestamp: v.number(),
  })
    .index("by_creation_time", ["_creationTime"]),
});
