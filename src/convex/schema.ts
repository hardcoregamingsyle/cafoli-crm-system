import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const LEAD_STATUS = {
  NEW: "new",
  CONTACTED: "contacted",
  QUALIFIED: "qualified",
  CLOSED: "closed",
  RELEVANT: "relevant",
  NOT_RELEVANT: "not_relevant",
  YET_TO_DECIDE: "yet_to_decide",
};

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  STAFF: "staff",
  USER: "user",
};

export type Role = "admin" | "manager" | "staff" | "user";

export const roleValidator = v.union(
  v.literal("admin"),
  v.literal("manager"),
  v.literal("staff"),
  v.literal("user")
);

export const leadStatusValidator = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("qualified"),
  v.literal("closed"),
  v.literal("relevant"),
  v.literal("not_relevant"),
  v.literal("yet_to_decide")
);

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    role: v.optional(v.string()),
    phone: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("username", ["username"]),

  auditLogs: defineTable({
    userId: v.id("users"),
    action: v.string(),
    timestamp: v.number(),
    details: v.optional(v.string()),
    relatedLeadId: v.optional(v.id("leads")),
  })
    .index("by_userId", ["userId"])
    .index("by_action", ["action"]),

  notifications: defineTable({
    userId: v.id("users"),
    message: v.string(),
    title: v.optional(v.string()),
    read: v.optional(v.boolean()),
    type: v.optional(v.string()),
    relatedLeadId: v.optional(v.id("leads")),
  })
    .index("userId", ["userId"]),

  comments: defineTable({
    leadId: v.id("leads"),
    userId: v.id("users"),
    content: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("leadId", ["leadId"]),

  leads: defineTable({
    name: v.string(),
    email: v.string(),
    mobileNo: v.string(),
    status: v.optional(v.string()),
    state: v.string(),
    serialNo: v.optional(v.number()),
    subject: v.optional(v.string()),
    message: v.optional(v.string()),
    altMobileNo: v.optional(v.string()),
    altEmail: v.optional(v.string()),
    source: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    assignedDate: v.optional(v.number()),
    nextFollowup: v.optional(v.number()),
    station: v.optional(v.string()),
    district: v.optional(v.string()),
    pincode: v.optional(v.string()),
    agencyName: v.optional(v.string()),
    heat: v.optional(v.string()),
    lastActivityTime: v.optional(v.number()),
    unreadCount: v.optional(v.number()),
    lastMessage: v.optional(v.string()),
    lastMessageTime: v.optional(v.number()),
    lastMessageDirection: v.optional(v.string()),
    lastMessageStatus: v.optional(v.string()),
    firstAssignmentDate: v.optional(v.number()),
    reassignmentCount: v.optional(v.number()),
    markedIrrelevantBy: v.optional(v.id("users")),
    markedIrrelevantAt: v.optional(v.number()),
    requiresAdminAssignment: v.optional(v.boolean()),
    wasPreviouslyIrrelevant: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("by_status", ["status"])
    .index("mobileNo", ["mobileNo"])
    .index("assignedTo", ["assignedTo"])
    .index("by_assignedTo_and_assignedDate", ["assignedTo", "assignedDate"])
    .index("by_lastActivityTime", ["lastActivityTime"])
    .index("by_heat", ["heat"]),

  whatsappMessages: defineTable({
    leadId: v.optional(v.id("leads")),
    phoneNumber: v.string(),
    message: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    messageId: v.optional(v.string()),
    status: v.string(), // sent, delivered, read, received, failed
    timestamp: v.number(),
    metadata: v.optional(v.any()),
    mediaType: v.optional(v.string()), // image, video, document, audio
    mediaUrl: v.optional(v.string()),
    mediaId: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    caption: v.optional(v.string()),
    reaction: v.optional(v.string()), // Deprecated: use reactions array
    reactions: v.optional(v.array(v.object({
      from: v.string(), // "inbound" (customer) or "outbound" (business)
      emoji: v.string(),
      timestamp: v.number()
    }))),
    replyToMessageId: v.optional(v.string()),
    replyToBody: v.optional(v.string()),
    replyToSender: v.optional(v.string()),
  })
    .index("by_leadId", ["leadId"])
    .index("by_messageId", ["messageId"])
    .index("by_phoneNumber", ["phoneNumber"]),

  masterdata: defineTable({
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
    isAssigned: v.boolean(),
  })
    .index("by_isAssigned", ["isAssigned"]),

  leadRequests: defineTable({
    requestedBy: v.id("users"),
    requestedByName: v.string(),
    requestedByRole: v.string(),
    numberOfLeads: v.number(),
    status: v.string(),
    processedBy: v.optional(v.id("users")),
    processedAt: v.optional(v.number()),
  })
    .index("by_requestedBy", ["requestedBy"])
    .index("by_status", ["status"]),

  campaigns: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    status: v.string(), // "draft", "active", "paused", "completed"
    recipientIds: v.array(v.id("leads")),
    workflow: v.any(), // JSON structure for the workflow blocks
    subject: v.optional(v.string()), // Legacy field
    body: v.optional(v.string()), // Legacy field
    content: v.optional(v.string()), // Legacy field
  })
    .index("by_createdBy", ["createdBy"])
    .index("by_status", ["status"]),

  pincodeMappings: defineTable({
    pincode: v.string(),
    district: v.optional(v.string()),
    state: v.optional(v.string()),
  })
    .index("pincode", ["pincode"]),

  webhookLogs: defineTable({
    timestamp: v.number(),
    method: v.string(),
    path: v.string(),
    body: v.optional(v.string()),
    headers: v.optional(v.string()),
    ip: v.optional(v.string()),
  }),

  ipLogs: defineTable({
    userId: v.id("users"),
    ip: v.string(),
    timestamp: v.number(),
    action: v.string(),
  })
    .index("by_userId", ["userId"]),

  emailApiKeys: defineTable({
    name: v.string(),
    apiKey: v.string(),
    active: v.boolean(),
    dailyLimit: v.number(),
    sentToday: v.optional(v.number()),
    lastResetAt: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_active", ["active"]),

  emailQueue: defineTable({
    to: v.string(),
    subject: v.string(),
    body: v.optional(v.string()),
    text: v.optional(v.string()),
    status: v.string(),
    attempts: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  })
    .index("by_status", ["status"]),

  systemFlags: defineTable({
    key: v.string(),
    value: v.boolean(),
    usedAt: v.optional(v.number()),
  })
    .index("by_key", ["key"]),

  whatsappTemplates: defineTable({
    name: v.string(),
    language: v.string(),
    category: v.string(),
    subCategory: v.optional(v.string()),
    components: v.any(), // JSON structure for header, body, footer, buttons
    status: v.string(), // "pending", "approved", "rejected", "paused"
    visibility: v.string(), // "public", "private"
    createdBy: v.optional(v.id("users")),
    wabaTemplateId: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_visibility", ["visibility"])
    .index("by_createdBy", ["createdBy"])
    .index("by_name_and_language", ["name", "language"]),

  files: defineTable({
    name: v.string(),
    path: v.string(),
    size: v.number(),
    type: v.string(),
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
    mimeType: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
  })
    .index("by_uploadedBy", ["uploadedBy"])
    .index("by_type", ["type"])
    .index("by_uploadedAt", ["uploadedAt"]),
});