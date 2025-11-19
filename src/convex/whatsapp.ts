"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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

    // Normalize phone number (ensure it has country code, remove spaces/signs except +)
    let normalizedPhone = args.phoneNumber.trim();
    const hasPlus = normalizedPhone.startsWith("+");
    // Remove all non-digits
    let digits = normalizedPhone.replace(/\D/g, "");
    // Reconstruct with country code
    if (hasPlus || digits.length > 10) {
      normalizedPhone = "+" + digits;
    } else if (digits.length === 10) {
      normalizedPhone = "+91" + digits;
    } else if (digits.length > 0) {
      normalizedPhone = "+91" + digits;
    } else {
      normalizedPhone = "";
    }

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

    // Normalize phone number (preserve country code, remove spaces/signs except +)
    let normalizedPhone = args.phoneNumber.trim();
    const hasPlus = normalizedPhone.startsWith("+");
    let digits = normalizedPhone.replace(/\D/g, "");
    if (hasPlus || digits.length > 10) {
      normalizedPhone = "+" + digits;
    } else if (digits.length === 10) {
      normalizedPhone = "+91" + digits;
    } else if (digits.length > 0) {
      normalizedPhone = "+91" + digits;
    } else {
      normalizedPhone = "";
    }

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

// Send a template message via WhatsApp
export const sendTemplateMessage = action({
  args: {
    phoneNumber: v.string(),
    templateName: v.string(),
    languageCode: v.optional(v.string()),
    leadId: v.optional(v.id("leads")),
  },
  handler: async (ctx, args) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WA_PHONE_NUMBER_ID;
    const version = process.env.CLOUD_API_VERSION || "v21.0";

    if (!token || !phoneId) {
      throw new Error("WhatsApp credentials not configured. Please set WHATSAPP_ACCESS_TOKEN and WA_PHONE_NUMBER_ID in environment variables.");
    }

    // Normalize phone number (preserve country code, remove spaces/signs except +)
    let normalizedPhone = args.phoneNumber.trim();
    const hasPlus = normalizedPhone.startsWith("+");
    let digits = normalizedPhone.replace(/\D/g, "");
    if (hasPlus || digits.length > 10) {
      normalizedPhone = "+" + digits;
    } else if (digits.length === 10) {
      normalizedPhone = "+91" + digits;
    } else if (digits.length > 0) {
      normalizedPhone = "+91" + digits;
    } else {
      normalizedPhone = "";
    }

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
              name: args.templateName,
              language: {
                code: args.languageCode || "en",
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
          message: `[Template: ${args.templateName}]`,
          direction: "outbound",
          messageId: data.messages?.[0]?.id || null,
          status: "sent",
        });
      }

      return { success: true, messageId: data.messages?.[0]?.id, data };
    } catch (error: any) {
      throw new Error(`Failed to send WhatsApp template message: ${error.message}`);
    }
  },
});

// Internal action wrapper for scheduled WhatsApp template messages
export const sendTemplateMessageInternal = internalAction({
  args: {
    phoneNumber: v.string(),
    templateName: v.string(),
    languageCode: v.optional(v.string()),
    leadId: v.optional(v.id("leads")),
  },
  handler: async (ctx, args) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WA_PHONE_NUMBER_ID;
    const version = process.env.CLOUD_API_VERSION || "v21.0";

    if (!token || !phoneId) {
      // Silently fail if credentials not configured
      return { success: false, error: "WhatsApp credentials not configured" };
    }

    // Normalize phone number (preserve country code, remove spaces/signs except +)
    let normalizedPhone = args.phoneNumber.trim();
    const hasPlus = normalizedPhone.startsWith("+");
    let digits = normalizedPhone.replace(/\D/g, "");
    if (hasPlus || digits.length > 10) {
      normalizedPhone = "+" + digits;
    } else if (digits.length === 10) {
      normalizedPhone = "+91" + digits;
    } else {
      normalizedPhone = "+" + digits;
    }

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
              name: args.templateName,
              language: {
                code: args.languageCode || "en",
              },
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: `WhatsApp API error: ${JSON.stringify(data)}` };
      }

      // Log the sent message
      if (args.leadId) {
        await ctx.runMutation((internal as any).whatsappQueries.logMessage, {
          leadId: args.leadId,
          phoneNumber: normalizedPhone,
          message: `[Template: ${args.templateName}]`,
          direction: "outbound",
          messageId: data.messages?.[0]?.id || null,
          status: "sent",
        });
      }

      return { success: true, messageId: data.messages?.[0]?.id, data };
    } catch (error: any) {
      return { success: false, error: `Failed to send WhatsApp template message: ${error.message}` };
    }
  },
});