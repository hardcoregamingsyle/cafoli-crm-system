import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  STAFF: "staff",
};

export default defineSchema({
  // ------------------ USERS ------------------
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.optional(v.string()),
    phone: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // ------------------ LEADS ------------------
  leads: defineTable({
    name: v.string(),
    subject: v.string(),
    message: v.string(),
    mobileNo: v.string(),
    email: v.string(),
    altMobileNo: v.optional(v.string()),
    altEmail: v.optional(v.string()),
    state: v.string(),
    source: v.string(),
    station: v.optional(v.string()),
    district: v.optional(v.string()),
    pincode: v.optional(v.string()),
    agencyName: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    assignedBy: v.optional(v.id("users")),
    assignedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    status: v.optional(v.string()),
    feedback: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_assignedTo", ["assignedTo"])
    .index("by_source", ["source"]),

  // ------------------ LEAD REQUESTS ------------------
  leadRequests: defineTable({
    requestedBy: v.id("users"),
    requestedByRole: v.string(),
    numberOfLeads: v.number(),
    status: v.string(), // "pending", "approved", "declined"
    createdAt: v.number(),
  })
    .index("by_requestedBy", ["requestedBy"])
    .index("by_status", ["status"]), // ✅ fixed trailing comma and parenthesis

  // ------------------ ACTIVITY LOG ------------------
  activityLogs: defineTable({
    userId: v.id("users"),
    action: v.string(),
    details: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // ------------------ SOURCES ------------------
  sources: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  // ------------------ STATES ------------------
  states: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  // ------------------ DISTRICTS ------------------
  districts: defineTable({
    stateId: v.id("states"),
    name: v.string(),
    createdAt: v.number(),
  })
    .index("by_state", ["stateId"])
    .index("by_name", ["name"]),

  // ------------------ PINCODES ------------------
  pincodes: defineTable({
    districtId: v.id("districts"),
    code: v.string(),
    createdAt: v.number(),
  })
    .index("by_district", ["districtId"])
    .index("by_code", ["code"]),

  // ------------------ MISC ------------------
  metadata: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
