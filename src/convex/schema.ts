import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// User roles for the CRM system
export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager", 
  STAFF: "staff",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.MANAGER),
  v.literal(ROLES.STAFF),
);
export type Role = Infer<typeof roleValidator>;

// Lead status options
export const LEAD_STATUS = {
  RELEVANT: "relevant",
  NOT_RELEVANT: "not_relevant", 
  YET_TO_DECIDE: "yet_to_decide",
} as const;

export const leadStatusValidator = v.union(
  v.literal(LEAD_STATUS.RELEVANT),
  v.literal(LEAD_STATUS.NOT_RELEVANT),
  v.literal(LEAD_STATUS.YET_TO_DECIDE),
);
export type LeadStatus = Infer<typeof leadStatusValidator>;

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      username: v.optional(v.string()),
      password: v.optional(v.string()), // For custom login system
      createdBy: v.optional(v.id("users")), // Who created this user
    }).index("email", ["email"])
      .index("username", ["username"]),

    leads: defineTable({
      name: v.string(),
      subject: v.string(),
      message: v.string(),
      mobileNo: v.string(),
      email: v.string(),
      altMobileNo: v.optional(v.string()),
      altEmail: v.optional(v.string()),
      state: v.string(),
      nextFollowup: v.optional(v.number()), // timestamp
      assignedTo: v.optional(v.id("users")),
      status: v.optional(leadStatusValidator),
      source: v.optional(v.string()), // "indiamart", "pharmavends", "manual"
    }).index("assignedTo", ["assignedTo"])
      .index("nextFollowup", ["nextFollowup"])
      .index("status", ["status"])
      .index("mobileNo", ["mobileNo"])
      .index("email", ["email"]),

    comments: defineTable({
      leadId: v.id("leads"),
      userId: v.id("users"),
      content: v.string(),
      timestamp: v.number(),
    }).index("leadId", ["leadId"]),

    notifications: defineTable({
      userId: v.id("users"),
      title: v.string(),
      message: v.string(),
      read: v.boolean(),
      type: v.string(), // "lead_assigned", "followup_due", "admin_message"
      relatedLeadId: v.optional(v.id("leads")),
    }).index("userId", ["userId"])
      .index("read", ["read"]),

    auditLogs: defineTable({
      userId: v.id("users"),
      action: v.string(),
      details: v.string(),
      timestamp: v.number(),
      relatedLeadId: v.optional(v.id("leads")),
    }).index("userId", ["userId"])
      .index("timestamp", ["timestamp"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;