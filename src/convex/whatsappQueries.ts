import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Query to get WhatsApp messages for a lead
export const getLeadMessages = query({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("leadId", (q) => q.eq("leadId", args.leadId))
      .collect();
    
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  },
});

// Query to get all WhatsApp messages for a phone number
export const getMessagesByPhone = query({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", args.phoneNumber))
      .collect();
    
    return messages.sort((a, b) => a.timestamp - b.timestamp);
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
  },
});