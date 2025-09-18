import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ROLES } from "./schema";

// Add: helper to ensure a valid userId always exists for logging
async function ensureLoggingUserId(ctx: any) {
  // Try Owner by username first (fast via index)
  const ownerExisting = await ctx.db
    .query("users")
    .withIndex("username", (q: any) => q.eq("username", "Owner"))
    .unique();
  if (ownerExisting?._id) return ownerExisting._id;

  // Fallback: any existing user
  const anyUsers = await ctx.db.query("users").collect();
  if (anyUsers.length > 0) return anyUsers[0]._id;

  // Create Owner if not present
  const ownerId = await ctx.db.insert("users", {
    name: "Owner",
    username: "Owner",
    password: "Belive*8",
    role: ROLES.ADMIN,
  });
  return ownerId;
}

// Expose an internal mutation to ensure a logging/admin user exists and return its id
export const ensureLoggingUser = internalMutation({
  args: {},
  handler: async (ctx) => {
    const id = await ensureLoggingUserId(ctx);
    return id;
  },
});

// Store webhook payload in auditLogs
export const insertLog = internalMutation({
  args: {
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    // Resolve a guaranteed valid userId for logging
    const loggingUserId = await ensureLoggingUserId(ctx);

    // Store full payload (avoid truncation to keep JSON parseable later)
    const details = (() => {
      try {
        return JSON.stringify(args.payload);
      } catch {
        return String(args.payload);
      }
    })();

    await ctx.db.insert("auditLogs", {
      userId: loggingUserId,
      action: "WEBHOOK_LOG",
      details,
      timestamp: Date.now(),
    });
  },
});

// Create a lead from Google Script data with new column structure
export const createLeadFromGoogleScript = internalMutation({
  args: {
    serialNo: v.optional(v.number()),
    source: v.optional(v.string()),
    name: v.string(),
    subject: v.string(),
    email: v.string(),
    mobileNo: v.string(),
    message: v.string(),
    altEmail: v.optional(v.string()),
    altMobileNo: v.optional(v.string()),
    state: v.string(),
    station: v.optional(v.string()),
    district: v.optional(v.string()),
    pincode: v.optional(v.string()),
    agencyName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Normalize and ignore placeholder email for dedup
    const mobile = (args.mobileNo || "").trim();
    const rawEmail = (args.email || "").trim().toLowerCase();
    const emailForDedup = rawEmail && rawEmail !== "unknown@example.com" ? rawEmail : "";

    // Dedup by mobile or email (skip placeholder/empty email)
    const byMobile = mobile
      ? await ctx.db
          .query("leads")
          .withIndex("mobileNo", (q) => q.eq("mobileNo", mobile))
          .unique()
      : null;

    const existing =
      byMobile ||
      (emailForDedup
        ? await ctx.db
            .query("leads")
            .withIndex("email", (q) => q.eq("email", emailForDedup))
            .unique()
        : null);

    if (existing) {
      // Club fields into existing
      const patch: Record<string, any> = {};
      if (!existing.name && args.name) patch.name = args.name;
      if (!existing.subject && args.subject) patch.subject = args.subject;
      if (!existing.message && args.message) patch.message = args.message;
      if (!existing.altEmail && args.altEmail) patch.altEmail = args.altEmail;
      if (!existing.altMobileNo && args.altMobileNo) patch.altMobileNo = args.altMobileNo;
      if (!existing.state && args.state) patch.state = args.state;
      if (!existing.source && args.source) patch.source = args.source;
      if (!existing.station && args.station) patch.station = args.station;
      if (!existing.district && args.district) patch.district = args.district;
      if (!existing.pincode && args.pincode) patch.pincode = args.pincode;
      if (!existing.agencyName && args.agencyName) patch.agencyName = args.agencyName;
      if (args.serialNo && !existing.serialNo) patch.serialNo = args.serialNo;

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }

      // If it had an assignee, notify them
      if (existing.assignedTo) {
        await ctx.db.insert("notifications", {
          userId: existing.assignedTo,
          title: "Duplicate Lead Clubbed",
          message: `A Google Script lead (source: ${args.source || "unknown"}) was clubbed into your assigned lead.`,
          read: false,
          type: "lead_assigned",
          relatedLeadId: existing._id,
        });
      }

      await ctx.db.insert("auditLogs", {
        userId: await ensureLoggingUserId(ctx),
        action: "CLUB_DUPLICATE_LEAD",
        details: `Google Script clubbed into existing lead ${existing._id}`,
        timestamp: Date.now(),
        relatedLeadId: existing._id,
      });
      // Return explicit result for caller
      return false;
    }

    // Insert new lead with new structure
    await ctx.db.insert("leads", {
      serialNo: args.serialNo,
      source: args.source || "google_script",
      name: args.name,
      subject: args.subject,
      email: rawEmail,
      mobileNo: mobile,
      message: args.message,
      altEmail: args.altEmail,
      altMobileNo: args.altMobileNo,
      state: args.state,
      station: args.station,
      district: args.district,
      pincode: args.pincode,
      agencyName: args.agencyName,
      status: "yet_to_decide",
    });
    // Return explicit creation result
    return true;
  },
});

// Create a lead from a webhook source (IndiaMART etc.) - keeping for backward compatibility
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
    // Normalize and ignore placeholder email for dedup
    const mobile = (args.mobileNo || "").trim();
    const rawEmail = (args.email || "").trim().toLowerCase();
    const emailForDedup = rawEmail && rawEmail !== "unknown@example.com" ? rawEmail : "";

    // Dedup by mobile or email (skip placeholder/empty email)
    const byMobile = mobile
      ? await ctx.db
          .query("leads")
          .withIndex("mobileNo", (q) => q.eq("mobileNo", mobile))
          .unique()
      : null;

    const existing =
      byMobile ||
      (emailForDedup
        ? await ctx.db
            .query("leads")
            .withIndex("email", (q) => q.eq("email", emailForDedup))
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
        userId: await ensureLoggingUserId(ctx),
        action: "CLUB_DUPLICATE_LEAD",
        details: `Webhook clubbed into existing lead ${existing._id}`,
        timestamp: Date.now(),
        relatedLeadId: existing._id,
      });
      // Return explicit result for caller
      return false;
    }

    // Insert new lead (store placeholder email as-is or leave empty if you prefer)
    await ctx.db.insert("leads", {
      name: args.name,
      subject: args.subject,
      message: args.message,
      mobileNo: mobile,
      email: rawEmail,
      altMobileNo: args.altMobileNo,
      altEmail: args.altEmail,
      state: args.state,
      status: "yet_to_decide",
      source: args.source,
    });
    // Return explicit creation result
    return true;
  },
});

// Admin-only: Import leads from stored webhook logs
export const importFromWebhookLogs = mutation({
  args: {
    currentUserId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }

    const limit = args.limit ?? 500;

    // Load latest WEBHOOK_LOG entries
    const all = await ctx.db.query("auditLogs").collect();
    const logs = all
      .filter((l) => l.action === "WEBHOOK_LOG")
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    let created = 0;
    let clubbed = 0;
    let skipped = 0;

    // Helpers
    const sanitizeJsonLikeString = (input: string): string =>
      input.replace(/,\s*([}\]])/g, "$1");

    const fallback = (obj: any, keys: string[], def: string) => {
      for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null && `${v}`.trim().length > 0) {
          return `${v}`.trim();
        }
      }
      return def;
    };

    const findDuplicateLead = async (mobileNo: string, email: string) => {
      const byMobile = mobileNo
        ? await ctx.db.query("leads").withIndex("mobileNo", (q) => q.eq("mobileNo", mobileNo)).unique()
        : null;
      if (byMobile) return byMobile;

      const byEmail = email
        ? await ctx.db.query("leads").withIndex("email", (q) => q.eq("email", email)).unique()
        : null;

      return byEmail;
    };

    for (const log of logs) {
      try {
        const str = String(log.details ?? "");
        if (!str) {
          skipped++;
          continue;
        }

        let payload: any = null;
        try {
          payload = JSON.parse(str);
        } catch {
          try {
            payload = JSON.parse(sanitizeJsonLikeString(str));
          } catch {
            skipped++;
            continue;
          }
        }

        // Our http router logs look like: { method, url?, parsed? } or arbitrary payloads
        const r = payload?.parsed ?? payload ?? {};
        const name = fallback(r, ["SENDER_NAME", "name", "fullName"], "Unknown");
        const subject = fallback(r, ["SUBJECT", "subject"], "Lead from IndiaMART");
        const message = fallback(r, ["QUERY_MESSAGE", "message", "msg", "body"], "");
        const mobileNo = fallback(r, ["SENDER_MOBILE", "SENDER_PHONE", "mobileNo", "mobile", "phone"], "");
        const email = fallback(r, ["SENDER_EMAIL", "email"], "unknown@example.com");
        const altMobileNo = fallback(r, ["SENDER_MOBILE_ALT", "SENDER_PHONE_ALT", "altMobileNo", "altMobile", "altPhone"], "");
        const altEmail = fallback(r, ["SENDER_EMAIL_ALT", "altEmail"], "");
        const state = fallback(r, ["SENDER_STATE", "state", "region"], "Unknown");
        const source = "indiamart";

        // Require at least a mobile or an email to be useful
        if (!mobileNo && !email) {
          skipped++;
          continue;
        }

        const existing = await findDuplicateLead(mobileNo, email);
        if (existing) {
          // Club into existing
          const patch: Record<string, any> = {};
          if (!existing.name && name) patch.name = name;
          if (!existing.subject && subject) patch.subject = subject;
          if (!existing.message && message) patch.message = message;
          if (!existing.altMobileNo && altMobileNo) patch.altMobileNo = altMobileNo;
          if (!existing.altEmail && altEmail) patch.altEmail = altEmail;
          if (!existing.state && state) patch.state = state;
          if (!existing.source && source) patch.source = source;

          if (Object.keys(patch).length > 0) {
            await ctx.db.patch(existing._id, patch);
          }
          // Notify assignee if present
          if (existing.assignedTo) {
            await ctx.db.insert("notifications", {
              userId: existing.assignedTo,
              title: "Duplicate Lead Clubbed",
              message: `A webhook lead (source: ${source}) was clubbed into your assigned lead.`,
              read: false,
              type: "lead_assigned",
              relatedLeadId: existing._id,
            });
          }

          await ctx.db.insert("auditLogs", {
            userId: currentUser._id,
            action: "CLUB_DUPLICATE_LEAD",
            details: `Import from logs clubbed into existing lead ${existing._id}`,
            timestamp: Date.now(),
            relatedLeadId: existing._id,
          });

          clubbed++;
          continue;
        }

        // Create new lead
        await ctx.db.insert("leads", {
          name,
          subject,
          message,
          mobileNo,
          email,
          altMobileNo: altMobileNo || undefined,
          altEmail: altEmail || undefined,
          state,
          status: "yet_to_decide",
          source,
        });

        created++;
      } catch {
        skipped++;
      }
    }

    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "IMPORT_WEBHOOK_QUERIES",
      details: `Imported=${created}, clubbed=${clubbed}, skipped=${skipped} from webhook logs`,
      timestamp: Date.now(),
    });

    return { created, clubbed, skipped };
  },
});