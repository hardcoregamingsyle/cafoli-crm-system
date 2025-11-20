"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Shared phone normalization helper
function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  
  // Remove all non-digit characters (spaces, dashes, parentheses, letters, etc.)
  let digits = phone.replace(/\D/g, "");
  
  if (!digits) return "";
  
  // If number already has country code (more than 10 digits), preserve it
  if (digits.length > 10) {
    // Return with just digits, no + sign
    return digits;
  }
  
  // If exactly 10 digits, add default country code 91
  if (digits.length === 10) {
    return "91" + digits;
  }
  
  // For shorter numbers, still add 91 prefix
  return "91" + digits;
}

// Shared template message sending logic (helper function)
async function sendTemplateMessageHelper(
  phoneNumber: string,
  templateName: string,
  languageCode: string
): Promise<{ success: boolean; messageId?: string; data?: any; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const version = process.env.CLOUD_API_VERSION || "v21.0";

  if (!token || !phoneId) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }

  // Normalize phone number using shared helper
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  console.log(`[WhatsApp] Sending template message to ${normalizedPhone}, template: ${templateName}`);

  try {
    const response = await fetch(
      `https://graph.facebook.com/${version}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizedPhone,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: languageCode || "en",
            },
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(`[WhatsApp] Template message failed:`, data);
      return { success: false, error: `WhatsApp API error: ${JSON.stringify(data)}` };
    }

    console.log(`[WhatsApp] Template message sent successfully:`, data);
    return { success: true, messageId: data.messages?.[0]?.id, data };
  } catch (error: any) {
    console.error(`[WhatsApp] Template message exception:`, error);
    return { success: false, error: `Failed to send WhatsApp template message: ${error.message}` };
  }
}

// Send a text message via WhatsApp
export const sendMessage = action({
  args: {
    phoneNumber: v.string(),
    message: v.string(),
    leadId: v.optional(v.id("leads")),
  },
  handler: async (ctx, args) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WA_PHONE_NUMBER_ID;
    const version = process.env.CLOUD_API_VERSION || "v21.0";

    if (!token || !phoneId) {
      throw new Error("WhatsApp credentials not configured. Please set WHATSAPP_ACCESS_TOKEN and WA_PHONE_NUMBER_ID in environment variables.");
    }

    // Normalize phone number using shared helper
    const normalizedPhone = normalizePhoneNumber(args.phoneNumber);

    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/${phoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: normalizedPhone,
            type: "text",
            text: {
              preview_url: true,
              body: args.message,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
      }

      // Log the sent message
      if (args.leadId) {
        await ctx.runMutation((internal as any).whatsappQueries.logMessage, {
          leadId: args.leadId,
          phoneNumber: normalizedPhone,
          message: args.message,
          direction: "outbound",
          messageId: data.messages?.[0]?.id || null,
          status: "sent",
        });
      }

      return { success: true, messageId: data.messages?.[0]?.id, data };
    } catch (error: any) {
      throw new Error(`Failed to send WhatsApp message: ${error.message}`);
    }
  },
});

// Send an interactive message with buttons
export const sendInteractiveMessage = action({
  args: {
    phoneNumber: v.string(),
    messageText: v.string(),
    buttons: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
      })
    ),
    leadId: v.optional(v.id("leads")),
  },
  handler: async (ctx, args) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WA_PHONE_NUMBER_ID;
    const version = process.env.CLOUD_API_VERSION || "v21.0";

    if (!token || !phoneId) {
      throw new Error("WhatsApp credentials not configured.");
    }

    // Normalize phone number using shared helper
    const normalizedPhone = normalizePhoneNumber(args.phoneNumber);

    const buttonPayload = args.buttons.slice(0, 3).map((btn) => ({
      type: "reply",
      reply: {
        id: btn.id,
        title: btn.title.slice(0, 20), // Max 20 chars
      },
    }));

    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/${phoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: normalizedPhone,
            type: "interactive",
            interactive: {
              type: "button",
              body: {
                text: args.messageText,
              },
              action: {
                buttons: buttonPayload,
              },
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
      }

      // Log the sent message
      if (args.leadId) {
        await ctx.runMutation((internal as any).whatsappQueries.logMessage, {
          leadId: args.leadId,
          phoneNumber: normalizedPhone,
          message: `[Interactive] ${args.messageText}`,
          direction: "outbound",
          messageId: data.messages?.[0]?.id || null,
          status: "sent",
        });
      }

      return { success: true, messageId: data.messages?.[0]?.id, data };
    } catch (error: any) {
      throw new Error(`Failed to send interactive message: ${error.message}`);
    }
  },
});

// Public action for sending template messages (called from UI)
export const sendTemplateMessage = action({
  args: {
    phoneNumber: v.string(),
    templateName: v.string(),
    languageCode: v.optional(v.string()),
    leadId: v.optional(v.id("leads")),
  },
  handler: async (ctx, args) => {
    const result = await sendTemplateMessageHelper(
      args.phoneNumber,
      args.templateName,
      args.languageCode || "en"
    );

    if (!result.success) {
      throw new Error(result.error || "Failed to send template message");
    }

    // Log the sent message
    if (args.leadId) {
      const normalizedPhone = normalizePhoneNumber(args.phoneNumber);
      await ctx.runMutation((internal as any).whatsappQueries.logMessage, {
        leadId: args.leadId,
        phoneNumber: normalizedPhone,
        message: `[Template: ${args.templateName}]`,
        direction: "outbound",
        messageId: result.messageId || null,
        status: "sent",
      });
    }

    return result;
  },
});

// Internal action for scheduled WhatsApp template messages (called from webhooks/crons)
export const sendTemplateMessageInternal = internalAction({
  args: {
    phoneNumber: v.string(),
    templateName: v.string(),
    languageCode: v.optional(v.string()),
    leadId: v.optional(v.id("leads")),
  },
  handler: async (ctx, args) => {
    const result = await sendTemplateMessageHelper(
      args.phoneNumber,
      args.templateName,
      args.languageCode || "en"
    );

    // Log the sent message if successful
    if (result.success && args.leadId) {
      const normalizedPhone = normalizePhoneNumber(args.phoneNumber);
      await ctx.runMutation((internal as any).whatsappQueries.logMessage, {
        leadId: args.leadId,
        phoneNumber: normalizedPhone,
        message: `[Template: ${args.templateName}]`,
        direction: "outbound",
        messageId: result.messageId || null,
        status: "sent",
      });
    }

    return result;
  },
});