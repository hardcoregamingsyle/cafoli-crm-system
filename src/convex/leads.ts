import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";
import { ROLES, LEAD_STATUS, leadStatusValidator } from "./schema";

// Get all leads (Admin and Manager only)
export const getAllLeads = query({
  args: {
    filter: v.optional(v.union(v.literal("all"), v.literal("assigned"), v.literal("unassigned"))),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Resolve current user using passed id or session
    let currentUser = args.currentUserId
      ? await (args.currentUserId ? ctx.db.get(args.currentUserId) : null)
      : await getCurrentUser(ctx);

    // Fallback: if a provided currentUserId is stale/unresolvable (e.g., from another deployment),
    // try to resolve the Owner admin so the page can still function in deployment.
    if (!currentUser && args.currentUserId) {
      try {
        const owner = await ctx.db
          .query("users")
          .withIndex("username", (q: any) => q.eq("username", "Owner"))
          .unique();
        if (owner) {
          currentUser = owner;
        }
      } catch {
        // ignore; will fallback to [] below
      }
    }

    if (!currentUser || (currentUser.role !== ROLES.ADMIN && currentUser.role !== ROLES.MANAGER)) {
      return [];
    }
    
    let leads = await ctx.db.query("leads").collect();
    
    // Apply filter
    if (args.filter === "assigned") {
      leads = leads.filter(lead => lead.assignedTo !== undefined);
    } else if (args.filter === "unassigned") {
      leads = leads.filter(lead => lead.assignedTo === undefined);
    }
    
    // Sort oldest to newest
    leads.sort((a, b) => a._creationTime - b._creationTime);
    
    // Get assigned user names
    const leadsWithAssignedUser = await Promise.all(
      leads.map(async (lead) => {
        let assignedUserName = null;
        if (lead.assignedTo) {
          const assignedUser = await ctx.db.get(lead.assignedTo);
          assignedUserName = assignedUser?.name || assignedUser?.username || "Unknown";
        }
        return { ...lead, assignedUserName };
      })
    );
    
    return leadsWithAssignedUser;
  },
});

// Get leads assigned to current user (Manager and Staff only)
export const getMyLeads = query({
  args: { currentUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const currentUser = args.currentUserId
      ? await ctx.db.get(args.currentUserId)
      : await getCurrentUser(ctx);
    if (!currentUser || currentUser.role === ROLES.ADMIN) {
      return [];
    }
    
    const leads = await ctx.db
      .query("leads")
      .withIndex("assignedTo", (q) => q.eq("assignedTo", currentUser._id))
      .collect();
    
    // Sort oldest to newest
    leads.sort((a, b) => a._creationTime - b._creationTime);
    
    return leads;
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

      // Audit log the clubbing
      await ctx.db.insert("auditLogs", {
        userId: (await ctx.db.query("users").first())?._id as any,
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
    if (!currentUser || (currentUser.role !== ROLES.ADMIN && currentUser.role !== ROLES.MANAGER)) {
      throw new Error("Unauthorized");
    }
    
    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }
    
    await ctx.db.patch(args.leadId, { assignedTo: args.assignedTo });
    
    // Create notification if assigning to someone
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
    
    // Log the action
    const assignedUser = args.assignedTo ? await ctx.db.get(args.assignedTo) : null;
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
    
    if (args.status === LEAD_STATUS.NOT_RELEVANT) {
      // Delete the lead
      await ctx.db.delete(args.leadId);
      
      // Log the action
      await ctx.db.insert("auditLogs", {
        userId: currentUser._id,
        action: "DELETE_LEAD",
        details: `Marked lead "${lead.name}" as not relevant and deleted`,
        timestamp: Date.now(),
      });
    } else {
      await ctx.db.patch(args.leadId, { status: args.status });
      
      // Log the action
      await ctx.db.insert("auditLogs", {
        userId: currentUser._id,
        action: "UPDATE_LEAD_STATUS",
        details: `Updated lead "${lead.name}" status to ${args.status}`,
        timestamp: Date.now(),
        relatedLeadId: args.leadId,
      });
    }
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
      const existing = await findDuplicateLead(ctx, incoming.mobileNo, incoming.email);

      if (existing) {
        // Club records: fill missing/empty fields from incoming
        const patch: Record<string, any> = {};
        if (!existing.name && incoming.name) patch.name = incoming.name;
        if (!existing.subject && incoming.subject) patch.subject = incoming.subject;
        if (!existing.message && incoming.message) patch.message = incoming.message;
        if (!existing.altMobileNo && incoming.altMobileNo) patch.altMobileNo = incoming.altMobileNo;
        if (!existing.altEmail && incoming.altEmail) patch.altEmail = incoming.altEmail;
        if (!existing.state && incoming.state) patch.state = incoming.state;
        if (!existing.source && incoming.source) patch.source = incoming.source;

        // Assignment logic:
        // - If existing has assignee, keep it and notify them about duplicate clubbing
        // - Else if bulk assignedTo provided, assign and notify
        let assignedJustNow = false;
        if (!existing.assignedTo && args.assignedTo) {
          patch.assignedTo = args.assignedTo;
          assignedJustNow = true;
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
        } else if (assignedJustNow && args.assignedTo) {
          await ctx.db.insert("notifications", {
            userId: args.assignedTo,
            title: "New Lead Assigned",
            message: `A lead was clubbed into an existing entry and assigned to you.`,
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
        // Create fresh lead
        const leadId = await ctx.db.insert("leads", {
          ...incoming,
          status: LEAD_STATUS.YET_TO_DECIDE,
          assignedTo: args.assignedTo,
        });

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