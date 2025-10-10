import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { Id } from "./_generated/dataModel";
import { ROLES, LEAD_STATUS, leadStatusValidator } from "./schema";
import { internal } from "./_generated/api";

// Helper to get current user from auth
async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("email", (q: any) => q.eq("email", identity.email))
    .first();
  return user;
}

// Helper to resolve user by ID or string
async function resolveUser(ctx: any, userId: any) {
  if (!userId) return null;
  try {
    if (typeof userId === "string" && userId.length === 32) {
      return await ctx.db.get(userId as Id<"users">);
    } else if (typeof userId === "string" && userId.length > 20) {
      return await ctx.db.get(userId as any);
    }
    return null;
  } catch {
    return null;
  }
}

// Helper to resolve user ID from string
async function resolveUserId(ctx: any, userId: any) {
  if (!userId) return null;
  try {
    if (typeof userId === "string" && userId.length === 32) {
      return await ctx.db.get(userId as Id<"users">);
    } else if (typeof userId === "string" && userId.length > 20) {
      return await ctx.db.get(userId as any);
    }
    return null;
  } catch {
    return null;
  }
}

// Get all leads (Admin and Manager only)
export const getAllLeads = query({
  args: {
    filter: v.union(v.literal("all"), v.literal("assigned"), v.literal("unassigned")),
    currentUserId: v.union(v.id("users"), v.string()),
    assigneeId: v.optional(v.union(v.id("users"), v.string())),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    try {
      const currentUser = await resolveUser(ctx, args.currentUserId);
      if (!currentUser) {
        console.error("[getAllLeads] User not found or invalid ID");
        return { page: [], isDone: true, continueCursor: null };
      }

      if (currentUser.role !== ROLES.ADMIN && currentUser.role !== ROLES.MANAGER) {
        console.error("[getAllLeads] Unauthorized access attempt");
        return { page: [], isDone: true, continueCursor: null };
      }

      let result;

      // Build query based on filters
      if (args.assigneeId) {
        const assigneeIdResolved = await resolveUserId(ctx, args.assigneeId);
        if (!assigneeIdResolved) {
          return { page: [], isDone: true, continueCursor: null };
        }
        result = await ctx.db
          .query("leads")
          .withIndex("assignedTo", (q) => q.eq("assignedTo", assigneeIdResolved._id))
          .filter((q) => q.neq(q.field("status"), "not_relevant"))
          .order("desc")
          .paginate(args.paginationOpts);
      } else if (args.filter === "assigned") {
        result = await ctx.db
          .query("leads")
          .filter((q) => q.neq(q.field("status"), "not_relevant"))
          .filter((q) => q.neq(q.field("assignedTo"), undefined))
          .order("desc")
          .paginate(args.paginationOpts);
      } else if (args.filter === "unassigned") {
        result = await ctx.db
          .query("leads")
          .filter((q) => q.neq(q.field("status"), "not_relevant"))
          .filter((q) => q.eq(q.field("assignedTo"), undefined))
          .order("desc")
          .paginate(args.paginationOpts);
      } else {
        result = await ctx.db
          .query("leads")
          .filter((q) => q.neq(q.field("status"), "not_relevant"))
          .order("desc")
          .paginate(args.paginationOpts);
      }

      const enrichedPage = await Promise.all(
        result.page.map(async (lead) => {
          let assignedUserName = undefined;
          if (lead.assignedTo) {
            try {
              const assignedUser = await ctx.db.get(lead.assignedTo);
              assignedUserName = assignedUser?.name || assignedUser?.username;
            } catch (e) {
              console.error("[getAllLeads] Error fetching assigned user:", e);
            }
          }
          return { ...lead, assignedUserName };
        })
      );

      return {
        page: enrichedPage,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    } catch (error) {
      console.error("[getAllLeads] Error:", error);
      return { page: [], isDone: true, continueCursor: null };
    }
  },
});

// Get leads assigned to current user (Manager and Staff only)
export const getMyLeads = query({
  args: {
    currentUserId: v.union(v.id("users"), v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    try {
      const currentUser = await resolveUser(ctx, args.currentUserId);
      if (!currentUser) {
        console.error("[getMyLeads] User not found");
        return { page: [], isDone: true, continueCursor: null };
      }

      const result = await ctx.db
        .query("leads")
        .withIndex("assignedTo", (q) => q.eq("assignedTo", currentUser._id))
        .filter((q) => q.neq(q.field("status"), "not_relevant"))
        .order("desc")
        .paginate(args.paginationOpts);

      return {
        page: result.page,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    } catch (error) {
      console.error("[getMyLeads] Error:", error);
      return { page: [], isDone: true, continueCursor: null };
    }
  },
});

// Get all leads marked as not relevant (Admin only)
export const getNotRelevantLeads = query({
  args: {
    currentUserId: v.union(v.id("users"), v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    try {
      const currentUser = await resolveUser(ctx, args.currentUserId);
      if (!currentUser || currentUser.role !== ROLES.ADMIN) {
        return { page: [], isDone: true, continueCursor: null };
      }

      const result = await ctx.db
        .query("leads")
        .withIndex("status", (q) => q.eq("status", "not_relevant"))
        .order("desc")
        .paginate(args.paginationOpts);

      const enrichedPage = await Promise.all(
        result.page.map(async (lead) => {
          let assignedUserName = undefined;
          if (lead.assignedTo) {
            try {
              const assignedUser = await ctx.db.get(lead.assignedTo);
              assignedUserName = assignedUser?.name || assignedUser?.username;
            } catch (e) {
              console.error("[getNotRelevantLeads] Error fetching assigned user:", e);
            }
          }
          return { ...lead, assignedUserName };
        })
      );

      return {
        page: enrichedPage,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    } catch (error) {
      console.error("[getNotRelevantLeads] Error:", error);
      return { page: [], isDone: true, continueCursor: null };
    }
  },
});

async function findDuplicateLead(ctx: any, mobileNo: string, email: string) {
  // Prefer exact mobile match, then email
  const byMobile = mobileNo
    ? await ctx.db
        .query("leads")
        .withIndex("mobileNo", (q: any) => q.eq("mobileNo", mobileNo))
        .unique()
    : null;

  if (byMobile) return byMobile;

  const byEmail = email
    ? await ctx.db
        .query("leads")
        .withIndex("email", (q: any) => q.eq("email", email))
        .unique()
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
    // Check if this lead was previously marked as not relevant
    if (await wasMarkedNotRelevant(ctx, args.mobileNo, args.email)) {
      // Silently skip creating this lead
      return null;
    }

    const existing = await findDuplicateLead(ctx, args.mobileNo, args.email);

    if (existing) {
      // Club records: patch any missing/empty fields on the existing doc
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

      // If existing is already assigned, notify assignee about the clubbed lead
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

      // Audit log the clubbing (replace .first() with a safe lookup)
      let anyUserId: any = null;
      const anyUsers = await ctx.db.query("users").collect();
      if (anyUsers.length > 0) {
        anyUserId = anyUsers[0]._id;
      }
      await ctx.db.insert("auditLogs", {
        userId: anyUserId,
        action: "CLUB_DUPLICATE_LEAD",
        details: `Clubbed new lead into existing lead ${existing._id}`,
        timestamp: Date.now(),
        relatedLeadId: existing._id,
      });

      return existing._id;
    }

    // No duplicate: create new lead
    const leadId = await ctx.db.insert("leads", {
      ...args,
      status: LEAD_STATUS.YET_TO_DECIDE,
    });

    // NEW: Send welcome email immediately on creation if email is valid
    try {
      const email = (args.email || "").trim().toLowerCase();
      if (email && email !== "unknown@example.com") {
        await ctx.scheduler.runAfter(0, (internal as any).emails.sendRelevant, { to: email });
      }
    } catch {
      // Do not block creation on email errors
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

    await ctx.db.patch(args.leadId, { assignedTo: args.assignedTo });

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
    if ((lead as any).assignedTo !== currentUser._id) {
      throw new Error("You can only update leads assigned to you");
    }
    
    // Instead of deleting, just mark as not relevant
    await ctx.db.patch(args.leadId, { status: args.status });

    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: args.status === LEAD_STATUS.NOT_RELEVANT ? "MARK_NOT_RELEVANT" : "UPDATE_LEAD_STATUS",
      details: `Updated lead "${(lead as any).name}" status to ${args.status}`,
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
      // Check if this lead was previously marked as not relevant
      if (await wasMarkedNotRelevant(ctx, incoming.mobileNo, incoming.email)) {
        // Skip this lead silently
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
            // Override CSV values with pincode mapping
            finalState = mapping.state;
            finalDistrict = mapping.district;
          }
        }
      }

      const existing = await findDuplicateLead(ctx, incoming.mobileNo, incoming.email);

      if (existing) {
        // Club records: fill missing/empty fields from incoming
        const patch: Record<string, any> = {};
        if (!existing.name && incoming.name) patch.name = incoming.name;
        if (!existing.subject && incoming.subject) patch.subject = incoming.subject;
        if (!existing.message && incoming.message) patch.message = incoming.message;
        if (!existing.altMobileNo && incoming.altMobileNo) patch.altMobileNo = incoming.altMobileNo;
        if (!existing.altEmail && incoming.altEmail) patch.altEmail = incoming.altEmail;
        if (!existing.state && finalState) patch.state = finalState;
        if (!existing.source && incoming.source) patch.source = incoming.source;
        // Add extended fields when missing
        if (!existing.station && incoming.station) patch.station = incoming.station;
        if (!existing.district && finalDistrict) patch.district = finalDistrict;
        if (!existing.pincode && incoming.pincode) patch.pincode = incoming.pincode;
        if (!existing.agencyName && incoming.agencyName) patch.agencyName = incoming.agencyName;

        // Assignment logic (updated):
        // - If args.assignedTo provided:
        //    - If existing unassigned -> assign to args.assignedTo
        //    - If existing assigned (different) -> reassign to args.assignedTo (prefer incoming group)
        let assignedJustNow = false;
        let assignmentChanged = false;
        if (args.assignedTo) {
          if (!existing.assignedTo) {
            patch.assignedTo = args.assignedTo;
            assignedJustNow = true;
          } else if (String(existing.assignedTo) !== String(args.assignedTo)) {
            patch.assignedTo = args.assignedTo;
            assignmentChanged = true;
          }
        }

        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existing._id, patch);
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
        // Notify new assignee in both assign and reassign cases
        if ((assignedJustNow || assignmentChanged) && args.assignedTo) {
          await ctx.db.insert("notifications", {
            userId: args.assignedTo,
            title: "Lead Assigned",
            message: `A lead was ${assignmentChanged ? "reassigned" : "assigned"} to you via import.`,
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
        // Create fresh lead including extended fields with pincode-mapped state/district
        const leadId = await ctx.db.insert("leads", {
          ...incoming,
          state: finalState,
          district: finalDistrict,
          status: LEAD_STATUS.YET_TO_DECIDE,
          assignedTo: args.assignedTo,
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

    // Load all leads
    const all = await ctx.db.query("leads").collect();
    if (all.length === 0) {
      return { groupsProcessed: 0, mergedCount: 0, deletedCount: 0, notificationsSent: 0 };
    }

    // Build groups by mobileNo and email
    type Group = { key: string; members: typeof all };
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

      // Build patch by filling missing fields
      const patch: Record<string, any> = {};
      for (const r of rest) {
        if (!primary.name && r.name) patch.name = r.name;
        if (!primary.subject && r.subject) patch.subject = r.subject;
        if (!primary.message && r.message) patch.message = r.message;
        if (!primary.altMobileNo && r.altMobileNo) patch.altMobileNo = r.altMobileNo;
        if (!primary.altEmail && r.altEmail) patch.altEmail = r.altEmail;
        if (!primary.state && r.state) patch.state = r.state;
        if (!primary.source && r.source) patch.source = r.source;
      }

      // Assignment rule:
      // - If primary has assignedTo, keep it
      // - Else, if any member has assignedTo, set that on primary (use the first one encountered)
      if (!primary.assignedTo) {
        const assignedFromOthers = rest.find(r => !!r.assignedTo)?.assignedTo;
        if (assignedFromOthers) {
          patch.assignedTo = assignedFromOthers;
        }
      }

      // Preserve the original nextFollowup on the primary lead by not overriding it here.
      // We intentionally do NOT copy nextFollowup from duplicates to keep the old one.

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

      // Notify the assignee if there is one
      const assignee = (patch.assignedTo ?? primary.assignedTo) as any;
      if (assignee) {
        await ctx.db.insert("notifications", {
          userId: assignee,
          title: "Duplicate Leads Clubbed",
          message: "Some duplicate leads were clubbed into one of your assigned leads.",
          read: false,
          type: "lead_assigned",
          relatedLeadId: primary._id,
        });
        notificationsSent++;
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
        details: `Clubbed ${rest.length} duplicate(s) into lead ${primary._id}`,
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

    await ctx.db.delete(args.leadId);

    await ctx.db.insert("auditLogs", {
      userId: currentUser._id,
      action: "DELETE_LEAD_ADMIN",
      details: `Admin deleted lead "${lead.name}" (${String(args.leadId)})`,
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