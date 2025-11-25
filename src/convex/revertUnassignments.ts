import { internalMutation, internalQuery } from "./_generated/server";

// One-time migration to revert unassignments that happened under old rules
// This should be run manually once to fix leads that were unassigned too early
export const revertOldUnassignments = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if already used
    const alreadyUsed = await ctx.db
      .query("systemFlags")
      .withIndex("by_key", (q) => q.eq("key", "revert_unassignments_used"))
      .first();
    
    if (alreadyUsed?.value) {
      throw new Error("This revert operation has already been used and cannot be run again.");
    }
    
    const now = Date.now();
    const allLeads = await ctx.db.query("leads").collect();
    
    let revertedCount = 0;
    
    for (const lead of allLeads) {
      // Only look at unassigned leads that have been reassigned before
      if (lead.assignedTo || !lead.reassignmentCount || lead.reassignmentCount === 0) {
        continue;
      }
      
      // Skip mature leads
      if (lead.heat === "matured") {
        continue;
      }
      
      // Check if this lead was unassigned recently (within last 30 days)
      // and would still be within the new 30-day threshold
      const lastActivity = lead.lastActivityTime || lead._creationTime;
      const timeSinceActivity = now - lastActivity;
      const daysSinceActivity = timeSinceActivity / (24 * 60 * 60 * 1000);
      
      // If it's been less than 30 days since last activity, this lead was unassigned too early
      if (daysSinceActivity < 30) {
        // Find the last comment about auto-unassignment to get context
        const comments = await ctx.db
          .query("comments")
          .withIndex("leadId", (q) => q.eq("leadId", lead._id))
          .collect();
        
        const autoUnassignComment = comments
          .filter(c => c.content?.includes("auto-unassigned due to"))
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        
        if (autoUnassignComment) {
          // This lead was auto-unassigned, revert it by resetting reassignment count
          await ctx.db.patch(lead._id, {
            reassignmentCount: Math.max(0, (lead.reassignmentCount || 1) - 1),
          });
          
          // Add a comment explaining the reversion
          const systemUser = await ctx.db.query("users").first();
          if (systemUser) {
            await ctx.db.insert("comments", {
              leadId: lead._id,
              userId: systemUser._id,
              content: `System update: Reverted auto-unassignment. New policy: 30 days inactivity threshold for reassignments. Lead is now eligible for reassignment.`,
              timestamp: now,
            });
          }
          
          revertedCount++;
        }
      }
    }
    
    // Mark as used
    const existing = await ctx.db
      .query("systemFlags")
      .withIndex("by_key", (q) => q.eq("key", "revert_unassignments_used"))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: true,
        usedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("systemFlags", {
        key: "revert_unassignments_used",
        value: true,
        usedAt: Date.now(),
      });
    }
    
    console.log(`Reverted ${revertedCount} leads that were unassigned under old rules`);
    return { revertedCount };
  },
});

export const markRevertAsUsed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("systemFlags")
      .withIndex("by_key", (q) => q.eq("key", "revert_unassignments_used"))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: true,
        usedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("systemFlags", {
        key: "revert_unassignments_used",
        value: true,
        usedAt: Date.now(),
      });
    }
  },
});

export const hasRevertBeenUsed = internalQuery({
  args: {},
  handler: async (ctx) => {
    const flag = await ctx.db
      .query("systemFlags")
      .withIndex("by_key", (q) => q.eq("key", "revert_unassignments_used"))
      .first();
    return flag?.value || false;
  },
});