import { query } from "./_generated/server";
import { v } from "convex/values";
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
    // Auth check
    if (!args.currentUserId) return { page: [], isDone: true, continueCursor: "" };
    
    // Normalize ID
    let userId;
    try {
        userId = ctx.db.normalizeId("users", args.currentUserId);
    } catch { return { page: [], isDone: true, continueCursor: "" }; }
    
    if (!userId) return { page: [], isDone: true, continueCursor: "" };

    const user = await ctx.db.get(userId);
    if (!user || (user.role !== ROLES.ADMIN && user.role !== ROLES.MANAGER)) {
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
                q = q.filter((q: any) => q.eq(q.field("assignedTo"), args.assigneeId));
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
  }
});

export const getMyLeadsPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    currentUserId: v.optional(v.union(v.id("users"), v.string())),
    filter: v.optional(v.union(v.literal("all"), v.literal("no_followup"))),
  },
  handler: async (ctx, args) => {
    if (!args.currentUserId) return { page: [], isDone: true, continueCursor: "" };
    
    let userId;
    try {
        userId = ctx.db.normalizeId("users", args.currentUserId);
    } catch { return { page: [], isDone: true, continueCursor: "" }; }
    
    if (!userId) return { page: [], isDone: true, continueCursor: "" };

    const user = await ctx.db.get(userId);
    if (!user) return { page: [], isDone: true, continueCursor: "" };

    // Use index for assignedTo
    // We want to sort by lastActivityTime.
    // But we can't use two indexes (assignedTo AND lastActivityTime).
    // We have .index("by_assignedTo_and_assignedDate", ["assignedTo", "assignedDate"])
    // We don't have assignedTo + lastActivityTime.
    // So we must use assignedTo index and filter/sort in memory? No, paginate doesn't support in-memory sort.
    // We must use the index that gives us the order we want, and filter.
    // If we use "by_lastActivityTime", we can filter by assignedTo.
    
    let q: any = ctx.db.query("leads").withIndex("by_lastActivityTime").order("desc");
    q = q.filter((q: any) => q.eq(q.field("assignedTo"), userId));

    // Filter not relevant
    q = q.filter((q: any) => q.neq(q.field("status"), LEAD_STATUS.NOT_RELEVANT));

    if (args.filter === "no_followup") {
        q = q.filter((q: any) => q.eq(q.field("nextFollowup"), undefined));
    }

    const results = await q.paginate(args.paginationOpts);

    return results;
  }
});
