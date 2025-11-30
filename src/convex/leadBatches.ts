import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

const BATCH_SIZE = 500;

// Get or create the current active batch
export const getOrCreateActiveBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find the current active batch
    const activeBatch = await ctx.db
      .query("leadBatches")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();

    if (activeBatch && activeBatch.currentCount < activeBatch.maxSize) {
      return activeBatch._id;
    }

    // If active batch is full or doesn't exist, create a new one
    const allBatches = await ctx.db.query("leadBatches").collect();
    const maxBatchNumber = allBatches.length > 0 
      ? Math.max(...allBatches.map(b => b.batchNumber))
      : 0;

    const newBatchId = await ctx.db.insert("leadBatches", {
      batchNumber: maxBatchNumber + 1,
      currentCount: 0,
      maxSize: BATCH_SIZE,
      status: "active",
      createdAt: Date.now(),
    });

    // Mark the old batch as full if it exists
    if (activeBatch) {
      await ctx.db.patch(activeBatch._id, { status: "full" });
    }

    return newBatchId;
  },
});

// Increment batch count when a lead is added
export const incrementBatchCount = internalMutation({
  args: {
    batchId: v.id("leadBatches"),
  },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch) return;

    const newCount = batch.currentCount + 1;
    
    await ctx.db.patch(args.batchId, {
      currentCount: newCount,
      status: newCount >= batch.maxSize ? "full" : "active",
    });
  },
});

// Get all batches
export const getAllBatches = query({
  args: {},
  handler: async (ctx) => {
    const batches = await ctx.db
      .query("leadBatches")
      .order("desc")
      .collect();
    
    return batches;
  },
});

// Get leads by batch
export const getLeadsByBatch = query({
  args: {
    batchId: v.id("leadBatches"),
  },
  handler: async (ctx, args) => {
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();
    
    return leads;
  },
});

// Get batch statistics
export const getBatchStats = query({
  args: {},
  handler: async (ctx) => {
    const batches = await ctx.db.query("leadBatches").collect();
    const activeBatch = batches.find(b => b.status === "active");
    
    return {
      totalBatches: batches.length,
      activeBatch: activeBatch ? {
        batchNumber: activeBatch.batchNumber,
        currentCount: activeBatch.currentCount,
        maxSize: activeBatch.maxSize,
      } : null,
      fullBatches: batches.filter(b => b.status === "full").length,
    };
  },
});
