import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Download } from "lucide-react";
import { useState } from "react";

export default function DownloadLeads() {
  const leads = useQuery(api.leads.getAllLeadsPublic);
  const [isDownloading, setIsDownloading] = useState(false);

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return "";
    
    // Get headers from first object, excluding system fields if desired
    const headers = Object.keys(data[0]).filter(key => !key.startsWith("_"));
    
    const csvRows = [];
    csvRows.push(headers.join(","));
    
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        const escaped = ("" + (val ?? "")).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    }
    
    return csvRows.join("\n");
  };

  const handleDownload = () => {
    if (!leads) return;
    
    setIsDownloading(true);
    try {
      const csvData = convertToCSV(leads);
      const blob = new Blob([csvData], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("hidden", "");
      a.setAttribute("href", url);
      a.setAttribute("download", `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Download Leads</h1>
          <p className="text-gray-500">
            Export all leads to CSV. No authentication required.
          </p>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          ⚠️ This page is publicly accessible.
        </div>

        <Button 
          size="lg" 
          className="w-full gap-2" 
          onClick={handleDownload}
          disabled={!leads || isDownloading}
        >
          <Download className="w-4 h-4" />
          {leads ? `Download ${leads.length} Leads CSV` : "Loading Leads..."}
        </Button>
      </div>
    </div>
  );
}
