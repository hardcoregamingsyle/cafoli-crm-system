"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

function normalizeIndianPhone(input: string) {
  const digits = input.replace(/[^\d]/g, "");
  // 13 with leading 0 + 91 (091xxxxxxxxxx) -> trim the 0
  if (digits.length === 13 && digits.startsWith("091")) {
    return digits.slice(1);
  }
  // 12 with 91 prefix -> ok
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  // 11 with leading 0 (0XXXXXXXXXX) -> drop 0, then add 91
  if (digits.length === 11 && digits.startsWith("0")) {
    const ten = digits.slice(1);
    return `91${ten}`;
  }
  // 10-digit local -> add 91
  if (digits.length === 10) {
    return `91${digits}`;
  }
  // Already other format (e.g., 14, 15), return as-is to fail validation below
  return digits;
}

// RCS SMS sending action
export const sendRCS = action({
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

    // RCS API configuration
    const RCS_API_KEY = "3b96bc50-3174-4b8f-9b31-6fce90f20fd8";
    const RCS_BASE_URL = "https://api.rcs.com/v1"; // Update with actual base URL from documentation
    
    const payload = {
      to: `+${phone}`,
      message: args.message,
      type: "text"
    };

    try {
      const res = await fetch(`${RCS_BASE_URL}/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RCS_API_KEY}`,
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text().catch(() => "");
      
      if (!res.ok) {
        console.error(`RCS API error: HTTP ${res.status} ${res.statusText} - ${responseText}`);
        throw new Error(`RCS API error: HTTP ${res.status} ${res.statusText} - ${responseText}`);
      }
      
      console.log(`✅ RCS message sent successfully to ${phone}`);
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { response: responseText };
      }
      
      return { ok: true, response: responseData, provider: "rcs", to: phone };
    } catch (err: any) {
      console.error(`❌ RCS send failed: ${err?.message || "Unknown error"}`);
      throw new Error(err?.message || "Failed to send RCS message");
    }
  },
});

// Legacy NimbusIT SMS sending action (kept for backward compatibility)
export const send = action({
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

    // Hardcoded message and credentials as provided
    const hardcodedMessage =
      "\"Tetra Pack ORS Inhalers, Derma, Gynae, Pedia. 1500+ Product's Pharma Franchise Mfg by Akums, Synokem, Windlas https://cafoli.in Contact 9518447302\"";

    const url =
      `https://nimbusit.biz/api/SmsApi/SendSingleApi` +
      `?UserID=cafolibiz` +
      `&Password=${encodeURIComponent("rlon7188RL")}` +
      `&SenderID=CAFOLI` +
      `&Phno=${encodeURIComponent(phone)}` +
      `&msg=${encodeURIComponent(hardcodedMessage)}` +
      `&EntityID=1701173399090235346` +
      `&TemplateID=1707173409390107342`;

    try {
      const res = await fetch(url);
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        throw new Error(`SMS API error: HTTP ${res.status} ${res.statusText} - ${text}`);
      }
      
      return { ok: true, response: text, provider: "nimbusit", to: phone };
    } catch (err: any) {
      throw new Error(err?.message || "Failed to call SMS provider");
    }
  },
});