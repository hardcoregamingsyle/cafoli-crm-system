import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Store webhook payload in auditLogs
export const insertLog = internalMutation({
  args: {
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      userId: (await ctx.db.query("users").first())?._id as any, // best-effort placeholder, not used downstream
      action: "WEBHOOK_LOG",
      details: JSON.stringify(args.payload).slice(0, 1024),
      timestamp: Date.now(),
    });
  },
});

// Create a lead from a webhook source (IndiaMART etc.)
export const createLeadFromSource = internalMutation({
  args: {
    name: v.string(),
    subject: v.string(),
    message: v.string(),
    mobileNo: v.string(),
    email: v.string(),
    altMobileNo: v.optional(v.string()),
    altEmail: v.optional(v.string()),
    state: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("leads", {
      name: args.name,
      subject: args.subject,
      message: args.message,
      mobileNo: args.mobileNo,
      email: args.email,
      altMobileNo: args.altMobileNo,
      altEmail: args.altEmail,
      state: args.state,
      status: "yet_to_decide",
      source: args.source,
    });
  },
});
