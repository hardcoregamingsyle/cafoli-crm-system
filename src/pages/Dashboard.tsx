import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Users, FileText, Clock, TrendingUp, Bell, Target, PlusCircle } from "lucide-react";
import { ROLES } from "@/convex/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ADD: helpers to categorize sources and count breakdowns
function normalizeSource(raw: any): string {
  const s = String(raw ?? "").toLowerCase();
  return s;
}
function isIndiamart(lead: any): boolean {
  const s = normalizeSource(lead?.source);
  return s.includes("indiamart");
}
function isPharmavends(lead: any): boolean {
  const s = normalizeSource(lead?.source);
  return s.includes("pharmavend");
}
function splitCounts(list: Array<any>) {
  const total = list.length;
  const indiamart = list.filter(isIndiamart).length;
  const pharmavends = list.filter(isPharmavends).length;
  const oldData = total - indiamart - pharmavends;
  return { total, indiamart, pharmavends, oldData };
}

export default function Dashboard() {
  const { currentUser } = useCrmAuth();
  const navigate = useNavigate();
  
  // Add: Admin user selector state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  // Add: Fetch all users for admin selector
  const allUsers = useQuery(
    api.users.getAllUsers,
    currentUser?.role === ROLES.ADMIN ? { currentUserId: currentUser._id } : "skip"
  );

  // Determine which user's data to display
  const displayUserId = currentUser?.role === ROLES.ADMIN && selectedUserId 
    ? selectedUserId 
    : currentUser?._id;

  const myLeads = useQuery(
    api.leads.getMyLeads,
    displayUserId ? { currentUserId: displayUserId as any } : "skip"
  );

  // Get comments for all my leads to check followup completion
  const allComments = useQuery(
    api.comments.getAllCommentsForUser,
    displayUserId ? { currentUserId: displayUserId as any } : "skip"
  );

  if (!currentUser) return null;

  // Compute requested metrics from my leads
  const myLeadsCount = myLeads?.length || 0;
  const hotList = (myLeads ?? []).filter((l: any) => (l.heat || "").toLowerCase() === "hot");
  const coldList = (myLeads ?? []).filter((l: any) => (l.heat || "").toLowerCase() === "cold");
  const maturedList = (myLeads ?? []).filter((l: any) => (l.heat || "").toLowerCase() === "matured");
  const hotLeads = hotList.length;
  const coldLeads = coldList.length;
  const maturedLeads = maturedList.length;

  // ADD: compute breakdowns for each card scope
  const allBreak = splitCounts(myLeads ?? []);
  const hotBreak = splitCounts(hotList);
  const coldBreak = splitCounts(coldList);
  const maturedBreak = splitCounts(maturedList);

  let closestFollowupText = "None";
  const now = Date.now();
  
  // Filter leads that have followups (past or future) that haven't been completed
  const pendingFollowups = (myLeads ?? [])
    .filter((lead: any) => {
      if (!lead.nextFollowup) return false;
      
      // Check if there are any comments after the followup time
      const leadComments = (allComments ?? []).filter((comment: any) => 
        comment.leadId === lead._id && comment.timestamp > lead.nextFollowup
      );
      
      // If there are comments after followup time, it's considered completed
      return leadComments.length === 0;
    })
    .sort((a: any, b: any) => a.nextFollowup - b.nextFollowup);

  if (pendingFollowups.length > 0) {
    const next = pendingFollowups[0];
    const followupDate = new Date(next.nextFollowup);
    const isOverdue = next.nextFollowup < now;
    closestFollowupText = `${next.name || "Lead"} • ${followupDate.toLocaleString()}${isOverdue ? " (Overdue)" : ""}`;
  }

  const pendingBreak = splitCounts(pendingFollowups);

  const stats = [
    {
      title: "Leads Assigned",
      value: myLeadsCount,
      icon: FileText,
      color: "from-indigo-500 to-indigo-600",
      description: "Assigned to you",
      route: "/dashboard/assigned",
      breakdown: allBreak,
    },
    {
      title: "Hot Leads",
      value: hotLeads,
      icon: TrendingUp,
      color: "from-red-500 to-red-600",
      description: "High-priority",
      route: "/dashboard/hot",
      breakdown: hotBreak,
    },
    {
      title: "Cold Leads",
      value: coldLeads,
      icon: Users,
      color: "from-blue-500 to-blue-600",
      description: "Low-priority",
      route: "/dashboard/cold",
      breakdown: coldBreak,
    },
    {
      title: "Mature Leads",
      value: maturedLeads,
      icon: Target,
      color: "from-green-500 to-green-600",
      description: "Ready to close",
      route: "/dashboard/mature",
      breakdown: maturedBreak,
    },
    {
      title: "Closest Followup",
      value: closestFollowupText,
      icon: Clock,
      color: "from-orange-500 to-orange-600",
      description: "Pending followup",
      route: "/dashboard/followup",
      breakdown: pendingBreak,
    },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1" />
            <div className="flex-1 text-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Dashboard
              </h1>
            </div>
            <div className="flex-1 flex justify-end">
              <Button
                onClick={() => {
                  // Trigger the add lead dialog from Layout
                  const addLeadBtn = document.querySelector('[aria-label="Add Lead"]') as HTMLButtonElement;
                  if (addLeadBtn) addLeadBtn.click();
                }}
                className="gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Add Lead
              </Button>
            </div>
          </div>
          <p className="text-gray-600 mt-2">Key metrics at a glance</p>
          <Badge variant="secondary" className="mt-2 capitalize">{currentUser.role}</Badge>
          
          {/* Admin User Selector */}
          {currentUser.role === ROLES.ADMIN && allUsers && allUsers.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Select
                value={selectedUserId || "own"}
                onValueChange={(value) => setSelectedUserId(value === "own" ? null : value)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select user to view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">My Dashboard</SelectItem>
                  {allUsers
                    .filter((u: any) => u.role === ROLES.MANAGER || u.role === ROLES.STAFF)
                    .map((u: any) => (
                      <SelectItem key={String(u._id)} value={String(u._id)}>
                        {u.name || u.username} ({u.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 }}
              >
                <Card
                  className="bg-white/80 backdrop-blur-sm border-blue-100 hover:shadow-lg transition-all duration-300 cursor-pointer"
                  onClick={() => navigate(stat.route)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") navigate(stat.route);
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${stat.color}`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-${typeof stat.value === "number" ? "2xl" : "sm"} font-bold text-gray-900`}>
                      {stat.value}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                    <div className="mt-2 text-xs text-gray-600">
                      Total: <span className="font-semibold">{stat.breakdown.total}</span>,{" "}
                      Indiamart: <span className="font-semibold">{stat.breakdown.indiamart}</span>,{" "}
                      Pharmavends: <span className="font-semibold">{stat.breakdown.pharmavends}</span>,{" "}
                      Old Data: <span className="font-semibold">{stat.breakdown.oldData}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}