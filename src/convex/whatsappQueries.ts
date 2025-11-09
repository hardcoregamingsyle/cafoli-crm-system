import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Query to get WhatsApp messages for a lead
export const getLeadMessages = query({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    try {
      // Validate leadId is provided
      if (!args.leadId) {
        console.warn("[getLeadMessages] Called with null/undefined leadId");
        return [];
      }

      // Attempt to get the lead - this will throw if ID format is invalid
      let lead;
      try {
        lead = await ctx.db.get(args.leadId);
      } catch (idError: any) {
        console.error("[getLeadMessages] Invalid ID format:", {
          leadId: args.leadId,
          error: idError?.message
        });
        return [];
      }

      // Check if lead exists
      if (!lead) {
        console.warn("[getLeadMessages] Lead not found:", args.leadId);
        return [];
      }

      // Query messages using index for better performance
      const messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("leadId", (q) => q.eq("leadId", args.leadId))
        .collect();
      
      // Sort by timestamp ascending
      return messages.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error: any) {
      // Catch-all error handler - log and return empty array
      console.error("[getLeadMessages] Unexpected error:", {
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