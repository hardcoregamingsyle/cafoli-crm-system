import { internalMutation } from "./_generated/server";

// One-time migration to revert unassignments that happened under old rules
// This should be run manually once to fix leads that were unassigned too early
export const revertOldUnassignments = internalMutation({
  args: {},
  handler: async (ctx) => {
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
    
    console.log(`Reverted ${revertedCount} leads that were unassigned under old rules`);
    return { revertedCount };
  },
});
