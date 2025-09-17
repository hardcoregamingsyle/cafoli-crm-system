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
    // Dedup by mobile or email
    const byMobile = args.mobileNo
      ? await ctx.db
          .query("leads")
          .withIndex("mobileNo", (q) => q.eq("mobileNo", args.mobileNo))
          .unique()
      : null;

    const existing =
      byMobile ||
      (args.email
        ? await ctx.db
            .query("leads")
            .withIndex("email", (q) => q.eq("email", args.email))
            .unique()
        : null);

    if (existing) {
      // Club fields into existing
      const patch: Record<string, any> = {};
      if (!existing.name && args.name) patch.name = args.name;
      if (!existing.subject && args.subject) patch.subject = args.subject;
      if (!existing.message && args.message) patch.message = args.message;
      if (!existing.altMobileNo && args.altMobileNo) patch.altMobileNo = args.altMobileNo;
      if (!existing.altEmail && args.altEmail) patch.altEmail = args.altEmail;
      if (!existing.state && args.state) patch.state = args.state;
      if (!existing.source && args.source) patch.source = args.source;

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }

      // If it had an assignee, notify them
      if (existing.assignedTo) {
        await ctx.db.insert("notifications", {
          userId: existing.assignedTo,
          title: "Duplicate Lead Clubbed",
          message: `A webhook lead (source: ${args.source || "unknown"}) was clubbed into your assigned lead.`,
          read: false,
          type: "lead_assigned",
          relatedLeadId: existing._id,
        });
      }

      await ctx.db.insert("auditLogs", {
        userId: (await ctx.db.query("users").first())?._id as any,
        action: "CLUB_DUPLICATE_LEAD",
        details: `Webhook clubbed into existing lead ${existing._id}`,
        timestamp: Date.now(),
        relatedLeadId: existing._id,
      });
      return;
    }

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