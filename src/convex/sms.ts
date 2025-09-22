"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

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

    // Ensure the phone number is digits only
    const phoneRaw = String(args.to ?? "").trim();
    const phone = phoneRaw.replace(/[^\d]/g, "");
    if (!phone) {
      throw new Error("Invalid phone number.");
    }

    // Build NimbusIT URL exactly as required (use https, inject phone, keep message from args)
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

    const res = await fetch(url);
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`SMS API error: HTTP ${res.status} ${res.statusText} - ${text}`);
    }
    return { ok: true, response: text };
  },
});