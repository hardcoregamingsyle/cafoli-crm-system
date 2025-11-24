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

export const syncTemplates = action({
  args: {},
  handler: async (ctx) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const version = process.env.CLOUD_API_VERSION || "v21.0";

    if (!token || !wabaId) {
      throw new Error("Missing WhatsApp credentials");
    }

    let allTemplates: any[] = [];
    let nextUrl = `https://graph.facebook.com/${version}/${wabaId}/message_templates?limit=100`;

    console.log("[WhatsApp] Starting template sync from Meta...");

    try {
      while (nextUrl) {
        const response = await fetch(nextUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (!response.ok) {
           console.error("[WhatsApp] Sync failed:", data);
           throw new Error(data.error?.message || "Failed to fetch templates");
        }
        
        if (data.data) {
            allTemplates.push(...data.data);
        }
        nextUrl = data.paging?.next || null;
      }

      console.log(`[WhatsApp] Fetched ${allTemplates.length} templates from Meta. Syncing to DB...`);

      // Map to our schema format
      const mappedTemplates = allTemplates.map((t: any) => ({
          name: t.name,
          language: t.language,
          category: t.category,
          components: t.components,
          status: t.status,
          wabaTemplateId: t.id,
      }));

      await ctx.runMutation(internal.whatsappTemplates.upsertTemplates, {
          templates: mappedTemplates
      });

      return { count: mappedTemplates.length };
    } catch (error: any) {
      console.error("[WhatsApp] Sync exception:", error);
      throw new Error(`Sync failed: ${error.message}`);
    }
  }
});

export const deleteTemplate = action({
  args: {
    templateId: v.id("whatsappTemplates"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const version = process.env.CLOUD_API_VERSION || "v21.0";

    if (!token || !wabaId) {
      throw new Error("Missing WhatsApp credentials");
    }

    console.log(`[WhatsApp] Deleting template from Meta: ${args.name}`);

    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/${wabaId}/message_templates?name=${args.name}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("[WhatsApp] Template deletion from Meta failed:", data);
        // If it fails on Meta, we throw an error. 
        // User can manually delete from DB if needed via a different mechanism if it's out of sync, 
        // but generally we want to ensure it's gone from Meta.
        throw new Error(data.error?.message || "Failed to delete from Meta");
      }

      console.log("[WhatsApp] Template deleted from Meta successfully");

      // Delete from DB
      await ctx.runMutation(internal.whatsappTemplates.deleteTemplateInternal, {
        templateId: args.templateId,
      });

    } catch (error: any) {
      console.error("[WhatsApp] Delete exception:", error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  },
});