import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Query to get WhatsApp messages for a lead
export const getLeadMessages = query({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    // Early validation with comprehensive checks
    if (!args.leadId) {
      console.warn("getLeadMessages called with null/undefined leadId");
      return [];
    }

    try {
      // Verify the lead exists first before querying messages
      const lead = await ctx.db.get(args.leadId);
      if (!lead) {
        console.log("Lead not found for leadId:", args.leadId);
        return [];
      }

      // Query messages with filter
      const messages = await ctx.db
        .query("whatsappMessages")
        .filter((q) => q.eq(q.field("leadId"), args.leadId))
        .collect();
      
      return messages.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error: any) {
      // Log the error but don't throw - return empty array to prevent UI crashes
      console.error("Error in getLeadMessages:", {
        leadId: args.leadId,
        error: error?.message || String(error),
        stack: error?.stack
      });
      return [];
    }
  },
});

// Query to get all WhatsApp messages for a phone number
export const getMessagesByPhone = query({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("phoneNumber", (q) => q.eq("phoneNumber", args.phoneNumber))
        .collect();
      
      return messages.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error("Error fetching messages by phone:", error);
      return [];
    }
  },
});

// Internal mutation to log WhatsApp messages
export const logMessage = internalMutation({
  args: {
    leadId: v.optional(v.id("leads")),
    phoneNumber: v.string(),
    message: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    messageId: v.union(v.string(), v.null()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.db.insert("whatsappMessages", {
        leadId: args.leadId,
        phoneNumber: args.phoneNumber,
        message: args.message,
        direction: args.direction,
        messageId: args.messageId,
        status: args.status || "sent",
        timestamp: Date.now(),
      });
      return { success: true };
    } catch (error) {
      console.error("Error logging WhatsApp message:", error);
      throw error;
    }
  },
});