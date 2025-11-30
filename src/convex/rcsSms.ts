"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// RCS API Configuration
const RCS_API_KEY = "3b96bc50-3174-4b8f-9b31-6fce90f20fd8";
const RCS_BASE_URL = "https://api.rcs.com/v1"; // Update with actual base URL from your documentation

function normalizeIndianPhone(input: string): string {
  const digits = input.replace(/[^\d]/g, "");
  
  if (digits.length === 13 && digits.startsWith("091")) {
    return digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    const ten = digits.slice(1);
    return `91${ten}`;
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  
  return digits;
}

// Send RCS text message
export const sendTextMessage = action({
  args: {
    to: v.string(),
    message: v.string(),
  },
  handler: async (_ctx, args) => {
    const phoneRaw = String(args.to ?? "").trim();
    const phone = normalizeIndianPhone(phoneRaw);
    
    if (!(phone && phone.length === 12 && phone.startsWith("91"))) {
      throw new Error(
        "Invalid phone number. Provide a valid Indian number (10 digits or starting with +91)."
      );
    }

    const payload = {
      to: `+${phone}`,
      message: args.message,
      type: "text",
    };

    try {
      const res = await fetch(`${RCS_BASE_URL}/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RCS_API_KEY}`,
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text().catch(() => "");
      
      if (!res.ok) {
        console.error(`❌ RCS API error: HTTP ${res.status} ${res.statusText} - ${responseText}`);
        throw new Error(`RCS API error: HTTP ${res.status} ${res.statusText}`);
      }
      
      console.log(`✅ RCS message sent successfully to +${phone}`);
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { response: responseText };
      }
      
      return { 
        ok: true, 
        response: responseData, 
        provider: "rcs", 
        to: `+${phone}`,
        messageId: responseData?.messageId || responseData?.id || null
      };
    } catch (err: any) {
      console.error(`❌ RCS send failed: ${err?.message || "Unknown error"}`);
      throw new Error(err?.message || "Failed to send RCS message");
    }
  },
});

// Send RCS rich message with media
export const sendRichMessage = action({
  args: {
    to: v.string(),
    message: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"), v.literal("document"))),
  },
  handler: async (_ctx, args) => {
    const phoneRaw = String(args.to ?? "").trim();
    const phone = normalizeIndianPhone(phoneRaw);
    
    if (!(phone && phone.length === 12 && phone.startsWith("91"))) {
      throw new Error(
        "Invalid phone number. Provide a valid Indian number (10 digits or starting with +91)."
      );
    }

    const payload: any = {
      to: `+${phone}`,
      message: args.message,
      type: "rich",
    };

    if (args.mediaUrl && args.mediaType) {
      payload.media = {
        url: args.mediaUrl,
        type: args.mediaType,
      };
    }

    try {
      const res = await fetch(`${RCS_BASE_URL}/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RCS_API_KEY}`,
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text().catch(() => "");
      
      if (!res.ok) {
        console.error(`❌ RCS API error: HTTP ${res.status} ${res.statusText} - ${responseText}`);
        throw new Error(`RCS API error: HTTP ${res.status} ${res.statusText}`);
      }
      
      console.log(`✅ RCS rich message sent successfully to +${phone}`);
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { response: responseText };
      }
      
      return { 
        ok: true, 
        response: responseData, 
        provider: "rcs", 
        to: `+${phone}`,
        messageId: responseData?.messageId || responseData?.id || null
      };
    } catch (err: any) {
      console.error(`❌ RCS send failed: ${err?.message || "Unknown error"}`);
      throw new Error(err?.message || "Failed to send RCS rich message");
    }
  },
});
