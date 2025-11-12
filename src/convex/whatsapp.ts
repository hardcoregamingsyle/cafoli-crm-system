"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

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

    // Normalize phone number (ensure it has country code)
    let normalizedPhone = args.phoneNumber.replace(/[^\d+]/g, "");
    if (!normalizedPhone.startsWith("+")) {
      // Assume Indian number if no country code
      if (normalizedPhone.startsWith("91")) {
        normalizedPhone = "+" + normalizedPhone;
      } else if (normalizedPhone.length === 10) {
        normalizedPhone = "+91" + normalizedPhone;
      } else {
        normalizedPhone = "+" + normalizedPhone;
      }
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

    // Normalize phone number
    let normalizedPhone = args.phoneNumber.replace(/[^\d+]/g, "");
    if (!normalizedPhone.startsWith("+")) {
      if (normalizedPhone.startsWith("91")) {
        normalizedPhone = "+" + normalizedPhone;
      } else if (normalizedPhone.length === 10) {
        normalizedPhone = "+91" + normalizedPhone;
      } else {
        normalizedPhone = "+" + normalizedPhone;
      }
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