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

  console.log(`[WhatsApp Debug] Environment check:`, {
    hasToken: !!token,
    tokenLength: token?.length || 0,
    hasPhoneId: !!phoneId,
    phoneId: phoneId || 'missing',
    version,
  });

  if (!token || !phoneId) {
    const errorMsg = `WhatsApp credentials not configured. Missing: ${!token ? 'WHATSAPP_ACCESS_TOKEN' : ''} ${!phoneId ? 'WA_PHONE_NUMBER_ID' : ''}`;
    console.error(`[WhatsApp] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // Normalize phone number using shared helper
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (!normalizedPhone || normalizedPhone.length < 10) {
    const errorMsg = `Invalid phone number: ${phoneNumber} (normalized: ${normalizedPhone})`;
    console.error(`[WhatsApp] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  console.log(`[WhatsApp] Sending template message to ${normalizedPhone}, template: ${templateName}`);

  try {
    const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
    const payload = {
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
    };

    console.log(`[WhatsApp] Request URL: ${url}`);
    console.log(`[WhatsApp] Request payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log(`[WhatsApp] Response status: ${response.status}`);
    console.log(`[WhatsApp] Response data:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      const errorDetails = data.error?.error_user_msg || data.error?.message || JSON.stringify(data);
      const errorMsg = `WhatsApp API error (${response.status}): ${errorDetails}`;
      console.error(`[WhatsApp] Template message failed:`, {
        status: response.status,
        statusText: response.statusText,
        error: data.error,
        fullResponse: data,
      });
      return { success: false, error: errorMsg, data };
    }

    console.log(`[WhatsApp] Template message sent successfully:`, data);
    return { success: true, messageId: data.messages?.[0]?.id, data };
  } catch (error: any) {
    const errorMsg = `Network error sending WhatsApp template: ${error.message}`;
    console.error(`[WhatsApp] Template message exception:`, {
      message: error.message,
      stack: error.stack,
      error,
    });
    return { success: false, error: errorMsg };
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
        await ctx.runMutation(internal.whatsappQueries.logMessage, {
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
        await ctx.runMutation(internal.whatsappQueries.logMessage, {
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
    console.log(`[WhatsApp] sendTemplateMessage called with:`, { 
      phoneNumber: args.phoneNumber, 
      templateName: args.templateName,
      leadId: args.leadId 
    });

    const result = await sendTemplateMessageHelper(
      args.phoneNumber,
      args.templateName,
      args.languageCode || "en"
    );

    if (!result.success) {
      console.error("[WhatsApp] sendTemplateMessage failed:", result.error);
      console.error("[WhatsApp] Full error details:", JSON.stringify(result.data || {}, null, 2));
      // Throw a detailed error message so it reaches the client
      throw new Error(result.error || "Failed to send template message");
    }

    // Log the sent message
    if (args.leadId) {
      try {
        const normalizedPhone = normalizePhoneNumber(args.phoneNumber);
        await ctx.runMutation(internal.whatsappQueries.logMessage, {
          leadId: args.leadId,
          phoneNumber: normalizedPhone,
          message: `[Template: ${args.templateName}]`,
          direction: "outbound",
          messageId: result.messageId || null,
          status: "sent",
        });
      } catch (logError) {
        console.error("[WhatsApp] Failed to log message:", logError);
        // Don't throw - message was sent successfully
      }
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
    console.log(`[WhatsApp Internal] sendTemplateMessageInternal called with:`, { 
      phoneNumber: args.phoneNumber, 
      templateName: args.templateName,
      leadId: args.leadId 
    });

    const result = await sendTemplateMessageHelper(
      args.phoneNumber,
      args.templateName,
      args.languageCode || "en"
    );

    if (!result.success) {
      console.error("[WhatsApp Internal] Template send failed:", result.error);
      // Don't throw - just log and return the error so webhook processing continues
    }

    // Log the sent message if successful
    if (result.success && args.leadId) {
      try {
        const normalizedPhone = normalizePhoneNumber(args.phoneNumber);
        await ctx.runMutation(internal.whatsappQueries.logMessage, {
          leadId: args.leadId,
          phoneNumber: normalizedPhone,
          message: `[Template: ${args.templateName}]`,
          direction: "outbound",
          messageId: result.messageId || null,
          status: "sent",
        });
      } catch (logError) {
        console.error("[WhatsApp Internal] Failed to log message:", logError);
        // Don't throw - message was sent successfully
      }
    }

    return result;
  },
});