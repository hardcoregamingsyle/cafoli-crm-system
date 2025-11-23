"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const submitTemplateToMeta = action({
  args: {
    templateId: v.id("whatsappTemplates"),
  },
  handler: async (ctx, args) => {
    const template = await ctx.runQuery(internal.whatsappTemplates.getTemplateInternal, {
      templateId: args.templateId,
    });

    if (!template) {
      throw new Error(`Template not found: ${args.templateId}`);
    }

    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const version = process.env.CLOUD_API_VERSION || "v21.0";

    if (!token || !wabaId) {
      console.error("Missing WhatsApp credentials for template submission");
      await ctx.runMutation(internal.whatsappTemplates.updateTemplateMetaStatus, {
        templateId: args.templateId,
        status: "failed_internal",
        reason: "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID",
      });
      return;
    }

    // Construct Payload
    const payload: any = {
      name: template.name,
      category: template.category,
      components: template.components,
      language: template.language,
    };

    console.log(`[WhatsApp] Submitting template to Meta: ${template.name}`);

    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/${wabaId}/message_templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("[WhatsApp] Template submission failed:", data);
        await ctx.runMutation(internal.whatsappTemplates.updateTemplateMetaStatus, {
          templateId: args.templateId,
          status: "rejected",
          reason: data.error?.message || "Unknown error from Meta",
        });
        return;
      }

      console.log("[WhatsApp] Template submitted successfully:", data);

      // Success
      await ctx.runMutation(internal.whatsappTemplates.updateTemplateMetaStatus, {
        templateId: args.templateId,
        status: data.status || "PENDING",
        wabaTemplateId: data.id,
      });

    } catch (error: any) {
      console.error("[WhatsApp] Template submission exception:", error);
      await ctx.runMutation(internal.whatsappTemplates.updateTemplateMetaStatus, {
        templateId: args.templateId,
        status: "failed_submission",
        reason: error.message,
      });
    }
  },
});