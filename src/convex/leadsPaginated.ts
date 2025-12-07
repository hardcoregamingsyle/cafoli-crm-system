import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { LEAD_STATUS, ROLES } from "./schema";

export const getAllLeadsPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filter: v.optional(v.union(v.literal("all"), v.literal("assigned"), v.literal("unassigned"), v.literal("no_followup"))),
    currentUserId: v.optional(v.union(v.id("users"), v.string())),
    assigneeId: v.optional(v.union(v.id("users"), v.literal("all"), v.literal("unassigned"), v.string())),
    search: v.optional(v.string()),
    statuses: v.optional(v.array(v.string())),
    sources: v.optional(v.array(v.string())),
    heats: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    try {
      // Auth check
      if (!args.currentUserId) {
        console.log("getAllLeadsPaginated: No currentUserId provided");
        return { page: [], isDone: true, continueCursor: "" };
      }
      
      // Normalize ID
      let userId;
      try {
          userId = ctx.db.normalizeId("users", args.currentUserId);
      } catch (e) { 
        console.error("getAllLeadsPaginated: Invalid currentUserId format", args.currentUserId);
        return { page: [], isDone: true, continueCursor: "" }; 
      }
      
      if (!userId) {
        console.log("getAllLeadsPaginated: Normalized userId is null", args.currentUserId);
        return { page: [], isDone: true, continueCursor: "" };
      }

      const user = await ctx.db.get(userId);
      if (!user) {
        console.log("getAllLeadsPaginated: User not found in db", userId);
        return { page: [], isDone: true, continueCursor: "" };
      }

      if (user.role !== ROLES.ADMIN && user.role !== ROLES.MANAGER) {
          console.log("getAllLeadsPaginated: User is not ADMIN or MANAGER", user.role);
          return { page: [], isDone: true, continueCursor: "" };
      }

      // Use index for sorting by lastActivityTime desc
      let q: any = ctx.db.query("leads").withIndex("by_lastActivityTime").order("desc");

      // Apply filters
      // Base filter: Not relevant (unless specifically requested? Original logic excludes it always)
      q = q.filter((q: any) => q.neq(q.field("status"), LEAD_STATUS.NOT_RELEVANT));

      // Assignee Filter
      if (user.role === ROLES.MANAGER) {
          // Managers only see unassigned
          q = q.filter((q: any) => q.eq(q.field("assignedTo"), undefined));
      } else {
          // Admin
          if (args.assigneeId && args.assigneeId !== "all") {
              if (args.assigneeId === "unassigned") {
                  q = q.filter((q: any) => q.eq(q.field("assignedTo"), undefined));
              } else {
                  // Try to normalize assigneeId if it's a string that looks like an ID
                  let targetAssigneeId: any = args.assigneeId;
                  try {
                      const normalized = ctx.db.normalizeId("users", args.assigneeId as string);
                      if (normalized) targetAssigneeId = normalized;
                  } catch (e) {
                      // ignore
                  }
                  q = q.filter((q: any) => q.eq(q.field("assignedTo"), targetAssigneeId));
              }
          } else if (args.filter === "assigned") {
              q = q.filter((q: any) => q.neq(q.field("assignedTo"), undefined));
          } else if (args.filter === "unassigned") {
              q = q.filter((q: any) => q.eq(q.field("assignedTo"), undefined));
          }
      }

      // No Followup Filter
      if (args.filter === "no_followup") {
          q = q.filter((q: any) => q.eq(q.field("nextFollowup"), undefined));
      }

      // Statuses Filter
      if (args.statuses && args.statuses.length > 0) {
          const statuses = args.statuses;
          q = q.filter((q: any) => {
              let condition = q.eq(q.field("status"), statuses[0]);
              for (let i = 1; i < statuses.length; i++) {
                  condition = q.or(condition, q.eq(q.field("status"), statuses[i]));
              }
              return condition;
          });
      }

      // Sources Filter
      if (args.sources && args.sources.length > 0) {
          const sources = args.sources;
          q = q.filter((q: any) => {
              let condition = q.eq(q.field("source"), sources[0]);
              for (let i = 1; i < sources.length; i++) {
                  condition = q.or(condition, q.eq(q.field("source"), sources[i]));
              }
              return condition;
          });
      }

      // Heats Filter
      if (args.heats && args.heats.length > 0) {
          const heats = args.heats;
          q = q.filter((q: any) => {
              let condition = q.eq(q.field("heat"), heats[0]);
              for (let i = 1; i < heats.length; i++) {
                  condition = q.or(condition, q.eq(q.field("heat"), heats[i]));
              }
              return condition;
          });
      }

      const results = await q.paginate(args.paginationOpts);

      // Enrich
      const enrichedPage = await Promise.all(results.page.map(async (lead: any) => {
          let assignedUserName = "Unknown";
          if (lead.assignedTo) {
              const u: any = await ctx.db.get(lead.assignedTo);
              if (u) assignedUserName = u.name || u.username || "Unknown";
          }
          return { ...lead, assignedUserName };
      }));

      return { ...results, page: enrichedPage };
    } catch (error: any) {
      console.error("Error in getAllLeadsPaginated:", error);
      // Use ConvexError to pass the message to the client
      throw new ConvexError(`Failed to fetch leads: ${error.message}`);
    }
  }
});

export const getMyLeadsPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    currentUserId: v.optional(v.union(v.id("users"), v.string())),
    filter: v.optional(v.union(v.literal("all"), v.literal("no_followup"))),
  },
  handler: async (ctx, args) => {
    try {
      if (!args.currentUserId) return { page: [], isDone: true, continueCursor: "" };
      
      let userId;
      try {
          userId = ctx.db.normalizeId("users", args.currentUserId);
      } catch { return { page: [], isDone: true, continueCursor: "" }; }
      
      if (!userId) return { page: [], isDone: true, continueCursor: "" };

      const user = await ctx.db.get(userId);
      if (!user) return { page: [], isDone: true, continueCursor: "" };

      let q: any = ctx.db.query("leads").withIndex("by_lastActivityTime").order("desc");
      q = q.filter((q: any) => q.eq(q.field("assignedTo"), userId));

      // Filter not relevant
      q = q.filter((q: any) => q.neq(q.field("status"), LEAD_STATUS.NOT_RELEVANT));

      if (args.filter === "no_followup") {
          q = q.filter((q: any) => q.eq(q.field("nextFollowup"), undefined));
      }

      const results = await q.paginate(args.paginationOpts);

      return results;
    } catch (error: any) {
      console.error("Error in getMyLeadsPaginated:", error);
      throw new ConvexError(`Failed to fetch my leads: ${error.message}`);
    }
  }
});