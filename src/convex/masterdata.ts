import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ROLES } from "./schema";

// Upload masterdata leads (Admin only)
export const uploadMasterdata = mutation({
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
        source: v.string(),
        station: v.optional(v.string()),
        district: v.optional(v.string()),
        pincode: v.optional(v.string()),
        agencyName: v.optional(v.string()),
      })
    ),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user || user.role !== ROLES.ADMIN) {
      throw new Error("Only admins can upload masterdata");
    }

    let count = 0;
    for (const lead of args.leads) {
      await ctx.db.insert("masterdata", {
        ...lead,
        isAssigned: false,
      });
      count++;
    }

    return { success: true, count };
  },
});

// Get available masterdata count (Admin only)
export const getAvailableMasterdataCount = query({
  args: { currentUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.currentUserId) {
      return 0;
    }
    
    const user = await ctx.db.get(args.currentUserId);
    if (!user || user.role !== ROLES.ADMIN) {
      return 0;
    }

    const available = await ctx.db
      .query("masterdata")
      .withIndex("by_isAssigned", (q) => q.eq("isAssigned", false))
      .collect();

    return available.length;
  },
});

// Request leads (Manager/Staff)
export const requestLeads = mutation({
  args: {
    numberOfLeads: v.number(),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user || user.role === ROLES.ADMIN) {
      throw new Error("Only managers and staff can request leads");
    }

    if (args.numberOfLeads < 1) {
      throw new Error("Number of leads must be at least 1");
    }

    // Check if there's already a pending request
    const existingRequest = await ctx.db
      .query("leadRequests")
      .withIndex("by_requestedBy", (q) => q.eq("requestedBy", args.currentUserId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingRequest) {
      throw new Error("You already have a pending request");
    }

    const requestId = await ctx.db.insert("leadRequests", {
      requestedBy: args.currentUserId,
      requestedByName: user.name || user.username || "Unknown",
      requestedByRole: user.role || "staff",
      numberOfLeads: args.numberOfLeads,
      status: "pending",
    });

    return { success: true, requestId };
  },
});

// Get pending requests (Admin only)
export const getPendingRequests = query({
  args: { currentUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // Return empty array if no currentUserId provided
    if (!args.currentUserId) {
      return [];
    }
    
    // Get user and validate
    const user = await ctx.db.get(args.currentUserId);
    
    // Return empty array if user doesn't exist
    if (!user) {
      return [];
    }
    
    // Return empty array if user is not an admin
    if (user.role !== ROLES.ADMIN) {
      return [];
    }

    // Only fetch requests if all checks pass
    const requests = await ctx.db
      .query("leadRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return requests;
  },
});

// Get my request status (Manager/Staff)
export const getMyRequestStatus = query({
  args: { currentUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.currentUserId) {
      return null;
    }
    
    const user = await ctx.db.get(args.currentUserId);
    if (!user) {
      return null;
    }

    // Add additional check: only proceed if user is not an admin
    if (user.role === ROLES.ADMIN) {
      return null;
    }

    const request = await ctx.db
      .query("leadRequests")
      .withIndex("by_requestedBy", (q) => q.eq("requestedBy", user._id))
      .order("desc")
      .first();

    return request || null;
  },
});

// Process request (Admin only)
export const processLeadRequest = mutation({
  args: {
    requestId: v.id("leadRequests"),
    action: v.union(v.literal("accept"), v.literal("decline")),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.currentUserId);
    if (!admin || admin.role !== ROLES.ADMIN) {
      throw new Error("Only admins can process requests");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Request already processed");
    }

    if (args.action === "accept") {
      // Get available masterdata
      const available = await ctx.db
        .query("masterdata")
        .withIndex("by_isAssigned", (q) => q.eq("isAssigned", false))
        .take(request.numberOfLeads);

      if (available.length < request.numberOfLeads) {
        throw new Error(`Only ${available.length} leads available, but ${request.numberOfLeads} requested`);
      }

      // Convert masterdata to leads and assign to requester
      for (const masterLead of available) {
        await ctx.db.insert("leads", {
          name: masterLead.name,
          subject: masterLead.subject,
          message: masterLead.message,
          mobileNo: masterLead.mobileNo,
          email: masterLead.email,
          altMobileNo: masterLead.altMobileNo,
          altEmail: masterLead.altEmail,
          state: masterLead.state,
          source: masterLead.source,
          station: masterLead.station,
          district: masterLead.district,
          pincode: masterLead.pincode,
          agencyName: masterLead.agencyName,
          status: "yet_to_decide",
          assignedTo: request.requestedBy,
        });

        // Mark masterdata as assigned
        await ctx.db.patch(masterLead._id, { isAssigned: true });
      }

      // Update request status
      await ctx.db.patch(args.requestId, {
        status: "accepted",
        processedBy: args.currentUserId,
        processedAt: Date.now(),
      });

      return { success: true, assigned: available.length };
    } else {
      // Decline request
      await ctx.db.patch(args.requestId, {
        status: "declined",
        processedBy: args.currentUserId,
        processedAt: Date.now(),
      });

      return { success: true, declined: true };
    }
  },
});