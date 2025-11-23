"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

// Download media from WhatsApp and return the URL
export const downloadWhatsAppMedia = internalAction({
  args: {
    mediaId: v.string(),
  },
  handler: async (_ctx, args) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const version = process.env.CLOUD_API_VERSION || "v21.0";

    if (!token) {
      throw new Error("WhatsApp credentials not configured");
    }

    try {
      // First, get the media URL
      const mediaResponse = await fetch(
        `https://graph.facebook.com/${version}/${args.mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const mediaData = await mediaResponse.json();

      if (!mediaResponse.ok) {
        throw new Error(`Failed to get media URL: ${JSON.stringify(mediaData)}`);
      }

      const mediaUrl = mediaData.url;

      // Download the actual media file
      const fileResponse = await fetch(mediaUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!fileResponse.ok) {
        throw new Error(`Failed to download media: ${fileResponse.statusText}`);
      }

      // Return the media data
      return {
        success: true,
        url: mediaUrl,
        mimeType: mediaData.mime_type,
        sha256: mediaData.sha256,
        fileSize: mediaData.file_size,
      };
    } catch (error: any) {
      throw new Error(`Failed to download WhatsApp media: ${error.message}`);
    }
  },
});
