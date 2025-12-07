import { query, mutation, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";
import { ROLES, LEAD_STATUS, leadStatusValidator } from "./schema";
import { internal } from "./_generated/api";

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

// Get all leads (Admin and Manager only) with pagination
export const getAllLeads = query({
  args: {
    filter: v.optional(v.union(v.literal("all"), v.literal("assigned"), v.literal("unassigned"), v.literal("no_followup"))),
    currentUserId: v.optional(v.union(v.id("users"), v.string())),
    assigneeId: v.optional(v.union(v.id("users"), v.literal("all"), v.literal("unassigned"), v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      // Hardened: resolve currentUser safely without unique()
      let currentUser: any = null;

      // Validate currentUserId before any database operations
      if (!args.currentUserId) {
        return [];
      }

      // Only proceed if we have a valid-looking ID
      if (typeof args.currentUserId === "string" && args.currentUserId.length < 20) {
        return [];
      }

      try {
        currentUser = await ctx.db.get(args.currentUserId as any);
      } catch {
        // Invalid ID format or not found
        return [];
      }

      if (!currentUser || (currentUser.role !== ROLES.ADMIN && currentUser.role !== ROLES.MANAGER)) {
        return [];
      }

      // Determine fetch limit (default 500, max 1000)
      const limit = Math.min(Math.max(args.limit ?? 500, 1), 1000);
      const leads: any[] = [];
      
      // Helper to process iterator and fill leads array up to limit
      const processIterator = async (iterator: any, filterFn: (l: any) => boolean) => {
        for await (const lead of iterator) {
          if (filterFn(lead)) {
            leads.push(lead);
            if (leads.length >= limit) break;
          }
        }
      };

      if (currentUser.role === ROLES.MANAGER) {
        // Managers only see unassigned leads (excluding not relevant)
        // Use iterator to scan until we find enough unassigned leads
        await processIterator(
          ctx.db.query("leads").order("desc"),
          (l) => l.assignedTo === undefined && l.status !== LEAD_STATUS.NOT_RELEVANT
        );
      } else {
        // Admin can see all leads with filtering
        const rawAssignee = args.assigneeId;
        let normalizedAssignee = rawAssignee;

        if (typeof rawAssignee === "string") {
          const val = rawAssignee.trim();
          if (val === "" || val === "all") {
            normalizedAssignee = "all";
          } else if (val === "unassigned") {
            normalizedAssignee = "unassigned";
          } else {
            normalizedAssignee = val;
          }
        }

        if (normalizedAssignee && normalizedAssignee !== "all" && normalizedAssignee !== "unassigned") {
          // Filter by specific assignee using index
          await processIterator(
            ctx.db
              .query("leads")
              .withIndex("assignedTo", (q) => q.eq("assignedTo", normalizedAssignee as any))
              .order("desc"),
            (l) => l.status !== LEAD_STATUS.NOT_RELEVANT
          );
        } else if (args.filter === "assigned") {
           // Use assignedTo index to get any assigned leads
           await processIterator(
             ctx.db.query("leads").withIndex("assignedTo").order("desc"),
             (l) => l.status !== LEAD_STATUS.NOT_RELEVANT
           );
        } else if (normalizedAssignee === "unassigned" || args.filter === "unassigned") {
          // Unassigned leads
          await processIterator(
            ctx.db.query("leads").order("desc"),
            (l) => l.assignedTo === undefined && l.status !== LEAD_STATUS.NOT_RELEVANT
          );
        } else if (args.filter === "no_followup") {
          // No followup
          await processIterator(
            ctx.db.query("leads").order("desc"),
            (l) => !l.nextFollowup && l.status !== LEAD_STATUS.NOT_RELEVANT
          );
        } else {
          // Default: All leads (excluding not relevant)
          // We use the default order (creation time) and filter
          await processIterator(
            ctx.db.query("leads").order("desc"),
            (l) => l.status !== LEAD_STATUS.NOT_RELEVANT
          );
        }
      }

      // Sort by lastActivityTime (most recent first), fallback to _creationTime
      // Note: The iterator gave us roughly sorted results by creation time, 
      // but lastActivityTime is better for the user.
      leads.sort((a, b) => {
        const aTime = a.lastActivityTime ?? a._creationTime;
        const bTime = b.lastActivityTime ?? b._creationTime;
        return bTime - aTime; // Descending order (newest first)
      });

      // Replace the in-place mutation with creation of enriched copies to avoid mutating Convex docs
      const enrichedLeads: any[] = [];
      for (const lead of leads) {
        let assignedUserName: string | null = null;
        if (lead.assignedTo) {
          try {
            const assignedUser = (await ctx.db.get(lead.assignedTo)) as any;
            assignedUserName = assignedUser?.name || assignedUser?.username || "Unknown";
          } catch {
            assignedUserName = "Unknown";
          }
        }
        enrichedLeads.push({ ...lead, assignedUserName });
      }

      return enrichedLeads;
    } catch (err) {
      console.error("getAllLeads error:", err);
      return [];
    }
  },
});

// Get leads assigned to current user (Manager and Staff only)
export const getMyLeads = query({
  args: {
    currentUserId: v.optional(v.union(v.id("users"), v.string())),
    limit: v.optional(v.number()),
    filter: v.optional(v.union(v.literal("all"), v.literal("no_followup"))),
  },
  handler: async (ctx, args) => {
    try {
      // Validate currentUserId exists
      if (!args.currentUserId || args.currentUserId === "undefined" || args.currentUserId === "null") {
        console.log("getMyLeads: No valid currentUserId provided");
        return [];
      }

      // Validate it's a proper ID format using normalizeId
      const normalizedUserId = ctx.db.normalizeId("users", args.currentUserId);
      if (!normalizedUserId) {
        console.log("getMyLeads: Failed to normalize user ID:", args.currentUserId);
        return [];
      }

      let currentUser: any = null;
      try {
        currentUser = await ctx.db.get(normalizedUserId);
      } catch (error) {
        console.error("Error fetching user in getMyLeads:", error);
        return [];
      }
      
      if (!currentUser) {
        console.log("getMyLeads: User not found for ID:", normalizedUserId);
        return [];
      }

      const limit = Math.min(Math.max(args.limit ?? 500, 1), 1000);
      const leads: any[] = [];
      
      try {
        // Use iterator to fetch assigned leads and filter efficiently
        const iterator = ctx.db
          .query("leads")
          .withIndex("assignedTo", (q) => q.eq("assignedTo", currentUser._id))
          .order("desc");

        for await (const lead of iterator) {
          // Filter out not relevant leads
          if (lead.status !== LEAD_STATUS.NOT_RELEVANT) {
            // Apply no_followup filter if specified
            if (args.filter === "no_followup") {
              if (!lead.nextFollowup) {
                leads.push(lead);
              }
            } else {
              leads.push(lead);
            }
          }
          
          if (leads.length >= limit) break;
        }
          
        console.log("getMyLeads: Found", leads.length, "leads via iterator");
      } catch (error) {
        console.error("Error querying leads by index:", error);
        return [];
      }

      // Sort by lastActivityTime (most recent first), fallback to _creationTime
      leads.sort((a, b) => {
        const aTime = a.lastActivityTime ?? a._creationTime;
        const bTime = b.lastActivityTime ?? b._creationTime;
        return bTime - aTime; // Descending order (newest first)
      });
      
      return leads;
    } catch (err) {
      console.error("getMyLeads outer error:", err);
      return [];
    }
  },
});

async function findDuplicateLead(ctx: any, mobileNo: string, email: string) {
  // Phone number should already be normalized by caller
  const normalizedMobile = mobileNo;
  
  const byMobile = normalizedMobile
    ? await ctx.db.query("leads").withIndex("mobileNo", (q: any) => q.eq("mobileNo", normalizedMobile)).unique()
    : null;
  if (byMobile) return byMobile;

  // Skip email lookup if it's a placeholder
  const normalizedEmail = (email || "").trim().toLowerCase();
  const byEmail = normalizedEmail && normalizedEmail !== "unknown@example.com"
    ? await ctx.db.query("leads").withIndex("email", (q: any) => q.eq("email", normalizedEmail)).unique()
    : null;

  return byEmail;
}

// Check if a lead was previously marked as not relevant
async function wasMarkedNotRelevant(ctx: any, mobileNo: string, email: string) {
  const duplicate = await findDuplicateLead(ctx, mobileNo, email);
  return duplicate && duplicate.status === LEAD_STATUS.NOT_RELEVANT;
}

// Create lead with deduplication
export const createLead = mutation({
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
    const normalizedMobile = normalizePhoneNumber(args.mobileNo);
    const normalizedAltMobile = args.altMobileNo ? normalizePhoneNumber(args.altMobileNo) : undefined;

    // Check if this lead was previously marked as not relevant
    if (await wasMarkedNotRelevant(ctx, normalizedMobile, args.email)) {
      return null;
    }

    const existing = await findDuplicateLead(ctx, normalizedMobile, args.email);

    if (existing) {
      // Club records: concatenate different info and patch missing fields
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
      
      if (!existing.altMobileNo && normalizedAltMobile) patch.altMobileNo = normalizedAltMobile;
      if (!existing.altEmail && args.altEmail) patch.altEmail = args.altEmail;
      if (!existing.state && args.state) patch.state = args.state;
      if (!existing.source && args.source) patch.source = args.source;

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }

      if (Object.keys(patch).length > 0) {
        let anyUserId: any = null;
        const anyUsers = await ctx.db.query("users").collect();
        if (anyUsers.length > 0) {
          anyUserId = anyUsers[0]._id;
        }
        
        await ctx.db.insert("comments", {
          leadId: existing._id,
          userId: anyUserId,
          content: "The Lead was Posted again",
          timestamp: Date.now(),
        });

        if (existing.assignedTo) {
          await ctx.db.insert("notifications", {
            userId: existing.assignedTo,
            title: "Duplicate Lead Clubbed",
            message: `A new lead matching ${existing.name || existing.mobileNo || existing.email} was clubbed into your assigned lead.`,
            read: false,
            type: "lead_assigned",
            relatedLeadId: existing._id,
          });
        }

        await ctx.db.insert("auditLogs", {
          userId: anyUserId,
          action: "CLUB_DUPLICATE_LEAD",
          details: `Clubbed new lead into existing lead ${existing._id}`,
          timestamp: Date.now(),
          relatedLeadId: existing._id,
        });
      }

      return existing._id;
    }

    // No duplicate: create new lead with normalized phone
    // Get next serial number
    const allLeads = await ctx.db.query("leads").collect();
    const maxSerial = allLeads.length === 0 ? 0 : Math.max(...allLeads.map((l: any) => l.serialNo || 0));
    const nextSerial = maxSerial + 1;
    
    const leadId = await ctx.db.insert("leads", {
      ...args,
      serialNo: nextSerial,
      mobileNo: normalizedMobile,
      altMobileNo: normalizedAltMobile,
      status: LEAD_STATUS.YET_TO_DECIDE,
      lastActivityTime: Date.now(),
      unreadCount: 0,
    });

    // Send welcome email immediately on creation if email is valid
    try {
      const email = (args.email || "").trim().toLowerCase();
      if (email && email !== "unknown@example.com") {
        console.log(`Scheduling welcome email to: ${email}`);
        await ctx.scheduler.runAfter(0, (internal as any).emails.sendRelevant, { to: email });
      } else {
        console.log(`Skipping email send - invalid or placeholder email: ${email}`);
      }
    } catch (error) {
      console.error("Error scheduling welcome email:", error);
      // Do not block creation on email errors
    }

    // NEW: Send WhatsApp welcome template message
    try {
      if (normalizedMobile && normalizedMobile.length === 10) {
        await ctx.scheduler.runAfter(0, (internal as any).whatsapp.sendTemplateMessage, {
          phoneNumber: normalizedMobile,
          templateName: "cafoliwelcomemessageindia_9518447302",
          languageCode: "en",
          leadId: leadId,
        });
      }
    } catch {
      // Do not block creation on WhatsApp errors
    }

    // Notify Admins and Managers about the new lead
    try {
      const allUsers = await ctx.db.query("users").collect();
      const targets = allUsers.filter(
        (u: any) => u.role === ROLES.ADMIN || u.role === ROLES.MANAGER
      );
      await Promise.all(
        targets.map((u: any) =>
          ctx.db.insert("notifications", {
            userId: u._id,
            title: "New Lead Created",
            message: "1 new lead has been created.",
            read: false,
            type: "lead_created",
            relatedLeadId: leadId,
          })
        )
      );
    } catch {
      // Swallow notification errors to avoid blocking lead creation
    }

    return leadId;
  },
});

// Assign lead
export const assignLead = mutation({
  args: {
    leadId: v.id("leads"),
    assignedTo: v.optional(v.id("users")),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    // Authorization:
    // - Admin/Manager: can assign/unassign freely
    // - Staff: can only unassign themselves (assignedTo must be undefined and lead.assignedTo === currentUser._id)
    const isAdminOrManager = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER;
    const isStaffUnassigningSelf =
      currentUser.role !== ROLES.ADMIN &&
      currentUser.role !== ROLES.MANAGER &&
      args.assignedTo === undefined &&
      String(lead.assignedTo ?? "") === String(currentUser._id);

    if (!isAdminOrManager && !isStaffUnassigningSelf) {
      throw new Error("Unauthorized");
    }

    // Update assignedTo and assignedDate
    const patch: Record<string, any> = { assignedTo: args.assignedTo };
    if (args.assignedTo) {
      patch.assignedDate = Date.now();
    } else {
      patch.assignedDate = undefined;
    }
    
    await ctx.db.patch(args.leadId, patch);

    // Create notification if assigning to someone (skip unassign)
    if (args.assignedTo) {
      await ctx.db.insert("notifications", {
        userId: args.assignedTo,
        title: "New Lead Assigned",
        message: "A new Lead has Been Assigned",
        read: false,
        type: "lead_assigned",
        relatedLeadId: args.leadId,
      });
    }

    // Log the action (covers assign, reassign, or unassign)
    const assignedUser = (args.assignedTo ? await ctx.db.get(args.assignedTo) : null) as any;
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "ASSIGN_LEAD",
      details: `Assigned lead "${lead.name}" to ${assignedUser?.name || "unassigned"}`,
      timestamp: Date.now(),
      relatedLeadId: args.leadId,
    });
  },
});

// Update lead status
export const updateLeadStatus = mutation({
  args: {
    leadId: v.id("leads"),
    status: leadStatusValidator,
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser || currentUser.role === ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }
    
    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }
    
    // Check if user is assigned to this lead
    if (lead.assignedTo !== currentUser._id) {
      throw new Error("You can only update leads assigned to you");
    }
    
    // Instead of deleting, just mark as not relevant
    await ctx.db.patch(args.leadId, { status: args.status });

    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: args.status === LEAD_STATUS.NOT_RELEVANT ? "MARK_NOT_RELEVANT" : "UPDATE_LEAD_STATUS",
      details: `Updated lead "${lead.name}" status to ${args.status}`,
      timestamp: Date.now(),
      relatedLeadId: args.leadId,
    });
  },
});

// Set next followup
export const setNextFollowup = mutation({
  args: {
    leadId: v.id("leads"),
    followupTime: v.number(),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }
    
    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }
    
    // Check permissions
    if (currentUser.role !== ROLES.ADMIN && lead.assignedTo !== currentUser._id) {
      throw new Error("You can only set followup for leads assigned to you");
    }
    
    // Validate followup time
    const now = Date.now();
    const maxFutureTime = now + (31 * 24 * 60 * 60 * 1000); // 31 days from now
    
    if (args.followupTime <= now) {
      throw new Error("Followup date must be in the future");
    }
    
    if (args.followupTime > maxFutureTime) {
      throw new Error("Followup date cannot be more than 31 days in the future");
    }
    
    await ctx.db.patch(args.leadId, { nextFollowup: args.followupTime });
    
    // Log the action
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "SET_FOLLOWUP",
      details: `Set followup for lead "${lead.name}" at ${new Date(args.followupTime).toLocaleString()}`,
      timestamp: Date.now(),
      relatedLeadId: args.leadId,
    });
  },
});

// Cancel followup (Admin only)
export const cancelFollowup = mutation({
  args: {
    leadId: v.id("leads"),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }
    
    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }
    
    await ctx.db.patch(args.leadId, { nextFollowup: undefined });
    
    // Log the action
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "CANCEL_FOLLOWUP",
      details: `Cancelled followup for lead "${lead.name}"`,
      timestamp: Date.now(),
      relatedLeadId: args.leadId,
    });
  },
});

// Get leads with upcoming followups
export const getUpcomingFollowups = query({
  args: { currentUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser) {
      return [];
    }

    const now = Date.now();
    const fiveMinutesFromNow = now + (5 * 60 * 1000);
    
    const leads = await ctx.db.query("leads").collect();
    
    return leads.filter(lead => 
      lead.nextFollowup && 
      lead.nextFollowup <= fiveMinutesFromNow && 
      lead.nextFollowup > now
    );
  },
});

export const bulkCreateLeads = mutation({
  args: {
    leads: v.array(
      v.object({
        name: v.string(),
        subject: v.string(),
        message: v.string(),
        mobileNo: v.string(),
        email: v.string(),
        altMobileNo: v.optional(v.string()),
        altEmail: v.optional(v.string()),
        state: v.string(),
        source: v.optional(v.string()),
        station: v.optional(v.string()),
        district: v.optional(v.string()),
        pincode: v.optional(v.string()),
        agencyName: v.optional(v.string()),
      })
    ),
    assignedTo: v.optional(v.id("users")),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser || (currentUser.role !== ROLES.ADMIN && currentUser.role !== ROLES.MANAGER)) {
      throw new Error("Unauthorized");
    }

    if (args.assignedTo) {
      const assignee = await ctx.db.get(args.assignedTo);
      if (!assignee) {
        throw new Error("Invalid assignee");
      }
    }

    let importedCount = 0;

    for (const incoming of args.leads) {
      // Normalize phone numbers
      const normalizedMobile = normalizePhoneNumber(incoming.mobileNo);
      const normalizedAltMobile = incoming.altMobileNo ? normalizePhoneNumber(incoming.altMobileNo) : undefined;

      // Check if this lead was previously marked as not relevant
      if (await wasMarkedNotRelevant(ctx, normalizedMobile, incoming.email)) {
        continue;
      }

      // NEW: Auto-apply pincode mapping if pincode is provided
      let finalState = incoming.state;
      let finalDistrict = incoming.district;
      
      if (incoming.pincode) {
        const pin = incoming.pincode.toString().trim();
        if (pin) {
          let mapping: any = null;
          try {
            mapping = await ctx.db
              .query("pincodeMappings")
              .withIndex("pincode", (q: any) => q.eq("pincode", pin))
              .unique();
          } catch {
            const all = await ctx.db
              .query("pincodeMappings")
              .withIndex("pincode", (q: any) => q.eq("pincode", pin))
              .collect();
            mapping = all[0] || null;
          }
          if (mapping) {
            finalState = mapping.state;
            finalDistrict = mapping.district;
          }
        }
      }

      const existing = await findDuplicateLead(ctx, normalizedMobile, incoming.email);

      if (existing) {
        // Club records: concatenate different info and fill missing fields
        const patch: Record<string, any> = {};
        
        if (!existing.name && incoming.name) patch.name = incoming.name;
        
        // Concatenate subject if different
        if (incoming.subject && existing.subject !== incoming.subject) {
          patch.subject = existing.subject ? `${existing.subject} & ${incoming.subject}` : incoming.subject;
        }
        
        // Concatenate message if different
        if (incoming.message && existing.message !== incoming.message) {
          patch.message = existing.message ? `${existing.message} & ${incoming.message}` : incoming.message;
        }
        
        if (!existing.altMobileNo && normalizedAltMobile) patch.altMobileNo = normalizedAltMobile;
        if (!existing.altEmail && incoming.altEmail) patch.altEmail = incoming.altEmail;
        if (!existing.state && finalState) patch.state = finalState;
        if (!existing.source && incoming.source) patch.source = incoming.source;
        if (!existing.station && incoming.station) patch.station = incoming.station;
        if (!existing.district && finalDistrict) patch.district = finalDistrict;
        if (!existing.pincode && incoming.pincode) patch.pincode = incoming.pincode;
        if (!existing.agencyName && incoming.agencyName) patch.agencyName = incoming.agencyName;

        // Assignment logic (updated):
        let assignedJustNow = false;
        if (args.assignedTo && !existing.assignedTo) {
          patch.assignedTo = args.assignedTo;
          patch.assignedDate = Date.now();
          assignedJustNow = true;
        }

        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existing._id, patch);
        }

        // Add comment about duplicate lead posting
        if (Object.keys(patch).length > 0) {
          await ctx.db.insert("comments", {
            leadId: existing._id,
            userId: currentUser._id,
            content: "The Lead was Posted again",
            timestamp: Date.now(),
          });
        }

        if (existing.assignedTo) {
          await ctx.db.insert("notifications", {
            userId: existing.assignedTo,
            title: "Duplicate Lead Clubbed",
            message: `A new lead matching ${existing.name || existing.mobileNo || existing.email} was clubbed into your assigned lead.`,
            read: false,
            type: "lead_assigned",
            relatedLeadId: existing._id,
          });
        }
        if (assignedJustNow && args.assignedTo) {
          await ctx.db.insert("notifications", {
            userId: args.assignedTo,
            title: "Lead Assigned",
            message: `A lead was assigned to you via import.`,
            read: false,
            type: "lead_assigned",
            relatedLeadId: existing._id,
          });
        }

        await ctx.db.insert("auditLogs", {
          userId: currentUser._id,
          action: "CLUB_DUPLICATE_LEAD",
          details: `Bulk import clubbed into existing lead ${existing._id}`,
          timestamp: Date.now(),
          relatedLeadId: existing._id,
        });
      } else {
        // Create fresh lead with normalized phone
        // Get next serial number
        const allLeads = await ctx.db.query("leads").collect();
        const maxSerial = allLeads.length === 0 ? 0 : Math.max(...allLeads.map((l: any) => l.serialNo || 0));
        const nextSerial = maxSerial + 1;
        
        const leadId = await ctx.db.insert("leads", {
          ...incoming,
          serialNo: nextSerial,
          mobileNo: normalizedMobile,
          altMobileNo: normalizedAltMobile,
          state: finalState,
          district: finalDistrict,
          status: LEAD_STATUS.YET_TO_DECIDE,
          assignedTo: args.assignedTo,
          assignedDate: args.assignedTo ? Date.now() : undefined,
          lastActivityTime: Date.now(),
          unreadCount: 0,
        });

        // NEW: Send welcome email immediately on creation if email is valid
        try {
          const email = (incoming.email || "").trim().toLowerCase();
          if (email && email !== "unknown@example.com") {
            await ctx.scheduler.runAfter(0, (internal as any).emails.sendRelevant, { to: email });
          }
        } catch {
          // Do not block import on email errors
        }

        if (args.assignedTo) {
          await ctx.db.insert("notifications", {
            userId: args.assignedTo,
            title: "New Lead Assigned",
            message: `A new Lead has Been Assigned`,
            read: false,
            type: "lead_assigned",
            relatedLeadId: leadId,
          });
        }
        importedCount++;
      }
    }

    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: args.assignedTo ? "BULK_IMPORT_AND_ASSIGN_LEADS" : "BULK_IMPORT_LEADS",
      details: `Imported ${importedCount} new lead(s)${args.assignedTo ? " and assigned" : ""}; duplicates were clubbed.`,
      timestamp: Date.now(),
    });

    // Notify Admins and Managers if any new leads were created in this batch
    if (importedCount > 0) {
      try {
        const allUsers = await ctx.db.query("users").collect();
        const targets = allUsers.filter(
          (u: any) => u.role === ROLES.ADMIN || u.role === ROLES.MANAGER
        );
        await Promise.all(
          targets.map((u: any) =>
            ctx.db.insert("notifications", {
              userId: u._id,
              title: "New Leads Created",
              message: `${importedCount} new lead(s) have been created.`,
              read: false,
              type: "lead_created",
            })
          )
        );
      } catch {
        // Do not block the mutation if notifications fail
      }
    }
  },
});

export const runDeduplication = mutation({
  args: {
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }

    // Load ALL leads for deduplication (not just unassigned)
    const all = await ctx.db.query("leads").collect();
    
    if (all.length === 0) {
      return { groupsProcessed: 0, mergedCount: 0, deletedCount: 0, notificationsSent: 0 };
    }

    // Build groups by mobileNo and email (for all leads)
    const byKey: Record<string, Array<typeof all[number]>> = {};

    for (const l of all) {
      const keys: Array<string> = [];
      if (l.mobileNo) keys.push(`m:${l.mobileNo}`);
      if (l.email) keys.push(`e:${l.email}`);
      // If a lead has both, we add it to both groups; we will unify by selecting a canonical doc
      for (const k of keys) {
        if (!byKey[k]) byKey[k] = [];
        byKey[k].push(l);
      }
    }

    // To avoid double-processing the same physical docs across mobile/email overlap, track visited doc ids
    const visitedDocIds = new Set<string>();
    let groupsProcessed = 0;
    let mergedCount = 0;
    let deletedCount = 0;
    let notificationsSent = 0;

    // Helper to club members into a single canonical doc (oldest by _creationTime)
    const clubGroup = async (members: Array<typeof all[number]>) => {
      // Filter out already processed docs
      const fresh = members.filter(m => !visitedDocIds.has(String(m._id)));
      if (fresh.length <= 1) {
        fresh.forEach(m => visitedDocIds.add(String(m._id)));
        return;
      }

      // Choose primary as oldest
      fresh.sort((a, b) => a._creationTime - b._creationTime);
      const primary = fresh[0];
      const rest = fresh.slice(1);

      // Build patch by concatenating name/subject/message and filling missing fields
      const patch: Record<string, any> = {};
      
      // Track all previous assignees to add to comment
      const previousAssignees = new Set<string>();
      if (primary.assignedTo) {
        try {
          const user = await ctx.db.get(primary.assignedTo);
          if (user) previousAssignees.add(user.name || user.username || "Unknown");
        } catch {}
      }
      
      for (const r of rest) {
        // Track assignees from duplicate leads
        if (r.assignedTo) {
          try {
            const user = await ctx.db.get(r.assignedTo);
            if (user) previousAssignees.add(user.name || user.username || "Unknown");
          } catch {}
        }
        
        // Concatenate name if different
        if (r.name && primary.name !== r.name) {
          patch.name = primary.name ? `${primary.name} & ${r.name}` : r.name;
        }
        
        // Concatenate subject if different
        if (r.subject && primary.subject !== r.subject) {
          patch.subject = primary.subject ? `${primary.subject} & ${r.subject}` : r.subject;
        }
        
        // Concatenate message if different
        if (r.message && primary.message !== r.message) {
          patch.message = primary.message ? `${primary.message} & ${r.message}` : r.message;
        }
        
        // Fill missing fields only
        if (!primary.altMobileNo && r.altMobileNo) patch.altMobileNo = r.altMobileNo;
        if (!primary.altEmail && r.altEmail) patch.altEmail = r.altEmail;
        if (!primary.state && r.state) patch.state = r.state;
        if (!primary.source && r.source) patch.source = r.source;
      }

      // NEW: Unassign the lead when clubbing
      patch.assignedTo = undefined;
      patch.assignedDate = undefined;

      // Move comments from duplicate leads to the primary lead before deletion
      for (const r of rest) {
        const rComments = await ctx.db
          .query("comments")
          .withIndex("leadId", (q: any) => q.eq("leadId", r._id))
          .collect();
        for (const c of rComments) {
          await ctx.db.patch(c._id, { leadId: primary._id });
        }
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(primary._id, patch);
        mergedCount++;
      }
      
      // Add comment showing duplicate leads were clubbed and previous assignees
      const assigneeList = Array.from(previousAssignees);
      const assigneeText = assigneeList.length > 0 
        ? ` Previously assigned to: ${assigneeList.join(", ")}`
        : "";
      
      await ctx.db.insert("comments", {
        leadId: primary._id,
        userId: currentUser._id,
        content: `Duplicate leads clubbed.${assigneeText}`,
        timestamp: Date.now(),
      });

      // Notify previous assignees that their lead was clubbed and unassigned
      for (const r of [primary, ...rest]) {
        if (r.assignedTo) {
          await ctx.db.insert("notifications", {
            userId: r.assignedTo,
            title: "Lead Unassigned - Duplicates Clubbed",
            message: "A lead assigned to you was clubbed with duplicates and is now unassigned.",
            read: false,
            type: "lead_assigned",
            relatedLeadId: primary._id,
          });
          notificationsSent++;
        }
      }

      // Delete the rest after merging
      for (const r of rest) {
        await ctx.db.delete(r._id);
        deletedCount++;
      }

      // Audit log
      await ctx.db.insert("auditLogs", {
        userId: currentUser._id,
        action: "RUN_DEDUPLICATION",
        details: `Clubbed ${rest.length} duplicate(s) into lead ${primary._id}${assigneeText}`,
        timestamp: Date.now(),
        relatedLeadId: primary._id,
      });

      // Mark all as visited
      visitedDocIds.add(String(primary._id));
      rest.forEach(m => visitedDocIds.add(String(m._id)));
      groupsProcessed++;
    };

    // Process each group
    for (const key of Object.keys(byKey)) {
      await clubGroup(byKey[key]);
    }

    return { groupsProcessed, mergedCount, deletedCount, notificationsSent };
  },
});

export const deleteAllLeads = mutation({
  args: {
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }

    const allLeads = await ctx.db.query("leads").collect();

    for (const lead of allLeads) {
      await ctx.db.delete(lead._id);
    }

    await ctx.db.insert("auditLogs", {
      userId: args.currentUserId,
      action: "DELETE_ALL_LEADS",
      details: `Admin deleted all leads (${allLeads.length})`,
      timestamp: Date.now(),
    });
  },
});

export const deleteLeadAdmin = mutation({
  args: {
    leadId: v.id("leads"),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }

    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    // Delete associated WhatsApp messages
    const whatsappMessages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_leadId", (q) => q.eq("leadId", args.leadId))
      .collect();
    
    for (const message of whatsappMessages) {
      await ctx.db.delete(message._id);
    }

    // Delete associated comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("leadId", (q) => q.eq("leadId", args.leadId))
      .collect();
    
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete the lead
    await ctx.db.delete(args.leadId);

    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "DELETE_LEAD_ADMIN",
      details: `Admin deleted lead "${lead.name}" (${String(args.leadId)}) and ${whatsappMessages.length} WhatsApp messages, ${comments.length} comments`,
      timestamp: Date.now(),
      relatedLeadId: args.leadId,
    });
  },
});

// Add: Update lead details (agencyName, pincode). Admin/Manager only.
export const updateLeadDetails = mutation({
  args: {
    leadId: v.id("leads"),
    // Added editable fields
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    message: v.optional(v.string()),
    mobileNo: v.optional(v.string()),
    altMobileNo: v.optional(v.string()),
    email: v.optional(v.string()),
    altEmail: v.optional(v.string()),
    state: v.optional(v.string()),
    district: v.optional(v.string()),
    source: v.optional(v.string()),
    // Existing fields
    agencyName: v.optional(v.string()),
    pincode: v.optional(v.string()),
    station: v.optional(v.string()),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);

    if (!currentUser || (currentUser.role !== ROLES.ADMIN && currentUser.role !== ROLES.MANAGER)) {
      throw new Error("Unauthorized");
    }

    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    const patch: Record<string, any> = {};
    // Added: map new optional fields
    if (typeof args.name !== "undefined") patch.name = args.name;
    if (typeof args.subject !== "undefined") patch.subject = args.subject;
    if (typeof args.message !== "undefined") patch.message = args.message;
    if (typeof args.mobileNo !== "undefined") patch.mobileNo = args.mobileNo;
    if (typeof args.altMobileNo !== "undefined") patch.altMobileNo = args.altMobileNo;
    if (typeof args.email !== "undefined") patch.email = (args.email || "").toLowerCase();
    if (typeof args.altEmail !== "undefined") patch.altEmail = args.altEmail ? args.altEmail.toLowerCase() : args.altEmail;
    if (typeof args.state !== "undefined") patch.state = args.state;
    if (typeof args.district !== "undefined") patch.district = args.district;
    if (typeof args.source !== "undefined") patch.source = args.source;

    if (typeof args.agencyName !== "undefined") patch.agencyName = args.agencyName;

    // Maintain auto-fill from pincode, but allow manual override for state/district
    if (typeof args.pincode !== "undefined") {
      patch.pincode = args.pincode;

      const pin = (args.pincode || "").toString().trim();
      if (pin) {
        let mapping: any = null;
        try {
          mapping = await ctx.db
            .query("pincodeMappings")
            .withIndex("pincode", (q: any) => q.eq("pincode", pin))
            .unique();
        } catch {
          const all = await ctx.db
            .query("pincodeMappings")
            .withIndex("pincode", (q: any) => q.eq("pincode", pin))
            .collect();
          mapping = all[0] || null;
        }
        if (mapping) {
          // Only apply mapping if caller didn't provide explicit state/district in this update
          if (typeof args.state === "undefined") {
            patch.state = mapping.state;
          }
          if (typeof args.district === "undefined") {
            patch.district = mapping.district;
          }
        }
      }
    }

    if (typeof args.station !== "undefined") {
      patch.station = args.station;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.leadId, patch);

      await ctx.db.insert("auditLogs", {
        userId: currentUser._id,
        action: "UPDATE_LEAD_DETAILS",
        details: `Updated details for lead "${lead.name}" (${String(args.leadId)})`,
        timestamp: Date.now(),
        relatedLeadId: args.leadId,
      });
    }
  },
});

// Admin-only: bulk import pincode mappings from CSV
export const bulkImportPincodeMappings = mutation({
  args: {
    records: v.array(
      v.object({
        pincode: v.string(),
        district: v.string(),
        state: v.string(),
      })
    ),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }

    let upserts = 0;
    for (const rec of args.records) {
      const pin = (rec.pincode || "").toString().trim();
      const district = (rec.district || "").toString().trim();
      const state = (rec.state || "").toString().trim();
      if (!pin) continue;

      let existing: any = null;
      try {
        existing = await ctx.db
          .query("pincodeMappings")
          .withIndex("pincode", (q: any) => q.eq("pincode", pin))
          .unique();
      } catch {
        const all = await ctx.db
          .query("pincodeMappings")
          .withIndex("pincode", (q: any) => q.eq("pincode", pin))
          .collect();
        existing = all[0] || null;
      }

      if (existing) {
        await ctx.db.patch(existing._id, { district, state });
      } else {
        await ctx.db.insert("pincodeMappings", { pincode: pin, district, state });
      }
      upserts++;
    }

    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "IMPORT_PINCODE_MAPPINGS",
      details: `Imported/updated ${upserts} pincode mapping(s)`,
      timestamp: Date.now(),
    });
  },
});

// Get all leads marked as not relevant (Admin only)
export const getNotRelevantLeads = query({
  args: {
    currentUserId: v.union(v.id("users"), v.string()),
  },
  handler: async (ctx, args) => {
    try {
      let currentUser: any = null;
      try {
        currentUser = await ctx.db.get(args.currentUserId as any);
      } catch {
        return [];
      }

      if (!currentUser || currentUser.role !== ROLES.ADMIN) {
        return [];
      }

      const allLeads = await ctx.db.query("leads").collect();
      const notRelevantLeads = allLeads.filter((l) => l.status === LEAD_STATUS.NOT_RELEVANT);

      // Sort by creation time and add assignedUserName
      notRelevantLeads.sort((a, b) => a._creationTime - b._creationTime);

      const enrichedLeads: any[] = [];
      for (const lead of notRelevantLeads) {
        let assignedUserName: string | null = null;
        if (lead.assignedTo) {
          try {
            const assignedUser = (await ctx.db.get(lead.assignedTo)) as any;
            assignedUserName = assignedUser?.name || assignedUser?.username || "Unknown";
          } catch {
            assignedUserName = "Unknown";
          }
        }
        enrichedLeads.push({ ...lead, assignedUserName });
      }

      return enrichedLeads;
    } catch (err) {
      console.error("getNotRelevantLeads error:", err);
      return [];
    }
  },
});

// New query to get detailed report data for line charts
export const getReportData = query({
  args: {
    currentUserId: v.id("users"),
    fromDate: v.number(),
    toDate: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate user exists
    let currentUser: any = null;
    try {
      currentUser = await ctx.db.get(args.currentUserId);
    } catch (error) {
      console.error("Error fetching user:", error);
      throw new Error("Invalid user ID or user not found");
    }

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Validate date range
    if (args.fromDate > args.toDate) {
      throw new Error("From date must be before or equal to To date");
    }

    // Get leads assigned within the date range
    let myLeads: any[] = [];
    
    if (currentUser.role === ROLES.ADMIN) {
      try {
        const allLeads = await ctx.db
          .query("leads")
          .order("desc")
          .take(10000);
        
        myLeads = allLeads.filter((l) => 
          l.assignedDate && 
          l.assignedDate >= args.fromDate && 
          l.assignedDate <= args.toDate
        );
      } catch (error) {
        console.error("Error querying leads for admin:", error);
        throw new Error("Failed to fetch leads");
      }
    } else {
      try {
        const allMyLeads = await ctx.db
          .query("leads")
          .withIndex("assignedTo", (q) => q.eq("assignedTo", currentUser._id))
          .collect();
        
        myLeads = allMyLeads.filter((l) => 
          l.assignedDate && 
          l.assignedDate >= args.fromDate && 
          l.assignedDate <= args.toDate
        );
      } catch (error) {
        console.error("Error querying leads for user:", error);
        try {
          const allLeads = await ctx.db
            .query("leads")
            .order("desc")
            .take(5000);
          
          myLeads = allLeads.filter((l) => 
            String(l.assignedTo ?? "") === String(currentUser._id) &&
            l.assignedDate && 
            l.assignedDate >= args.fromDate && 
            l.assignedDate <= args.toDate
          );
        } catch (fallbackError) {
          console.error("Fallback query failed:", fallbackError);
          throw new Error("Failed to fetch leads");
        }
      }
    }

    const leadsInRange = myLeads;
    const now = Date.now();

    // Group leads by day for time series data
    const dayMap: Record<string, any> = {};
    
    for (const lead of leadsInRange) {
      const date = new Date(lead.assignedDate!);
      const dayKey = date.toISOString().split('T')[0];
      
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = {
          date: dayKey,
          assigned: 0,
          relevant: 0,
          notRelevant: 0,
          hot: 0,
          cold: 0,
          matured: 0,
          followupsSet: 0,
          timelyFollowups: 0,
          overdueFollowups: 0,
          sources: {} as Record<string, number>,
        };
      }
      
      const day = dayMap[dayKey];
      day.assigned++;
      
      // Status counts
      if (lead.status === LEAD_STATUS.RELEVANT) day.relevant++;
      if (lead.status === LEAD_STATUS.NOT_RELEVANT) day.notRelevant++;
      
      // Heat counts
      if (lead.heat === "hot") day.hot++;
      if (lead.heat === "cold") day.cold++;
      if (lead.heat === "matured") day.matured++;
      
      // Followup counts
      if (lead.nextFollowup) {
        day.followupsSet++;
        
        // Check if followup was due in this timeframe
        if (lead.nextFollowup >= args.fromDate && lead.nextFollowup <= args.toDate) {
          if (lead.nextFollowup < now) {
            day.overdueFollowups++;
          } else {
            day.timelyFollowups++;
          }
        }
      }
      
      // Source counts
      const source = lead.source || "unknown";
      day.sources[source] = (day.sources[source] || 0) + 1;
    }

    // Convert to sorted array
    const timeSeriesData = Object.values(dayMap).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Calculate totals
    const totalAssigned = leadsInRange.length;
    const relevantLeads = leadsInRange.filter((l) => l.status === LEAD_STATUS.RELEVANT).length;
    const notRelevantLeads = leadsInRange.filter((l) => l.status === LEAD_STATUS.NOT_RELEVANT).length;
    const hotLeads = leadsInRange.filter((l) => l.heat === "hot").length;
    const coldLeads = leadsInRange.filter((l) => l.heat === "cold").length;
    const maturedLeads = leadsInRange.filter((l) => l.heat === "matured").length;
    
    const followupsSet = leadsInRange.filter((l) => l.nextFollowup).length;
    const timelyFollowups = leadsInRange.filter((l) => 
      l.nextFollowup && 
      l.nextFollowup >= args.fromDate && 
      l.nextFollowup <= args.toDate &&
      l.nextFollowup >= now
    ).length;
    const overdueFollowups = leadsInRange.filter((l) => 
      l.nextFollowup && l.nextFollowup < now
    ).length;

    // Source breakdown
    const sourceBreakdown: Record<string, number> = {};
    const allSources = new Set<string>();
    for (const lead of leadsInRange) {
      const source = lead.source || "unknown";
      sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
      allSources.add(source);
    }

    return {
      timeSeriesData,
      totals: {
        assigned: totalAssigned,
        relevant: relevantLeads,
        notRelevant: notRelevantLeads,
        hot: hotLeads,
        cold: coldLeads,
        matured: maturedLeads,
        followupsSet,
        timelyFollowups,
        overdueFollowups,
      },
      sourceBreakdown,
      allSources: Array.from(allSources),
    };
  },
});

// New mutation to update lead heat (Hot / Cold / Matured)
export const updateLeadHeat = mutation({
  args: {
    leadId: v.id("leads"),
    heat: v.union(v.literal("hot"), v.literal("cold"), v.literal("matured")),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, { leadId, heat, currentUserId }) => {
    // Basic authorization: ensure currentUser exists; specific role checks should mirror your existing policy.
    const user = await ctx.db.get(currentUserId as any).catch(() => null);
    if (!user) {
      throw new Error("Unauthorized");
    }
    const lead = await ctx.db.get(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }
    // Patch heat
    await ctx.db.patch(leadId, { heat });
    return true;
  },
});

export const deleteLeadsWithPlaceholderEmail = mutation({
  args: {
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }

    // Find all leads with placeholder email
    const allLeads = await ctx.db.query("leads").collect();
    const leadsToDelete = allLeads.filter(
      (lead) => lead.email && lead.email.toLowerCase() === "unknown@example.com"
    );

    let deletedCount = 0;

    for (const lead of leadsToDelete) {
      // Delete associated WhatsApp messages
      const whatsappMessages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_leadId", (q) => q.eq("leadId", lead._id))
        .collect();
      
      for (const message of whatsappMessages) {
        await ctx.db.delete(message._id);
      }

      // Delete associated comments
      const comments = await ctx.db
        .query("comments")
        .withIndex("leadId", (q) => q.eq("leadId", lead._id))
        .collect();
      
      for (const comment of comments) {
        await ctx.db.delete(comment._id);
      }

      // Delete the lead
      await ctx.db.delete(lead._id);
      deletedCount++;
    }

    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "DELETE_PLACEHOLDER_EMAIL_LEADS",
      details: `Admin deleted ${deletedCount} leads with placeholder email (unknown@example.com)`,
      timestamp: Date.now(),
    });

    return { deletedCount };
  },
});

export const assignSequentialNumbers = mutation({
  args: {
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }

    const allLeads = await ctx.db.query("leads").collect();
    
    // Sort by creation time to maintain consistent ordering
    allLeads.sort((a, b) => a._creationTime - b._creationTime);
    
    let counter = 1;
    let assigned = 0;
    for (const lead of allLeads) {
      // Always assign/reassign to ensure sequential ordering
      await ctx.db.patch(lead._id, { serialNo: counter });
      assigned++;
      counter++;
    }
    
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "ASSIGN_SEQUENTIAL_NUMBERS",
      details: `Assigned sequential numbers to ${assigned} leads`,
      timestamp: Date.now(),
    });
    
    return { success: true, totalLeads: allLeads.length, assigned };
  },
});

export const assignSerialNumbersBatched = mutation({
  args: {
    currentUserId: v.id("users"),
    batchSize: v.optional(v.number()),
    startAfter: v.optional(v.number()), // _creationTime to start after
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db.get(args.currentUserId);
    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      throw new Error("Unauthorized");
    }

    const batchSize = args.batchSize || 100;
    
    // Get leads ordered by creation time, take a batch
    let query = ctx.db.query("leads").order("asc");
    
    if (args.startAfter !== undefined) {
      query = query.filter((q) => q.gt(q.field("_creationTime"), args.startAfter!));
    }
    
    const leads = await query.take(batchSize);
    
    // Filter to only leads without serial numbers
    const leadsWithoutSerial = leads.filter(l => !l.serialNo);
    
    if (leadsWithoutSerial.length === 0) {
      return { 
        success: true, 
        processed: 0, 
        hasMore: leads.length === batchSize,
        lastProcessedTime: leads.length > 0 ? leads[leads.length - 1]._creationTime : undefined,
        message: "All leads in this batch have serial numbers assigned"
      };
    }
    
    // Get the current max serial number by querying with index
    const leadsWithSerial = await ctx.db
      .query("leads")
      .withIndex("by_serialNo")
      .order("desc")
      .take(1);
    
    const maxSerial = leadsWithSerial.length > 0 && leadsWithSerial[0].serialNo
      ? leadsWithSerial[0].serialNo 
      : 0;
    
    let counter = maxSerial + 1;
    let assigned = 0;
    
    for (const lead of leadsWithoutSerial) {
      await ctx.db.patch(lead._id, { serialNo: counter });
      assigned++;
      counter++;
    }
    
    const lastProcessedTime = leadsWithoutSerial[leadsWithoutSerial.length - 1]._creationTime;
    const hasMore = leads.length === batchSize;
    
    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "ASSIGN_SEQUENTIAL_NUMBERS_BATCH",
      details: `Assigned serial numbers to ${assigned} leads (batch)`,
      timestamp: Date.now(),
    });
    
    return { 
      success: true, 
      processed: assigned,
      hasMore,
      lastProcessedTime,
      nextSerial: counter,
      message: `Assigned ${assigned} serial numbers. ${hasMore ? 'More leads to process.' : 'All done!'}`
    };
  },
});

export const getLeadBySerialNo = query({
  args: { serialNo: v.number() },
  handler: async (ctx, args) => {
    const lead = await ctx.db
      .query("leads")
      .withIndex("by_serialNo", (q) => q.eq("serialNo", args.serialNo))
      .first();
    
    if (!lead) {
      return null;
    }
    
    // Enrich with assignee name if assigned
    let assignedUserName = null;
    if (lead.assignedTo) {
      const user = await ctx.db.get(lead.assignedTo);
      if (user) {
        assignedUserName = user.name || user.username || "Unknown";
      }
    }
    
    // Fetch all comments for this lead
    const comments = await ctx.db
      .query("comments")
      .withIndex("leadId", (q) => q.eq("leadId", lead._id))
      .collect();
    
    // Enrich comments with user names
    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        let userName = "System";
        if (comment.userId) {
          try {
            const user = await ctx.db.get(comment.userId);
            if (user) {
              userName = user.name || user.username || "Unknown";
            }
          } catch {
            userName = "Unknown";
          }
        }
        return {
          _id: comment._id,
          content: comment.content,
          timestamp: comment.timestamp,
          userName,
        };
      })
    );
    
    // Sort comments by timestamp (oldest first)
    enrichedComments.sort((a, b) => a.timestamp - b.timestamp);
    
    return {
      ...lead,
      assignedUserName,
      comments: enrichedComments,
    };
  },
});

export const ensureSerialNumbersAssigned = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; message: string; skipped?: boolean; result?: any }> => {
    try {
      // Check if serial numbers have already been assigned
      const flag = await ctx.runQuery(internal.leads.checkSerialNumberFlag, {});
      
      if (flag) {
        // Already assigned, skip
        return { success: true, message: "Serial numbers already assigned", skipped: true };
      }
      
      // Run the internal mutation directly (no user ID needed)
      const result: any = await ctx.runMutation(internal.leads.assignSequentialNumbersInternal, {});
      
      // Set the flag to prevent future runs
      await ctx.runMutation(internal.leads.setSerialNumberFlag, {});
      
      console.log("Serial numbers assigned successfully:", result);
      return { success: true, message: "Serial numbers assigned", result };
    } catch (error: any) {
      console.error("Error in ensureSerialNumbersAssigned:", error);
      return { success: false, message: error.message || "Unknown error" };
    }
  },
});

export const checkSerialNumberFlag = internalQuery({
  args: {},
  handler: async (ctx) => {
    const flag = await ctx.db
      .query("systemFlags")
      .withIndex("by_key", (q) => q.eq("key", "serialNumbersAssigned"))
      .first();
    
    return flag?.value ?? false;
  },
});

export const setSerialNumberFlag = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("systemFlags")
      .withIndex("by_key", (q) => q.eq("key", "serialNumbersAssigned"))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { value: true, usedAt: Date.now() });
    } else {
      await ctx.db.insert("systemFlags", {
        key: "serialNumbersAssigned",
        value: true,
        usedAt: Date.now(),
      });
    }
  },
});

// Add this new internal mutation for direct serial number assignment
export const assignSequentialNumbersInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allLeads = await ctx.db.query("leads").collect();
    
    // Sort by creation time to maintain consistent ordering
    allLeads.sort((a, b) => a._creationTime - b._creationTime);
    
    let counter = 1;
    let assigned = 0;
    for (const lead of allLeads) {
      // Always assign/reassign to ensure sequential ordering
      await ctx.db.patch(lead._id, { serialNo: counter });
      assigned++;
      counter++;
    }
    
    console.log(`Assigned sequential numbers to ${assigned} leads`);
    
    return { success: true, totalLeads: allLeads.length, assigned };
  },
});