import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useState } from "react";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { BarChart3, TrendingUp, AlertCircle, CheckCircle, XCircle, Flame, Snowflake, Award } from "lucide-react";

export default function ReportPage() {
  const { currentUser } = useCrmAuth();
  
  // Set default dates to today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [fromDate, setFromDate] = useState(today.toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(todayEnd.toISOString().split("T")[0]);

  // Convert dates to timestamps
  const fromTimestamp = new Date(fromDate).setHours(0, 0, 0, 0);
  const toTimestamp = new Date(toDate).setHours(23, 59, 59, 999);

  const reportData = useQuery(
    api.leads.getReportData,
    currentUser?._id
      ? {
          currentUserId: currentUser._id,
          fromDate: fromTimestamp,
          toDate: toTimestamp,
        }
      : "skip"
  );

  const handleGenerateReport = () => {
    if (new Date(fromDate) > new Date(toDate)) {
      toast.error("'From' date cannot be after 'To' date");
      return;
    }
    toast.success("Report generated");
  };

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Reports
          </h1>
          <p className="text-gray-600 mt-2">
            View your performance metrics and analytics
          </p>
        </div>

        {/* Date Filter Card */}
        <Card>
          <CardHeader>
            <CardTitle>Date Range</CardTitle>
            <CardDescription>Select the date range for your report</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="fromDate">From</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate">To</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerateReport} className="w-full md:w-auto">
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Grid */}
        {reportData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Assigned */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leads Assigned</CardTitle>
                <BarChart3 className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.totalAssigned}</div>
                <p className="text-xs text-gray-600 mt-1">Total leads assigned to you</p>
              </CardContent>
            </Card>

            {/* Overdue Followups */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue Followups</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{reportData.overdueFollowups}</div>
                <p className="text-xs text-gray-600 mt-1">
                  Out of {reportData.totalAssigned} total leads
                </p>
              </CardContent>
            </Card>

            {/* Hot Leads */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
                <Flame className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{reportData.hotLeads}</div>
                <p className="text-xs text-gray-600 mt-1">Leads marked as hot</p>
              </CardContent>
            </Card>

            {/* Cold Leads */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cold Leads</CardTitle>
                <Snowflake className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">{reportData.coldLeads}</div>
                <p className="text-xs text-gray-600 mt-1">Leads marked as cold</p>
              </CardContent>
            </Card>

            {/* Matured Leads */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Matured Leads</CardTitle>
                <Award className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{reportData.maturedLeads}</div>
                <p className="text-xs text-gray-600 mt-1">Leads marked as matured</p>
              </CardContent>
            </Card>

            {/* Irrelevant Leads */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Irrelevant Leads</CardTitle>
                <XCircle className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">{reportData.irrelevantLeads}</div>
                <p className="text-xs text-gray-600 mt-1">Leads marked as not relevant</p>
              </CardContent>
            </Card>

            {/* Relevant Leads */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Relevant Leads</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{reportData.relevantLeads}</div>
                <p className="text-xs text-gray-600 mt-1">Leads marked as relevant</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Source Breakdown */}
        {reportData && Object.keys(reportData.sourceBreakdown).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Leads by Source</CardTitle>
              <CardDescription>Breakdown of leads from each source</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(reportData.sourceBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <span className="font-medium capitalize">{source}</span>
                      </div>
                      <span className="text-2xl font-bold text-blue-600">{count}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!reportData && currentUser && (
          <Card>
            <CardContent className="py-8 text-center text-gray-600">
              Loading report data...
            </CardContent>
          </Card>
        )}
      </motion.div>
    </Layout>
  );
}