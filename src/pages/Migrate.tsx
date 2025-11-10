import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { motion } from "framer-motion";
import { Database, Download, Upload, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Migrate() {
  const { currentUser } = useCrmAuth();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportFile, setExportFile] = useState<File | null>(null);
  const [sourceDeployment, setSourceDeployment] = useState("precious-cricket-778");
  const [targetDeployment, setTargetDeployment] = useState("cautious-guanaco-541");

  // Only admins can access this page
  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only administrators can access the migration tool.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/all_leads")} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportSlug = import.meta.env.VITE_EXPORT_SLUG || sourceDeployment;
      toast.info(`Exporting data from ${exportSlug}...`);
      
      // Use Convex CLI command approach via backend action
      const response = await fetch(`${import.meta.env.VITE_CONVEX_URL}/api/migrate/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          deployment: exportSlug,
          includeFileStorage: true 
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exportSlug}-backup-${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Export completed successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!exportFile) {
      toast.error("Please select a backup file to import");
      return;
    }

    setIsImporting(true);
    try {
      toast.info(`Importing data to ${targetDeployment}...`);

      const formData = new FormData();
      formData.append("file", exportFile);
      formData.append("deployment", targetDeployment);

      const response = await fetch(`${import.meta.env.VITE_CONVEX_URL}/api/migrate/import`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Import failed");
      }

      toast.success("Import completed successfully!");
      setExportFile(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to import data");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/all_leads")}
              className="mb-4"
            >
              ← Back to Dashboard
            </Button>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              Data Migration Tool
            </h1>
            <p className="text-gray-600">
              Export and import data between Convex deployments
            </p>
          </div>

          {/* Export Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Download a backup of your data from a deployment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source Deployment</Label>
                <Select value={sourceDeployment} onValueChange={setSourceDeployment}>
                  <SelectTrigger id="source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="precious-cricket-778">precious-cricket-778</SelectItem>
                    <SelectItem value="cautious-guanaco-541">cautious-guanaco-541</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Migration Arrow */}
          <div className="flex justify-center my-6">
            <div className="bg-white rounded-full p-4 shadow-lg">
              <ArrowRight className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          {/* Import Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Import Data
              </CardTitle>
              <CardDescription>
                Upload a backup file to import into a deployment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target">Target Deployment</Label>
                <Select value={targetDeployment} onValueChange={setTargetDeployment}>
                  <SelectTrigger id="target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cautious-guanaco-541">cautious-guanaco-541</SelectItem>
                    <SelectItem value="precious-cricket-778">precious-cricket-778</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Backup File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".zip"
                  onChange={(e) => setExportFile(e.target.files?.[0] || null)}
                />
                {exportFile && (
                  <p className="text-sm text-gray-600">
                    Selected: {exportFile.name}
                  </p>
                )}
              </div>

              <Button
                onClick={handleImport}
                disabled={isImporting || !exportFile}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="mt-6 bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Database className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm text-gray-700">
                  <p className="font-medium">Migration Notes:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Export creates a ZIP backup of all data and files</li>
                    <li>Import will merge data into the target deployment</li>
                    <li>Existing data in target deployment will be preserved</li>
                    <li>Large datasets may take several minutes to process</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
