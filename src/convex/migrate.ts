"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

// Export data from a deployment
export const exportData = internalAction({
  args: {
    deployment: v.string(),
    includeFileStorage: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    try {
      const timestamp = Date.now();
      const filename = `export-${args.deployment}-${timestamp}.zip`;
      const filepath = path.join("/tmp", filename);

      // Build the export command
      let command = `npx convex export --path ${filepath}`;
      
      if (args.includeFileStorage) {
        command += " --include-file-storage";
      }

      // Set the deployment via environment variable
      const env = {
        ...process.env,
        CONVEX_DEPLOYMENT: `dev:${args.deployment}`,
      };

      // Execute the export command
      const { stdout, stderr } = await execAsync(command, { env });

      console.log("Export stdout:", stdout);
      if (stderr) console.error("Export stderr:", stderr);

      // Read the exported file
      const fileBuffer = await fs.readFile(filepath);
      
      // Clean up the temporary file
      await fs.unlink(filepath).catch(() => {});

      // Return the file as base64
      return {
        success: true,
        filename,
        data: fileBuffer.toString("base64"),
      };
    } catch (error: any) {
      console.error("Export error:", error);
      throw new Error(`Export failed: ${error.message}`);
    }
  },
});

// Import data to a deployment
export const importData = internalAction({
  args: {
    deployment: v.string(),
    fileData: v.string(), // base64 encoded ZIP file
    filename: v.string(),
    replaceAll: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    try {
      const timestamp = Date.now();
      const filepath = path.join("/tmp", `import-${timestamp}-${args.filename}`);

      // Write the base64 data to a file
      const fileBuffer = Buffer.from(args.fileData, "base64");
      await fs.writeFile(filepath, fileBuffer);

      // Build the import command
      let command = `npx convex import --path ${filepath}`;
      
      if (args.replaceAll) {
        command += " --replace-all";
      }

      // Set the deployment via environment variable
      const env = {
        ...process.env,
        CONVEX_DEPLOYMENT: `dev:${args.deployment}`,
      };

      // Execute the import command
      const { stdout, stderr } = await execAsync(command, { env });

      console.log("Import stdout:", stdout);
      if (stderr) console.error("Import stderr:", stderr);

      // Clean up the temporary file
      await fs.unlink(filepath).catch(() => {});

      return {
        success: true,
        message: "Import completed successfully",
      };
    } catch (error: any) {
      console.error("Import error:", error);
      throw new Error(`Import failed: ${error.message}`);
    }
  },
});
