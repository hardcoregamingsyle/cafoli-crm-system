"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// RCS API Configuration
const RCS_API_KEY = "3b96bc50-3174-4b8f-9b31-6fce90f20fd8";
const RCS_BASE_URL = "https://rcsapi.pinnacle.in/api"; // Updated from documentation

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
    botId: v.optional(v.string()),
    templateId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const phoneRaw = String(args.to ?? "").trim();
    const phone = normalizeIndianPhone(phoneRaw);
    
    if (!(phone && phone.length === 12 && phone.startsWith("91"))) {
      throw new Error(
        "Invalid phone number. Provide a valid Indian number (10 digits or starting with +91)."
      );
    }

    // RCS API requires botId - if not provided, this will fail
    if (!args.botId) {
      console.error("❌ RCS botId is required but not provided");
      throw new Error("RCS botId is required for sending messages");
    }

    const payload: any = {
      category: "promotional",
      messages: [
        {
          to: `+${phone}`,
          templateId: args.templateId || "",
          variables: [],
        }
      ]
    };

    try {
      const res = await fetch(`${RCS_BASE_URL}/v1/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": RCS_API_KEY,
          "botid": args.botId,
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
        messageId: responseData?.data?.[0]?.uniqueId || null
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
    botId: v.string(),
    templateId: v.string(),
    variables: v.optional(v.array(v.object({
      key: v.string(),
      value: v.string(),
    }))),
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
      category: "promotional",
      messages: [
        {
          to: `+${phone}`,
          templateId: args.templateId,
          variables: args.variables || [],
        }
      ]
    };

    try {
      const res = await fetch(`${RCS_BASE_URL}/v1/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": RCS_API_KEY,
          "botid": args.botId,
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
        messageId: responseData?.data?.[0]?.uniqueId || null
      };
    } catch (err: any) {
      console.error(`❌ RCS send failed: ${err?.message || "Unknown error"}`);
      throw new Error(err?.message || "Failed to send RCS rich message");
    }
  },
});