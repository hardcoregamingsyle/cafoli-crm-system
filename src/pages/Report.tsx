import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CalendarIcon, TrendingUp, Users, AlertCircle, Flame, Snowflake, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router";

export default function Report() {
  const { currentUser } = useCrmAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  useEffect(() => {
    if (!currentUser) {
      navigate("/");
    }
  }, [currentUser, navigate]);

  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [reportData, setReportData] = useState<any>(null);

  // Validate user ID before making query
  const isValidUserId = currentUser?._id && 
    typeof currentUser._id === 'string' && 
    currentUser._id.length > 10 &&
    !currentUser._id.includes('undefined') &&
    !currentUser._id.includes('null');

  // Only query if we have valid dates and user ID
  const shouldQuery = fromDate && toDate && isValidUserId;

  const data = useQuery(
    (api as any).leads.getReportData,
    shouldQuery
      ? {
          currentUserId: currentUser._id as any,
          fromDate: new Date(fromDate.toISOString().split('T')[0] + 'T00:00:00.000Z').getTime(),
          toDate: new Date(toDate.toISOString().split('T')[0] + 'T23:59:59.999Z').getTime(),
        }
      : "skip"
  );

  // Update report data when query completes
  useEffect(() => {
    if (data) {
      setReportData(data);
    }
  }, [data]);

  const handleGenerateReport = () => {
    if (!fromDate || !toDate) {
      toast.error("Please select both from and to dates");
      return;
    }

    if (!isValidUserId) {
      toast.error("Invalid user session. Please log in again.");
      navigate("/");
      return;
    }

    // Validate date range
    const now = new Date();
    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + 1); // Allow up to 1 day in future

    if (fromDate > maxDate) {
      toast.error("From date cannot be more than 1 day in the future");
      return;
    }

    if (toDate > maxDate) {
      toast.error("To date cannot be more than 1 day in the future");
      return;
    }

    if (fromDate > toDate) {
      toast.error("From date must be before or equal to To date");
      return;
    }

    // Minimum date validation (Nov 11, 2025 or user creation date)
    const minDate = new Date('2025-11-11');
    const userCreationDate = currentUser?._creationTime ? new Date(currentUser._creationTime) : minDate;
    const effectiveMinDate = userCreationDate < minDate ? userCreationDate : minDate;

    if (fromDate < effectiveMinDate) {
      toast.error(`From date cannot be before ${format(effectiveMinDate, "PPP")}`);
      return;
    }

    toast.success("Generating report...");
    // The query will automatically run due to the useEffect watching fromDate/toDate
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Reports</h1>
        <p className="text-muted-foreground">
          Generate reports for leads assigned within a specific date range
        </p>
      </div>

      {/* Date Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Date Range</CardTitle>
          <CardDescription>
            Choose the date range for leads assigned to you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={setFromDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !toDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={setToDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button 
              onClick={handleGenerateReport}
              disabled={!fromDate || !toDate || !isValidUserId}
              className="sm:w-auto w-full"
            >
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {reportData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.totalAssigned}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue Follow-ups</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{reportData.overdueFollowups}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Relevant Leads</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{reportData.relevantLeads}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Not Relevant</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.irrelevantLeads}</div>
              </CardContent>
            </Card>
          </div>

          {/* Heat Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Heat Distribution</CardTitle>
              <CardDescription>Breakdown of leads by temperature</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <Flame className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Hot Leads</p>
                    <p className="text-2xl font-bold">{reportData.hotLeads}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <Snowflake className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cold Leads</p>
                    <p className="text-2xl font-bold">{reportData.coldLeads}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Matured Leads</p>
                    <p className="text-2xl font-bold">{reportData.maturedLeads}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Source Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Source Breakdown</CardTitle>
              <CardDescription>Distribution of leads by source</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(reportData.sourceBreakdown).map(([source, count]: [string, any]) => (
                  <div key={source} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium capitalize">{source}</span>
                    <span className="text-2xl font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!reportData && fromDate && toDate && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Click "Generate Report" to view your report data
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}