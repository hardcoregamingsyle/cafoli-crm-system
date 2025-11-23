"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

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
// convex/whatsapp.ts

// ... (keep your imports and normalizePhoneNumber function exactly as they are) ...

// REPLACE your existing sendTemplateMessageHelper with this one:
async function sendTemplateMessageHelper(
  phoneNumber: string,
  templateName: string,
  languageCode: string,
  components?: any[] // <--- ADD THIS ARGUMENT
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
    
    // Construct Payload
    const payload: any = {
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode || "en_US",
        },
      },
    };

    // Add components (variables) if provided
    if (components && components.length > 0) {
      payload.template.components = components;
    }

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

// ... (Keep sendMessage and sendInteractiveMessage exactly as they are) ...

// UPDATE your sendTemplateMessage action to accept components:
export const sendTemplateMessage = action({
  args: {
    phoneNumber: v.string(),
    templateName: v.string(),
    languageCode: v.optional(v.string()),
    leadId: v.optional(v.id("leads")),
    components: v.optional(v.any()), // <--- ADD THIS ARGUMENT
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
      args.languageCode || "en",
      args.components // <--- PASS IT HERE
    );

    if (!result.success) {
      console.error("[WhatsApp] sendTemplateMessage failed:", result.error);
      console.error("[WhatsApp] Full error details:", JSON.stringify(result.data || {}, null, 2));
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

        // Update lastActivityTime for outbound messages
        await ctx.runMutation(internal.whatsappQueries.updateLeadActivity, {
          leadId: args.leadId,
        });
      } catch (logError) {
        console.error("[WhatsApp] Failed to log message:", logError);
      }
    }

    return result;
  },
});

// ... (Keep sendTemplateMessageInternal exactly as is, or update similarly if you need internal variables)

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

      // Log the sent message and update lastActivityTime
      if (args.leadId) {
        await ctx.runMutation(internal.whatsappQueries.logMessage, {
          leadId: args.leadId,
          phoneNumber: normalizedPhone,
          message: args.message,
          direction: "outbound",
          messageId: data.messages?.[0]?.id || null,
          status: "sent",
        });
        
        // Update lastActivityTime for outbound messages
        await ctx.runMutation(internal.whatsappQueries.updateLeadActivity, {
          leadId: args.leadId,
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

        // Update lastActivityTime for outbound messages
        await ctx.runMutation(internal.whatsappQueries.updateLeadActivity, {
          leadId: args.leadId,
        });
      }

      return { success: true, messageId: data.messages?.[0]?.id, data };
    } catch (error: any) {
      throw new Error(`Failed to send interactive message: ${error.message}`);
    }
  },
});

// Internal action for scheduled WhatsApp template messages (called from webhooks/crons)
export const sendTemplateMessageInternal = internalAction({
  args: {
    phoneNumber: v.string(),
    templateName: v.string(),
    languageCode: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    console.log(`[WhatsApp Internal] sendTemplateMessageInternal called with:`, { 
      phoneNumber: args.phoneNumber, 
      templateName: args.templateName
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

    // Note: Internal action doesn't log to database since we don't have leadId
    // Logging happens in the public action when called from UI

    return result;
  },
});

// Add new action to upload media to WhatsApp
export const uploadMedia = action({
  args: {
    fileUrl: v.string(),
    mimeType: v.string(),
  },
  handler: async (_ctx, args) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WA_PHONE_NUMBER_ID;
    const version = process.env.CLOUD_API_VERSION || "v21.0";

    if (!token || !phoneId) {
      throw new Error("WhatsApp credentials not configured");
    }

    try {
      // Fetch the file from the URL
      const fileResponse = await fetch(args.fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
      }

      const fileBlob = await fileResponse.blob();
      const formData = new FormData();
      formData.append("messaging_product", "whatsapp");
      formData.append("file", fileBlob);
      formData.append("type", args.mimeType);

      const response = await fetch(
        `https://graph.facebook.com/${version}/${phoneId}/media`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`WhatsApp media upload error: ${JSON.stringify(data)}`);
      }

      return { success: true, mediaId: data.id };
    } catch (error: any) {
      throw new Error(`Failed to upload media: ${error.message}`);
    }
  },
});

// Send a reaction to a message
export const sendReaction = action({
  args: {
    phoneNumber: v.string(),
    messageId: v.string(),
    emoji: v.string(),
    leadId: v.optional(v.id("leads")),
  },
  handler: async (ctx, args) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WA_PHONE_NUMBER_ID;
    const version = process.env.CLOUD_API_VERSION || "v21.0";

    if (!token || !phoneId) {
      throw new Error("WhatsApp credentials not configured");
    }

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
            type: "reaction",
            reaction: {
              message_id: args.messageId,
              emoji: args.emoji,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
      }

      // Update the message in the database
      await ctx.runMutation(internal.webhook.handleWhatsAppReaction, {
        messageId: args.messageId,
        reaction: args.emoji,
        phoneNumber: normalizedPhone,
      });

      return { success: true, data };
    } catch (error: any) {
      throw new Error(`Failed to send reaction: ${error.message}`);
    }
  },
});

// Add new action to send media messages
export const sendMediaMessage = action({
  args: {
    phoneNumber: v.string(),
    mediaType: v.string(), // image, video, audio, document, sticker
    mediaId: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    mediaStorageId: v.optional(v.id("_storage")),
    caption: v.optional(v.string()),
    filename: v.optional(v.string()),
    leadId: v.optional(v.id("leads")),
  },
  handler: async (ctx, args) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WA_PHONE_NUMBER_ID;
    const version = process.env.CLOUD_API_VERSION || "v21.0";

    if (!token || !phoneId) {
      throw new Error("WhatsApp credentials not configured");
    }

    const normalizedPhone = normalizePhoneNumber(args.phoneNumber);

    // Resolve media URL if storage ID is provided
    let finalMediaUrl = args.mediaUrl;
    if (args.mediaStorageId) {
      const url = await ctx.runQuery(api.files.getDownloadUrl, { storageId: args.mediaStorageId });
      if (!url) {
        throw new Error("Failed to resolve storage URL");
      }
      finalMediaUrl = url;
    }

    // Build media object based on type
    const mediaObject: any = {};
    
    if (args.mediaId) {
      mediaObject.id = args.mediaId;
    } else if (finalMediaUrl) {
      mediaObject.link = finalMediaUrl;
    } else {
      throw new Error("Either mediaId, mediaUrl, or mediaStorageId must be provided");
    }

    if (args.caption && ["image", "video", "document"].includes(args.mediaType)) {
      mediaObject.caption = args.caption;
    }

    if (args.filename && args.mediaType === "document") {
      mediaObject.filename = args.filename;
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
            type: args.mediaType,
            [args.mediaType]: mediaObject,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
      }

      // Log the sent media message
      if (args.leadId) {
        await ctx.runMutation(internal.whatsappQueries.logMessage, {
          leadId: args.leadId,
          phoneNumber: normalizedPhone,
          message: args.caption || `[${args.mediaType.toUpperCase()}]`,
          direction: "outbound",
          messageId: data.messages?.[0]?.id || null,
          status: "sent",
          mediaType: args.mediaType,
          mediaUrl: finalMediaUrl,
          mediaId: args.mediaId,
        });

        await ctx.runMutation(internal.whatsappQueries.updateLeadActivity, {
          leadId: args.leadId,
        });
      }

      return { success: true, messageId: data.messages?.[0]?.id, data };
    } catch (error: any) {
      throw new Error(`Failed to send media message: ${error.message}`);
    }
  },
});