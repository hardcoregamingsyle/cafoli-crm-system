import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ROLES } from "./schema";
import { internal } from "./_generated/api";

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

// Add phone normalization helper at the top after imports
function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  
  // Remove all non-digit characters (spaces, dashes, parentheses, letters, etc.)
  let digits = phone.replace(/\D/g, "");
  
  if (!digits) return "";
  
  // If number already has country code (more than 10 digits), preserve it
  if (digits.length > 10) {
    // Return with just digits, no + sign
    return digits;
  }
  
  // If exactly 10 digits, add default country code 91
  if (digits.length === 10) {
    return "91" + digits;
  }
  
  // For shorter numbers, still add 91 prefix
  return "91" + digits;
}

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
    assigneeName: v.optional(v.string()),
    state: v.string(),
    station: v.optional(v.string()),
    district: v.optional(v.string()),
    pincode: v.optional(v.string()),
    agencyName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Normalize phone numbers
    const mobile = normalizePhoneNumber(args.mobileNo || "");
    const altMobile = args.altMobileNo ? normalizePhoneNumber(args.altMobileNo) : undefined;

    // Resolve incoming assigneeId if provided
    let incomingAssigneeId: any = null;
    const targetName = (args.assigneeName ?? "").trim().toLowerCase();
    if (targetName) {
      try {
        const byUsername = await ctx.db
          .query("users")
          .withIndex("username", (q: any) => q.eq("username", args.assigneeName))
          .unique();
        if (byUsername?._id) {
          incomingAssigneeId = byUsername._id;
        } else {
          const allUsers = await ctx.db.query("users").collect();
          const found = allUsers.find((u: any) => {
            const nm = String(u.name ?? "").trim().toLowerCase();
            const un = String(u.username ?? "").trim().toLowerCase();
            return nm === targetName || un === targetName;
          });
          if (found?._id) incomingAssigneeId = found._id;
        }
      } catch {
        // ignore lookup errors; keep unassigned if unresolved
      }
    }

    // Normalize and ignore placeholder email for dedup
    const rawEmail = (args.email || "").trim().toLowerCase();
    const emailForDedup = rawEmail && rawEmail !== "unknown@example.com" ? rawEmail : "";

    // Dedup by mobile or email (skip placeholder/empty email)
    const byMobile = mobile
      ? await ctx.db
          .query("leads")
          .withIndex("mobileNo", (q: any) => q.eq("mobileNo", mobile))
          .unique()
      : null;

    const existing =
      byMobile ||
      (emailForDedup
        ? await ctx.db
            .query("leads")
            .withIndex("email", (q: any) => q.eq("email", emailForDedup))
            .unique()
        : null);

    // Check if existing lead is marked as not relevant - skip if so
    if (existing && existing.status === "not_relevant") {
      return false;
    }

    if (existing) {
      // Club fields into existing with concatenation
      const patch: Record<string, any> = {};
      
      if (!existing.name && args.name) patch.name = args.name;
      
      // Concatenate subject if different
      if (args.subject && existing.subject !== args.subject) {
        patch.subject = existing.subject ? `${existing.subject} & ${args.subject}` : args.subject;
      }
      
      // Concatenate message if different
      if (args.message && existing.message !== args.message) {
        patch.message = existing.message ? `${existing.message} & ${args.message}` : args.message;
      }
      
      if (!existing.altEmail && args.altEmail) patch.altEmail = args.altEmail;
      if (!existing.altMobileNo && altMobile) patch.altMobileNo = altMobile;
      if (!existing.state && args.state) patch.state = args.state;
      if (!existing.source && args.source) patch.source = args.source;
      if (!existing.station && args.station) patch.station = args.station;
      if (!existing.district && args.district) patch.district = args.district;
      if (!existing.pincode && args.pincode) patch.pincode = args.pincode;
      if (!existing.agencyName && args.agencyName) patch.agencyName = args.agencyName;
      if (args.serialNo && !existing.serialNo) patch.serialNo = args.serialNo;

      // Assignment rule
      if (incomingAssigneeId && !existing.assignedTo) {
        patch.assignedTo = incomingAssigneeId;
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }

      // Add comment about duplicate lead posting
      if (Object.keys(patch).length > 0) {
        const loggingUserId = await ensureLoggingUserId(ctx);
        await ctx.db.insert("comments", {
          leadId: existing._id,
          userId: loggingUserId,
          content: "The Lead was Posted again",
          timestamp: Date.now(),
        });
      }

      // Notify assignees
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
      if (incomingAssigneeId && !existing.assignedTo && patch.assignedTo) {
        await ctx.db.insert("notifications", {
          userId: incomingAssigneeId,
          title: "Lead Assigned",
          message: "A lead has been assigned to you from Google Script import.",
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
      return false;
    }

    // Insert new lead with normalized phone
    await ctx.db.insert("leads", {
      serialNo: args.serialNo,
      source: args.source || "google_script",
      name: args.name,
      subject: args.subject,
      email: rawEmail,
      mobileNo: mobile,
      message: args.message,
      altEmail: args.altEmail,
      altMobileNo: altMobile,
      state: args.state,
      station: args.station,
      district: args.district,
      pincode: args.pincode,
      agencyName: args.agencyName,
      assignedTo: incomingAssigneeId || undefined,
      status: "yet_to_decide",
      lastActivityTime: Date.now(),
      unreadCount: 0,
    });

    // NEW: Send welcome email immediately if email is valid
    try {
      const emailToSend = rawEmail.trim().toLowerCase();
      if (emailToSend && emailToSend !== "unknown@example.com") {
        await ctx.scheduler.runAfter(0, (internal as any).emails.sendRelevant, { to: emailToSend });
      }
    } catch {
      // Do not block lead creation on email errors
    }

    // NEW: Send WhatsApp welcome template message if mobile number is valid
    try {
      if (mobile && mobile.length >= 10) {
        await ctx.scheduler.runAfter(0, internal.whatsapp.sendTemplateMessageInternal, {
          phoneNumber: mobile,
          templateName: "cafoliwelcomemessage",
          languageCode: "en",
        });
      }
    } catch {
      // Do not block lead creation on WhatsApp errors
    }

    return true;
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
    // Normalize phone numbers
    const mobile = normalizePhoneNumber(args.mobileNo || "");
    const altMobile = args.altMobileNo ? normalizePhoneNumber(args.altMobileNo) : undefined;

    // Normalize and ignore placeholder email for dedup
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

    // Check if existing lead is marked as not relevant - skip if so
    if (existing && existing.status === "not_relevant") {
      return false;
    }

    if (existing) {
      // Club fields into existing with concatenation
      const patch: Record<string, any> = {};
      
      if (!existing.name && args.name) patch.name = args.name;
      
      // Concatenate subject if different
      if (args.subject && existing.subject !== args.subject) {
        patch.subject = existing.subject ? `${existing.subject} & ${args.subject}` : args.subject;
      }
      
      // Concatenate message if different
      if (args.message && existing.message !== args.message) {
        patch.message = existing.message ? `${existing.message} & ${args.message}` : args.message;
      }
      
      if (!existing.altMobileNo && altMobile) patch.altMobileNo = altMobile;
      if (!existing.altEmail && args.altEmail) patch.altEmail = args.altEmail;
      if (!existing.state && args.state) patch.state = args.state;
      if (!existing.source && args.source) patch.source = args.source;

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }

      // Add comment about duplicate lead posting
      if (Object.keys(patch).length > 0) {
        const loggingUserId = await ensureLoggingUserId(ctx);
        await ctx.db.insert("comments", {
          leadId: existing._id,
          userId: loggingUserId,
          content: "The Lead was Posted again",
          timestamp: Date.now(),
        });
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
      return false;
    }

    // Insert new lead with normalized phone
    await ctx.db.insert("leads", {
      name: args.name,
      subject: args.subject,
      message: args.message,
      mobileNo: mobile,
      email: rawEmail,
      altMobileNo: altMobile,
      altEmail: args.altEmail,
      state: args.state,
      status: "yet_to_decide",
      source: args.source,
      lastActivityTime: Date.now(),
      unreadCount: 0,
    });

    // NEW: Send welcome email immediately if email is valid
    try {
      const emailToSend = rawEmail.trim().toLowerCase();
      if (emailToSend && emailToSend !== "unknown@example.com") {
        await ctx.scheduler.runAfter(0, (internal as any).emails.sendRelevant, { to: emailToSend });
      }
    } catch {
      // Do not block lead creation on email errors
    }

    // NEW: Send WhatsApp welcome template message if mobile number is valid
    try {
      if (mobile && mobile.length >= 10) {
        await ctx.scheduler.runAfter(0, internal.whatsapp.sendTemplateMessageInternal, {
          phoneNumber: mobile,
          templateName: "cafoliwelcomemessage",
          languageCode: "en",
        });
      }
    } catch (whatsappError: any) {
      // Log but don't block lead creation
      console.error("[Webhook] WhatsApp welcome message failed:", whatsappError?.message || whatsappError);
    }

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
        const source = "webhook";

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
          lastActivityTime: Date.now(),
          unreadCount: 0,
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

// Add mutation to store WhatsApp messages
export const storeWhatsAppMessage = internalMutation({
  args: {
    phoneNumber: v.string(),
    message: v.string(),
    messageId: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Normalize phone number using the shared helper
    const normalizedPhone = normalizePhoneNumber(args.phoneNumber);

    // Try to find matching lead by phone number
    const allLeads = await ctx.db.query("leads").collect();
    let matchingLead = allLeads.find(
      (lead) => {
        const leadMobile = normalizePhoneNumber(lead.mobileNo || "");
        const leadAltMobile = normalizePhoneNumber(lead.altMobileNo || "");
        const incomingPhone = normalizedPhone.slice(-10); // Last 10 digits
        
        return leadMobile.includes(incomingPhone) || leadAltMobile.includes(incomingPhone);
      }
    );

    // If no matching lead found, create a new one
    if (!matchingLead) {
      console.log(`[WhatsApp] Creating new lead for phone: ${normalizedPhone}`);
      
      const newLeadId = await ctx.db.insert("leads", {
        name: `WhatsApp Customer ${normalizedPhone.slice(-4)}`,
        email: "unknown@example.com",
        mobileNo: normalizedPhone,
        subject: "WhatsApp Inquiry",
        message: args.message,
        state: "Unknown",
        status: "new",
        source: "whatsapp",
        lastActivityTime: Date.now(),
        unreadCount: 1,
      });

      // Fetch the newly created lead
      const newLead = await ctx.db.get(newLeadId);
      if (!newLead) {
        throw new Error("Failed to retrieve newly created lead");
      }
      matchingLead = newLead;

      // Log the lead creation
      const loggingUserId = await ensureLoggingUserId(ctx);
      await ctx.db.insert("auditLogs", {
        userId: loggingUserId,
        action: "CREATE_LEAD_FROM_WHATSAPP",
        details: `New lead created from WhatsApp message: ${normalizedPhone}`,
        timestamp: Date.now(),
        relatedLeadId: newLeadId,
      });

      // Create notification for admins
      const adminUsers = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", ROLES.ADMIN))
        .collect();

      for (const admin of adminUsers) {
        await ctx.db.insert("notifications", {
          userId: admin._id,
          title: "New WhatsApp Lead",
          message: `A new lead was created from WhatsApp: ${normalizedPhone}`,
          read: false,
          type: "lead_assigned",
          relatedLeadId: newLeadId,
        });
      }
    }

    // Store the message
    await ctx.db.insert("whatsappMessages", {
      leadId: matchingLead?._id,
      phoneNumber: normalizedPhone,
      message: args.message,
      direction: "inbound",
      messageId: args.messageId,
      status: "received",
      timestamp: Date.now(),
      metadata: args.metadata,
    });

    // Update lastActivityTime for the lead
    if (matchingLead) {
      const currentUnread = matchingLead.unreadCount || 0;
      await ctx.db.patch(matchingLead._id, {
        lastActivityTime: Date.now(),
        unreadCount: currentUnread + 1,
      });
    }

    // Add comment to lead
    if (matchingLead) {
      const loggingUserId = await ensureLoggingUserId(ctx);
      await ctx.db.insert("comments", {
        leadId: matchingLead._id,
        userId: loggingUserId,
        content: `WhatsApp message received: ${args.message}`,
        timestamp: Date.now(),
      });
    }

    return { success: true, leadId: matchingLead?._id, created: !allLeads.find(l => l._id === matchingLead?._id) };
  },
});

// Update WhatsApp message status (delivered, read, etc.)
export const updateWhatsAppMessageStatus = internalMutation({
  args: {
    messageId: v.string(),
    status: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (message) {
      await ctx.db.patch(message._id, {
        status: args.status,
        metadata: { ...message.metadata, ...args.metadata },
      });
    }
  },
});