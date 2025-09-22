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

export const send = action({
  args: {
    to: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.SMS_API_KEY;
    if (!apiKey) {
      throw new Error("SMS API key not configured in Convex (SMS_API_KEY).");
    }

    const phoneRaw = String(args.to ?? "").trim();
    const phone = normalizeIndianPhone(phoneRaw);
    if (!(phone && phone.length === 12 && phone.startsWith("91"))) {
      throw new Error(
        "Invalid phone number. Provide a valid Indian number (10 digits or starting with +91)."
      );
    }

    const encodedMsg = encodeURIComponent(args.message);
    const url =
      `https://nimbusit.biz/api/SmsApi/SendSingleApi` +
      `?UserID=cafolibiz` +
      `&Password=${encodeURIComponent(apiKey)}` +
      `&SenderID=CAFOLI` +
      `&Phno=${encodeURIComponent(phone)}` +
      `&msg=${encodedMsg}` +
      `&EntityID=1701173399090235346` +
      `&TemplateID=1707173408458693911`;

    try {
      const res = await fetch(url);
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        throw new Error(`SMS API error: HTTP ${res.status} ${res.statusText} - ${text}`);
      }
      // NimbusIT often returns text indicating success/failure; return it to the client for visibility.
      return { ok: true, response: text, provider: "nimbusit", to: phone };
    } catch (err: any) {
      // Bubble up actionable error
      throw new Error(err?.message || "Failed to call SMS provider");
    }
  },
});