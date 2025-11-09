import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Query to get WhatsApp messages for a lead
export const getLeadMessages = query({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    try {
      // Validate leadId exists and is a string
      if (!args.leadId || typeof args.leadId !== "string" || args.leadId.trim() === "") {
        console.warn("Invalid or empty leadId provided to getLeadMessages:", args.leadId);
        return [];
      }

      // Verify the lead exists first
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
    } catch (error) {
      console.error("Error in getLeadMessages for leadId:", args.leadId, "Error:", error);
      // Return empty array instead of throwing to prevent UI crashes
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