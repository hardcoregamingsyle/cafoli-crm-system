"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const sendRelevant = internalAction({
  args: {
    to: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey =
      process.env.RESEND_API_KEY ||
      process.env.RESEND_API_TOKEN ||
      process.env.RESEND_KEY;
    if (!apiKey) {
      throw new Error("Resend API key not configured in Convex (RESEND_API_KEY).");
    }

    const subject = "Welcome to Cafoli Lifecare. Your Success Journey Begins Now.";
    const text =
      "Thank you for Joining with Cafoli Lifecare Pvt. Ltd. We hope that we Achive Great Success Together. Please Check out our Social Media and Website to Know more.\n" +
      "Facebook: https://www.facebook.com/cafolilife\n" +
      "Twitter(X): https://x.com/cafoli0215979\n" +
      "Instagram: https://www.instagram.com/cafolilifecare/\n" +
      "#LinkedIn: https://www.linkedin.com/in/cafolilifecarepvtltd?original_referer=https%3A%2F%2Fcafoli.in%2F\n" +
      "Whatsapp: https://api.whatsapp.com/send?phone=+919518447302&text=I%20am%20interested%20in%20Cafoli%20Products.%20Could%20you%20please%20provide%20me%20with%20more%20information\n" +
      "Website: https://Cafoli.in\n" +
      "Email: info@cafoli.in\n" +
      "Phone No: +91 9518447302";

    const payload = {
      from: "intro@mail.skinticals.com",
      to: [args.to],
      subject,
      text,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Resend API error: HTTP ${res.status} ${res.statusText} - ${errText}`);
    }

    // Best-effort parse
    try {
      return await res.json();
    } catch {
      return { ok: true };
    }
  },
});