import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CalendarIcon, TrendingUp, Users, AlertCircle, Flame, Snowflake, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Layout } from "@/components/Layout";

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

  // Checkbox states for Leads section
  const [showAssigned, setShowAssigned] = useState(true);
  const [showRelevant, setShowRelevant] = useState(true);
  const [showNotRelevant, setShowNotRelevant] = useState(true);

  // Checkbox states for Types section
  const [showHot, setShowHot] = useState(true);
  const [showCold, setShowCold] = useState(true);
  const [showMatured, setShowMatured] = useState(true);

  // Checkbox states for Followups section
  const [showFollowupsSet, setShowFollowupsSet] = useState(true);
  const [showTimelyFollowups, setShowTimelyFollowups] = useState(true);
  const [showOverdueFollowups, setShowOverdueFollowups] = useState(true);

  // Checkbox states for Sources section (dynamic)
  const [selectedSources, setSelectedSources] = useState<Record<string, boolean>>({});

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
          fromDate: new Date(fromDate.toISOString().split('T')[0] + 'T00:01:00.000Z').getTime(),
          toDate: new Date(toDate.toISOString().split('T')[0] + 'T23:59:59.999Z').getTime(),
        }
      : "skip"
  );

  // Update report data when query completes
  useEffect(() => {
    if (data) {
      setReportData(data);
      // Initialize source checkboxes
      if (data.allSources) {
        const sourcesState: Record<string, boolean> = {};
        data.allSources.forEach((source: string) => {
          sourcesState[source] = true;
        });
        setSelectedSources(sourcesState);
      }
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
    maxDate.setDate(maxDate.getDate() + 1);

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

    const minDate = new Date('2025-11-11');
    const userCreationDate = currentUser?._creationTime ? new Date(currentUser._creationTime) : minDate;
    const effectiveMinDate = userCreationDate < minDate ? userCreationDate : minDate;

    if (fromDate < effectiveMinDate) {
      toast.error(`From date cannot be before ${format(effectiveMinDate, "PPP")}`);
      return;
    }

    toast.success("Generating report...");
  };

  if (!currentUser) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Reports</h1>
          <p className="text-muted-foreground">
            Generate detailed reports with interactive charts for leads assigned within a specific date range
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
        {reportData && reportData.timeSeriesData && (
          <div className="space-y-6">
            {/* Section 1: Leads (Assigned, Relevant, Not Relevant) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Leads Overview
                </CardTitle>
                <CardDescription>Track assigned, relevant, and not relevant leads over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4 flex-wrap">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="assigned" 
                      checked={showAssigned}
                      onCheckedChange={(checked) => setShowAssigned(!!checked)}
                    />
                    <label htmlFor="assigned" className="text-sm font-medium cursor-pointer">
                      Assigned ({reportData.totals.assigned})
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="relevant" 
                      checked={showRelevant}
                      onCheckedChange={(checked) => setShowRelevant(!!checked)}
                    />
                    <label htmlFor="relevant" className="text-sm font-medium cursor-pointer">
                      Relevant ({reportData.totals.relevant})
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="notRelevant" 
                      checked={showNotRelevant}
                      onCheckedChange={(checked) => setShowNotRelevant(!!checked)}
                    />
                    <label htmlFor="notRelevant" className="text-sm font-medium cursor-pointer">
                      Not Relevant ({reportData.totals.notRelevant})
                    </label>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {showAssigned && <Line type="monotone" dataKey="assigned" stroke="#8884d8" strokeWidth={2} name="Assigned" dot={false} />}
                    {showRelevant && <Line type="monotone" dataKey="relevant" stroke="#22c55e" strokeWidth={2} name="Relevant" dot={false} />}
                    {showNotRelevant && <Line type="monotone" dataKey="notRelevant" stroke="#ef4444" strokeWidth={2} name="Not Relevant" dot={false} />}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Section 2: Types (Hot, Cold, Matured) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Lead Types
                </CardTitle>
                <CardDescription>Monitor lead temperature distribution over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4 flex-wrap">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="hot" 
                      checked={showHot}
                      onCheckedChange={(checked) => setShowHot(!!checked)}
                    />
                    <label htmlFor="hot" className="text-sm font-medium cursor-pointer flex items-center gap-1">
                      <Flame className="h-4 w-4 text-red-500" />
                      Hot ({reportData.totals.hot})
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="cold" 
                      checked={showCold}
                      onCheckedChange={(checked) => setShowCold(!!checked)}
                    />
                    <label htmlFor="cold" className="text-sm font-medium cursor-pointer flex items-center gap-1">
                      <Snowflake className="h-4 w-4 text-blue-500" />
                      Cold ({reportData.totals.cold})
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="matured" 
                      checked={showMatured}
                      onCheckedChange={(checked) => setShowMatured(!!checked)}
                    />
                    <label htmlFor="matured" className="text-sm font-medium cursor-pointer flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Matured ({reportData.totals.matured})
                    </label>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {showHot && <Line type="monotone" dataKey="hot" stroke="#ef4444" strokeWidth={2} name="Hot" dot={false} />}
                    {showCold && <Line type="monotone" dataKey="cold" stroke="#3b82f6" strokeWidth={2} name="Cold" dot={false} />}
                    {showMatured && <Line type="monotone" dataKey="matured" stroke="#22c55e" strokeWidth={2} name="Matured" dot={false} />}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Section 3: Followups */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Followups
                </CardTitle>
                <CardDescription>Track followup activities and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4 flex-wrap">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="followupsSet" 
                      checked={showFollowupsSet}
                      onCheckedChange={(checked) => setShowFollowupsSet(!!checked)}
                    />
                    <label htmlFor="followupsSet" className="text-sm font-medium cursor-pointer">
                      Followups Set ({reportData.totals.followupsSet})
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="timelyFollowups" 
                      checked={showTimelyFollowups}
                      onCheckedChange={(checked) => setShowTimelyFollowups(!!checked)}
                    />
                    <label htmlFor="timelyFollowups" className="text-sm font-medium cursor-pointer">
                      Timely Followups ({reportData.totals.timelyFollowups})
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="overdueFollowups" 
                      checked={showOverdueFollowups}
                      onCheckedChange={(checked) => setShowOverdueFollowups(!!checked)}
                    />
                    <label htmlFor="overdueFollowups" className="text-sm font-medium cursor-pointer">
                      Overdue Followups ({reportData.totals.overdueFollowups})
                    </label>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {showFollowupsSet && <Line type="monotone" dataKey="followupsSet" stroke="#8b5cf6" strokeWidth={2} name="Followups Set" dot={false} />}
                    {showTimelyFollowups && <Line type="monotone" dataKey="timelyFollowups" stroke="#22c55e" strokeWidth={2} name="Timely Followups" dot={false} />}
                    {showOverdueFollowups && <Line type="monotone" dataKey="overdueFollowups" stroke="#ef4444" strokeWidth={2} name="Overdue Followups" dot={false} />}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Section 4: Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Lead Sources
                </CardTitle>
                <CardDescription>Analyze lead distribution by source over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4 flex-wrap">
                  {reportData.allSources && reportData.allSources.map((source: string) => (
                    <div key={source} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`source-${source}`}
                        checked={selectedSources[source] ?? true}
                        onCheckedChange={(checked) => 
                          setSelectedSources(prev => ({ ...prev, [source]: !!checked }))
                        }
                      />
                      <label htmlFor={`source-${source}`} className="text-sm font-medium cursor-pointer capitalize">
                        {source} ({reportData.sourceBreakdown[source] || 0})
                      </label>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {reportData.allSources && reportData.allSources.map((source: string, idx: number) => {
                      const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7c7c", "#8dd1e1", "#d084d0", "#a4de6c"];
                      return selectedSources[source] && (
                        <Line 
                          key={source}
                          type="monotone" 
                          dataKey={`sources.${source}`}
                          stroke={colors[idx % colors.length]}
                          strokeWidth={2}
                          name={source}
                          dot={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
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
    </Layout>
  );
}