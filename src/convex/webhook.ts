import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Add phone normalization helper
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

const SYSTEM_LOGGER_USERNAME = "system_logger";

async function getOrCreateLoggingUserId(ctx: any) {
  const existingSystemUser = await ctx.db
    .query("users")
    .withIndex("username", (q: any) => q.eq("username", SYSTEM_LOGGER_USERNAME))
    .take(1);

  if (existingSystemUser[0]?._id) {
    return existingSystemUser[0]._id;
  }

  const admins = await ctx.db
    .query("users")
    .withIndex("by_role", (q: any) => q.eq("role", "admin"))
    .take(1);

  if (admins[0]?._id) {
    return admins[0]._id;
  }

  return await ctx.db.insert("users", {
    name: "System Logger",
    username: SYSTEM_LOGGER_USERNAME,
    role: "admin",
    createdAt: Date.now(),
  });
}

// Helper to ensure we have a userId for logging
async function ensureLoggingUserId(ctx: any) {
  return getOrCreateLoggingUserId(ctx);
}

export const ensureLoggingUser = internalMutation({
  args: {},
  handler: async (ctx) => {
    return getOrCreateLoggingUserId(ctx);
  },
});

// Add the missing importFromWebhookLogs mutation
export const importFromWebhookLogs = internalMutation({
  args: {
    currentUserId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify user is admin
    const user = await ctx.db.get(args.currentUserId);
    if (!user || user.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    const maxLimit = Math.min(args.limit || 500, 1000);
    
    // Get webhook logs
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_action", (q) => q.eq("action", "WEBHOOK_LOG"))
      .order("desc")
      .take(maxLimit);

    let created = 0;
    let clubbed = 0;
    let skipped = 0;

    for (const log of logs) {
      try {
        const details = JSON.parse(log.details || "{}");
        const payload = details.payload;

        if (!payload) {
          skipped++;
          continue;
        }

        // Try to identify the source and process accordingly
        if (payload.type === "INDIAMART_WEBHOOK" || payload.SENDER_NAME || payload.RESPONSE?.SENDER_NAME) {
          const response = payload.RESPONSE || payload.data || payload;
          const name = response.SENDER_NAME || "Unknown";
          const subject = response.SUBJECT || response.QUERY_SUBJECT || "Lead from Indiamart";
          const message = response.QUERY_MESSAGE || response.MESSAGE || "";
          const mobileNo = response.SENDER_MOBILE || response.MOBILE || "";
          const email = response.SENDER_EMAIL || response.EMAIL || "unknown@example.com";
          const state = response.SENDER_STATE || response.STATE || "Unknown";

          const nextSerial = await getNextSerialNumber(ctx);
          const result = await ctx.db.insert("leads", {
            serialNo: nextSerial,
            name,
            subject,
            message,
            mobileNo: normalizePhoneNumber(mobileNo),
            email,
            state,
            source: "indiamart",
            status: "yet_to_decide",
            heat: "cold",
            lastActivityTime: Date.now(),
          });

          if (result) created++;
          else clubbed++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error("Error processing webhook log:", err);
        skipped++;
      }
    }

    return {
      success: true,
      processed: logs.length,
      created,
      clubbed,
      skipped,
    };
  },
});

export const insertLog = internalMutation({
  args: {
    payload: v.any(),
    method: v.optional(v.string()),
    path: v.optional(v.string()),
    ip: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getOrCreateLoggingUserId(ctx);
    const details = JSON.stringify({
      method: args.method ?? null,
      path: args.path ?? null,
      ip: args.ip ?? null,
      payload: args.payload,
    });

    await ctx.db.insert("auditLogs", {
      userId,
      action: "WEBHOOK_LOG",
      timestamp: Date.now(),
      details,
    });

    return { success: true };
  },
});

export const fetchGoogleScriptLeads = internalAction({
  args: {},
  handler: async (ctx) => {
    const googleScriptUrl = "https://script.google.com/macros/s/AKfycbxKrR7SZjO_DhJwJhguvAmnejgddGydFEvJSdsnmV-hl1UQMINjWNQ-dxJRNT155m-H/exec";
    
    try {
      console.log(`[Google Script] Fetching leads from Google Spreadsheet`);
      
      // Google Apps Script requires following redirects
      const response = await fetch(googleScriptUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.error(`[Google Script] HTTP error! status: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      console.log(`[Google Script] Response content-type: ${contentType}`);
      
      const data = await response.json();
      console.log(`[Google Script] Received data:`, JSON.stringify(data).substring(0, 500));
      
      // Process the leads data - adjust based on actual API response structure
      if (Array.isArray(data)) {
        let created = 0;
        let clubbed = 0;
        
        for (const item of data) {
          try {
            // Helper to safely convert to string or undefined
            const safeString = (val: any) => (val !== undefined && val !== null && val !== "") ? String(val) : undefined;
            const safeStringReq = (val: any, def: string) => (val !== undefined && val !== null && val !== "") ? String(val) : def;
            const safeNumber = (val: any) => {
              if (val === undefined || val === null || val === "") return undefined;
              const n = Number(val);
              return isNaN(n) ? undefined : n;
            };

            const result = await ctx.runMutation(internal.webhook.createLeadFromGoogleScript, {
              serialNo: safeNumber(item.serialNo || item.serial_no),
              source: safeStringReq(item.source, "Google Script"),
              name: safeStringReq(item.name, "Unknown"),
              subject: safeStringReq(item.subject, "Google Script Lead"),
              email: safeStringReq(item.email, "unknown@example.com"),
              mobileNo: safeStringReq(item.mobileNo || item.mobile || item.phone, ""),
              message: safeStringReq(item.message || item.description, ""),
              altEmail: safeString(item.altEmail || item.alt_email),
              altMobileNo: safeString(item.altMobileNo || item.alt_mobile || item.alt_phone),
              assigneeName: safeString(item.assigneeName || item.assignee_name || item.assignee),
              state: safeStringReq(item.state, ""),
              station: safeString(item.station),
              district: safeString(item.district),
              pincode: safeString(item.pincode || item.pin_code),
              agencyName: safeString(item.agencyName || item.agency_name),
            });
            
            if (result) {
              created++;
            } else {
              clubbed++;
            }
          } catch (err) {
            console.error(`[Google Script] Error processing item:`, item, err);
          }
        }
        
        console.log(`[Google Script] Successfully processed ${created} new leads, ${clubbed} clubbed`);
        return { success: true, created, clubbed };
      } else {
        console.log(`[Google Script] Unexpected response format:`, data);
        return { success: false, error: "Unexpected response format" };
      }
    } catch (error: any) {
      console.error(`[Google Script] Error fetching leads:`, error);
      return { success: false, error: error.message };
    }
  },
});

// Fetch leads from Pharmavends API
export const fetchPharmavendsLeads = internalAction({
  args: {},
  handler: async (ctx) => {
    const pharmavendsUrl = "https://pharmavends.net/api/company-profile?apitoken=RgX9pgJT07mcSX9zp3BmjAH6pdlG6oWhM2tZi4BvnU9TwQV1VG";
    
    try {
      console.log(`[Pharmavends] Fetching leads from Pharmavends API`);
      
      const response = await fetch(pharmavendsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.error(`[Pharmavends] HTTP error! status: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[Pharmavends] Received data:`, JSON.stringify(data).substring(0, 500));
      
      // Process the leads data from purchased_leads array
      if (data.status === "true" && Array.isArray(data.purchased_leads)) {
        let created = 0;
        let clubbed = 0;
        
        for (const item of data.purchased_leads) {
          try {
            // Helper to safely convert to string or undefined
            const safeString = (val: any) => (val !== undefined && val !== null && val !== "") ? String(val) : undefined;
            const safeStringReq = (val: any, def: string) => (val !== undefined && val !== null && val !== "") ? String(val) : def;

            const result = await ctx.runMutation(internal.webhook.createLeadFromPharmavends, {
              uid: item.uid,
              name: safeStringReq(item.name, "Unknown"),
              companyName: safeString(item.companyname),
              email: safeStringReq(item.email, "unknown@example.com"),
              contactNo: safeStringReq(item.ContactNo, ""),
              whatsApp: safeString(item.WhatsApp),
              location: safeString(item.Location),
              state: safeStringReq(item.State, ""),
              pincode: safeString(item.Pincode),
              description: safeStringReq(item.Description, ""),
              gstNo: safeString(item.GStNo),
              drugLicence: safeString(item.DrugLiencence),
              receivedOn: safeString(item.Receivedon),
              requirementType: safeString(item.Requirmenttype),
              timeToCall: safeString(item.Timetocall),
              profession: safeString(item.Profession),
              experience: safeString(item.Experience),
            });
            
            if (result) {
              created++;
            } else {
              clubbed++;
            }
          } catch (err) {
            console.error(`[Pharmavends] Error processing item:`, item, err);
          }
        }
        
        console.log(`[Pharmavends] Successfully processed ${created} new leads, ${clubbed} clubbed`);
        return { success: true, created, clubbed };
      } else {
        console.log(`[Pharmavends] Unexpected response format:`, data);
        return { success: false, error: "Unexpected response format" };
      }
    } catch (error: any) {
      console.error(`[Pharmavends] Error fetching leads:`, error);
      return { success: false, error: error.message };
    }
  },
});

// Helper to get next serial number
async function getNextSerialNumber(ctx: any): Promise<number> {
  const allLeads = await ctx.db.query("leads").collect();
  if (allLeads.length === 0) return 1;
  
  const maxSerial = Math.max(...allLeads.map((l: any) => l.serialNo || 0));
  return maxSerial + 1;
}

// Add mutation to update WhatsApp message status
export const updateWhatsAppMessageStatus = internalMutation({
  args: {
    messageId: v.string(),
    status: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Find the message by messageId
    const message = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (!message) {
      console.log(`[WhatsApp] Message ${args.messageId} not found for status update`);
      return { success: false, error: "Message not found" };
    }

    // Update the message status
    await ctx.db.patch(message._id, {
      status: args.status,
      metadata: args.metadata,
    });

    // If message is associated with a lead, update lead's last message status
    if (message.leadId && message.direction === "outbound") {
      await ctx.db.patch(message.leadId, {
        lastMessageStatus: args.status,
        lastActivityTime: Date.now(),
      });

      // If status is "read", mark lead as having read messages
      if (args.status === "read") {
        const lead = await ctx.db.get(message.leadId);
        if (lead?.assignedTo) {
          // Notify the assigned user that their message was read
          await ctx.db.insert("notifications", {
            userId: lead.assignedTo,
            title: "Message Read",
            message: `Your WhatsApp message to ${lead.name} was read`,
            read: false,
            type: "message_read",
            relatedLeadId: message.leadId,
          });
        }
      }
    }

    console.log(`[WhatsApp] Updated message ${args.messageId} status to ${args.status}`);
    return { success: true };
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

    // Create new lead
    const nextSerial = await getNextSerialNumber(ctx);
    const leadId = await ctx.db.insert("leads", {
      serialNo: args.serialNo || nextSerial,
      source: args.source || "Google Script",
      name: args.name,
      subject: args.subject,
      email: rawEmail,
      mobileNo: mobile,
      message: args.message,
      altEmail: args.altEmail,
      altMobileNo: altMobile,
      assignedTo: incomingAssigneeId,
      state: args.state,
      station: args.station,
      district: args.district,
      pincode: args.pincode,
      agencyName: args.agencyName,
      status: "yet_to_decide",
      heat: "cold",
      lastActivityTime: Date.now(),
    });

    // Notify assignee
    if (incomingAssigneeId) {
      await ctx.db.insert("notifications", {
        userId: incomingAssigneeId,
        title: "New Lead Assigned",
        message: "A new lead has been assigned to you from Google Script import.",
        read: false,
        type: "lead_assigned",
        relatedLeadId: leadId,
      });
    }

    await ctx.db.insert("auditLogs", {
      userId: await ensureLoggingUserId(ctx),
      action: "CREATE_LEAD",
      details: `Google Script created new lead ${leadId}`,
      timestamp: Date.now(),
      relatedLeadId: leadId,
    });

    return true;
  },
});

// Create a lead from Pharmavends data
export const createLeadFromPharmavends = internalMutation({
  args: {
    uid: v.number(),
    name: v.string(),
    companyName: v.optional(v.string()),
    email: v.string(),
    contactNo: v.string(),
    whatsApp: v.optional(v.string()),
    location: v.optional(v.string()),
    state: v.string(),
    pincode: v.optional(v.string()),
    description: v.string(),
    gstNo: v.optional(v.string()),
    drugLicence: v.optional(v.string()),
    receivedOn: v.optional(v.string()),
    requirementType: v.optional(v.string()),
    timeToCall: v.optional(v.string()),
    profession: v.optional(v.string()),
    experience: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Normalize phone numbers
    const mobile = normalizePhoneNumber(args.contactNo || "");
    const altMobile = args.whatsApp ? normalizePhoneNumber(args.whatsApp) : undefined;

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

    // Build subject and message from Pharmavends data
    const subject = `Pharmavends Lead - ${args.profession || "Inquiry"} - ${args.location || args.state}`;
    const messageParts = [
      args.description,
      args.companyName ? `Company: ${args.companyName}` : null,
      args.profession ? `Profession: ${args.profession}` : null,
      args.experience ? `Experience: ${args.experience}` : null,
      args.requirementType ? `Requirement: ${args.requirementType}` : null,
      args.timeToCall ? `Best time to call: ${args.timeToCall}` : null,
      args.gstNo ? `GST: ${args.gstNo}` : null,
      args.drugLicence ? `Drug Licence: ${args.drugLicence}` : null,
      args.receivedOn ? `Received on: ${args.receivedOn}` : null,
    ].filter(Boolean).join(" | ");

    if (existing) {
      // Club fields into existing with concatenation
      const patch: Record<string, any> = {};
      
      if (!existing.name && args.name) patch.name = args.name;
      
      // Concatenate subject if different
      if (subject && existing.subject !== subject) {
        patch.subject = existing.subject ? `${existing.subject} & ${subject}` : subject;
      }
      
      // Concatenate message if different
      if (messageParts && existing.message !== messageParts) {
        patch.message = existing.message ? `${existing.message} & ${messageParts}` : messageParts;
      }
      
      if (!existing.altMobileNo && altMobile) patch.altMobileNo = altMobile;
      if (!existing.state && args.state) patch.state = args.state;
      if (!existing.source) patch.source = "Pharmavends";
      if (!existing.station && args.location) patch.station = args.location;
      if (!existing.pincode && args.pincode) patch.pincode = args.pincode;
      if (!existing.agencyName && args.companyName) patch.agencyName = args.companyName;

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }

      // Add comment about duplicate lead posting
      if (Object.keys(patch).length > 0) {
        const loggingUserId = await ensureLoggingUserId(ctx);
        await ctx.db.insert("comments", {
          leadId: existing._id,
          userId: loggingUserId,
          content: `The Lead was Posted again (Pharmavends UID: ${args.uid})`,
          timestamp: Date.now(),
        });
      }

      // Notify assignees
      if (existing.assignedTo) {
        await ctx.db.insert("notifications", {
          userId: existing.assignedTo,
          title: "Duplicate Lead Clubbed",
          message: `A Pharmavends lead was clubbed into your assigned lead.`,
          read: false,
          type: "lead_assigned",
          relatedLeadId: existing._id,
        });
      }

      await ctx.db.insert("auditLogs", {
        userId: await ensureLoggingUserId(ctx),
        action: "CLUB_DUPLICATE_LEAD",
        details: `Pharmavends clubbed into existing lead ${existing._id} (UID: ${args.uid})`,
        timestamp: Date.now(),
        relatedLeadId: existing._id,
      });
      return false;
    }

    // Create new lead
    const nextSerial = await getNextSerialNumber(ctx);
    const leadId = await ctx.db.insert("leads", {
      serialNo: nextSerial,
      source: "Pharmavends",
      name: args.name,
      subject: subject,
      email: rawEmail,
      mobileNo: mobile,
      message: messageParts,
      altMobileNo: altMobile,
      state: args.state,
      station: args.location,
      pincode: args.pincode,
      agencyName: args.companyName,
      status: "yet_to_decide",
      heat: "cold",
      lastActivityTime: Date.now(),
    });

    // Notify Admins
    const allUsers = await ctx.db.query("users").collect();
    const admins = allUsers.filter((u: any) => u.role === "admin");
    
    for (const admin of admins) {
      await ctx.db.insert("notifications", {
        userId: admin._id,
        title: "New Lead Created",
        message: `A new lead from Pharmavends has been created.`,
        read: false,
        type: "lead_created",
        relatedLeadId: leadId,
      });
    }

    await ctx.db.insert("auditLogs", {
      userId: await ensureLoggingUserId(ctx),
      action: "CREATE_LEAD",
      details: `Pharmavends created new lead ${leadId} (UID: ${args.uid})`,
      timestamp: Date.now(),
      relatedLeadId: leadId,
    });

    return true;
  },
});

// Store WhatsApp message from webhook
export const storeWhatsAppMessage = internalMutation({
  args: {
    phoneNumber: v.string(),
    message: v.string(),
    messageId: v.string(),
    metadata: v.optional(v.any()),
    mediaType: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    mediaId: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    caption: v.optional(v.string()),
    replyToMessageId: v.optional(v.string()),
    replyToBody: v.optional(v.string()),
    replyToSender: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; leadId?: any; created: boolean; irrelevant?: boolean }> => {
    // Normalize phone number using the shared helper
    const normalizedPhone = normalizePhoneNumber(args.phoneNumber);

    // Store the message
    await ctx.db.insert("whatsappMessages", {
      phoneNumber: normalizedPhone,
      message: args.message,
      messageId: args.messageId,
      direction: "inbound",
      status: "received",
      timestamp: Date.now(),
      metadata: args.metadata,
      mediaType: args.mediaType,
      mediaUrl: args.mediaUrl,
      mediaId: args.mediaId,
      mimeType: args.mimeType,
      caption: args.caption,
      replyToMessageId: args.replyToMessageId,
      replyToBody: args.replyToBody,
      replyToSender: args.replyToSender,
    });

    // Find or create lead
    const existingLead = await ctx.db
      .query("leads")
      .withIndex("mobileNo", (q) => q.eq("mobileNo", normalizedPhone))
      .unique();

    if (existingLead) {
      // Update last activity time
      await ctx.db.patch(existingLead._id, {
        lastActivityTime: Date.now(),
      });

      return { success: true, leadId: existingLead._id, created: false };
    } else {
      // Create new lead from WhatsApp message
      const nextSerial = await getNextSerialNumber(ctx);
      const leadId = await ctx.db.insert("leads", {
        serialNo: nextSerial,
        name: normalizedPhone,
        email: `${normalizedPhone}@whatsapp.com`,
        mobileNo: normalizedPhone,
        source: "WhatsApp",
        subject: "WhatsApp Inquiry",
        message: args.message,
        status: "yet_to_decide",
        state: "",
        heat: "cold",
        lastActivityTime: Date.now(),
      });

      return { success: true, leadId, created: true };
    }
  },
});

// Handle WhatsApp reaction
export const handleWhatsAppReaction = internalMutation({
  args: {
    messageId: v.string(),
    reaction: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the message being reacted to
    const message = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (message) {
      // Update the message with the reaction
      await ctx.db.patch(message._id, {
        reaction: args.reaction,
      });
    }
  },
});

// Generic mutation to create a lead from an external source (Indiamart, etc.)
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
    source: v.string(),
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
          message: `A lead from ${args.source} was clubbed into your assigned lead.`,
          read: false,
          type: "lead_assigned",
          relatedLeadId: existing._id,
        });
      }

      await ctx.db.insert("auditLogs", {
        userId: await ensureLoggingUserId(ctx),
        action: "CLUB_DUPLICATE_LEAD",
        details: `${args.source} clubbed into existing lead ${existing._id}`,
        timestamp: Date.now(),
        relatedLeadId: existing._id,
      });
      return false;
    }

    // Create new lead
    const nextSerial = await getNextSerialNumber(ctx);
    const leadId = await ctx.db.insert("leads", {
      serialNo: nextSerial,
      source: args.source,
      name: args.name,
      subject: args.subject,
      email: rawEmail,
      mobileNo: mobile,
      message: args.message,
      altEmail: args.altEmail,
      altMobileNo: altMobile,
      state: args.state,
      status: "yet_to_decide",
      heat: "cold",
      lastActivityTime: Date.now(),
      unreadCount: 0,
    });

    // Notify Admins
    const allUsers = await ctx.db.query("users").collect();
    const admins = allUsers.filter((u: any) => u.role === "admin");
    
    for (const admin of admins) {
      await ctx.db.insert("notifications", {
        userId: admin._id,
        title: "New Lead Created",
        message: `A new lead from ${args.source} has been created.`,
        read: false,
        type: "lead_created",
        relatedLeadId: leadId,
      });
    }

    await ctx.db.insert("auditLogs", {
      userId: await ensureLoggingUserId(ctx),
      action: "CREATE_LEAD",
      details: `${args.source} created new lead ${leadId}`,
      timestamp: Date.now(),
      relatedLeadId: leadId,
    });

    return true;
  },
});