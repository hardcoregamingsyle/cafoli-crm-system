import { query, internalMutation, internalQuery } from "./_generated/server";
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

      // Check if lead exists - if deleted, return empty array
      if (!lead) {
        console.warn("[getLeadMessages] Lead not found or deleted:", args.leadId);
        return [];
      }

      // Query messages using index for better performance
      const messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_leadId", (q) => q.eq("leadId", args.leadId))
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
        .withIndex("by_phoneNumber", (q) => q.eq("phoneNumber", args.phoneNumber))
        .collect();
      
      return messages.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error("Error fetching messages by phone:", error);
      return [];
    }
  },
});

// Internal query to get unread messages for a lead
export const getUnreadMessages = internalQuery({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_leadId", (q) => q.eq("leadId", args.leadId))
      .collect();
    
    return messages.filter((m) => m.direction === "inbound" && m.status !== "read");
  },
});

// Internal mutation to log WhatsApp messages
// Update lead's lastActivityTime
export const updateLeadActivity = internalMutation({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, {
      lastActivityTime: Date.now(),
    });
  },
});

export const markMessagesAsRead = internalMutation({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) return;

    // Reset unread count on lead
    await ctx.db.patch(args.leadId, {
      unreadCount: 0,
    });

    // Mark all received messages for this lead as read
    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_leadId", (q) => q.eq("leadId", args.leadId))
      .collect();

    for (const msg of messages) {
      if (msg.status === "received") {
        await ctx.db.patch(msg._id, {
          status: "read",
        });
      }
    }
  },
});

export const logMessage = internalMutation({
  args: {
    leadId: v.optional(v.id("leads")),
    phoneNumber: v.string(),
    message: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    messageId: v.union(v.string(), v.null()),
    status: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    mediaId: v.optional(v.string()),
    replyToMessageId: v.optional(v.string()),
    replyToBody: v.optional(v.string()),
    replyToSender: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      let replyToBody = args.replyToBody;
      let replyToSender = args.replyToSender;

      // If we have a reply ID but no body/sender, try to find the original message
      if (args.replyToMessageId && (!replyToBody || !replyToSender)) {
        const originalMsg = await ctx.db
          .query("whatsappMessages")
          .filter((q) => q.eq(q.field("messageId"), args.replyToMessageId))
          .first();

        if (originalMsg) {
          replyToBody = replyToBody || originalMsg.message;
          replyToSender = replyToSender || originalMsg.phoneNumber;
        }
      }

      await ctx.db.insert("whatsappMessages", {
        leadId: args.leadId,
        phoneNumber: args.phoneNumber,
        message: args.message,
        direction: args.direction,
        messageId: args.messageId || undefined,
        status: args.status || "sent",
        timestamp: Date.now(),
        mediaType: args.mediaType,
        mediaUrl: args.mediaUrl,
        mediaId: args.mediaId,
        replyToMessageId: args.replyToMessageId,
        replyToBody: replyToBody,
        replyToSender: replyToSender,
      });

      // Update lead's last message info
      if (args.leadId) {
        await ctx.db.patch(args.leadId, {
          lastMessage: args.message,
          lastMessageTime: Date.now(),
          lastMessageDirection: args.direction,
          lastMessageStatus: args.status || "sent",
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Error logging WhatsApp message:", error);
      throw error;
    }
  },
});