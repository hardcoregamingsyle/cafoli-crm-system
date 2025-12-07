import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const runBatchedAssignment = internalAction({
  args: {},
  handler: async (ctx) => {
    // Find an admin user using internal query to bypass auth checks
    const adminUser = await ctx.runQuery(internal.users.getAnyAdminUser, {});
    
    if (!adminUser) {
      throw new Error("No admin user found");
    }
    
    let totalProcessed = 0;
    let hasMore = true;
    let lastProcessedTime: number | undefined = undefined;
    let batchCount = 0;
    
    while (hasMore && batchCount < 100) { // Safety limit of 100 batches
      const result: any = await ctx.runMutation(api.leads.assignSerialNumbersBatched, {
        currentUserId: adminUser._id,
        batchSize: 100,
        startAfter: lastProcessedTime,
      });
      
      totalProcessed += result.processed;
      hasMore = result.hasMore;
      lastProcessedTime = result.lastProcessedTime;
      batchCount++;
      
      console.log(`Batch ${batchCount}: Processed ${result.processed} leads. Total: ${totalProcessed}`);
      
      if (!hasMore) {
        console.log(`✅ Complete! Assigned serial numbers to ${totalProcessed} leads in ${batchCount} batches.`);
        break;
      }
    }
    
    return {
      success: true,
      totalProcessed,
      batchCount,
      message: `Assigned serial numbers to ${totalProcessed} leads in ${batchCount} batches`
    };
  },
});