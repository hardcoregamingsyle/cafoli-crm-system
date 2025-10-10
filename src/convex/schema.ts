import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";

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
      serialNo: v.optional(v.number()), // Column A
      source: v.optional(v.string()), // Column B - "Pharmavends", "Indiamart", etc.
      name: v.string(), // Column C
      subject: v.string(), // Column D
      email: v.string(), // Column E
      mobileNo: v.string(), // Column F
      message: v.string(), // Column G
      altEmail: v.optional(v.string()), // Column H
      altMobileNo: v.optional(v.string()), // Column I
      assignedTo: v.optional(v.id("users")), // Column J (will be mapped to user ID)
      relevance: v.optional(v.string()), // Column L
      state: v.string(), // Column M
      station: v.optional(v.string()), // Column N
      district: v.optional(v.string()), // Column O
      pincode: v.optional(v.string()), // Column P
      agencyName: v.optional(v.string()), // Column Q
      nextFollowup: v.optional(v.number()), // timestamp
      status: v.optional(leadStatusValidator),
      heat: v.optional(v.union(v.literal("hot"), v.literal("cold"), v.literal("matured"))), // new field
    }).index("assignedTo", ["assignedTo"])
      .index("nextFollowup", ["nextFollowup"])
      .index("status", ["status"])
      .index("mobileNo", ["mobileNo"])
      .index("email", ["email"])
      .index("source", ["source"])
      .index("serialNo", ["serialNo"]),

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
    })
      .index("by_action_and_timestamp", ["action", "timestamp"])
      .index("userId", ["userId"])
      .index("timestamp", ["timestamp"]),

    // Add: Pincode mappings table
    pincodeMappings: defineTable({
      pincode: v.string(),
      district: v.string(),
      state: v.string(),
    }).index("pincode", ["pincode"]),

    emailApiKeys: defineTable({
      name: v.string(),       // unique name to identify key
      apiKey: v.string(),     // secret key
      dailyLimit: v.number(), // typically 295
      sentToday: v.number(),  // counter since last reset
      lastResetAt: v.number(),// ms timestamp of last reset to start-of-day
      active: v.boolean(),    // enable/disable this key
    })
      .index("by_name", ["name"])
      .index("by_active", ["active"]),

    emailQueue: defineTable({
      to: v.string(),
      subject: v.string(),
      text: v.string(),
      status: v.union(v.literal("queued"), v.literal("sent")), // re-queue on failure by keeping 'queued'
      attempts: v.number(),
      lastError: v.optional(v.string()),
    })
      .index("by_status", ["status"]),

    campaigns: defineTable({
      subject: v.string(),
      content: v.string(), // HTML content
      senderPrefix: v.string(), // e.g., "testing" for testing@mail.skinticals.com
      recipientType: v.union(v.literal("my_leads"), v.literal("all_leads"), v.literal("custom")),
      recipientIds: v.array(v.id("leads")),
      attachments: v.optional(v.array(v.id("_storage"))),
      status: v.union(v.literal("draft"), v.literal("sending"), v.literal("sent"), v.literal("failed")),
      sentCount: v.number(),
      failedCount: v.number(),
      createdBy: v.id("users"),
      sentAt: v.optional(v.number()),
    })
      .index("createdBy", ["createdBy"])
      .index("status", ["status"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;