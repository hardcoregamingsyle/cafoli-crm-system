import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Users, FileText, Clock, TrendingUp, Bell, Target } from "lucide-react";
import { ROLES } from "@/convex/schema";

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

export default function DashboardPage() {
  const { currentUser, initializeAuth } = useCrmAuth();
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    initializeAuth();
    const t = setTimeout(() => setAuthReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      navigate("/");
    }
  }, [currentUser, navigate]);

  const myLeads = useQuery(
    api.leads.getMyLeads,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  );

  // Get comments for all my leads to check followup completion
  const allComments = useQuery(
    api.comments.getAllCommentsForUser,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  );

  if (!currentUser) return <Layout><div /></Layout>;

  // Admin Dashboard - Different view
  if (currentUser.role === ROLES.ADMIN) {
    return <AdminDashboard currentUser={currentUser} authReady={authReady} />;
  }

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
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-gray-600 mt-2">Key metrics at a glance</p>
          <Badge variant="secondary" className="mt-2 capitalize">{currentUser.role}</Badge>
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

// New Admin Dashboard Component
function AdminDashboard({ currentUser, authReady }: { currentUser: any; authReady: boolean }) {
  const navigate = useNavigate();
  
  // Only fetch if user is confirmed admin and auth is ready
  const isAdmin = currentUser?.role === ROLES.ADMIN;
  const shouldFetch = isAdmin && authReady && currentUser?._id;
  
  const allLeads = useQuery(
    api.leads.getAllLeads,
    shouldFetch ? { currentUserId: currentUser._id, filter: "all" } : "skip"
  );

  const unattendedLeads = useQuery(
    api.leads.getUnattendedLeads,
    shouldFetch ? { currentUserId: currentUser._id } : "skip"
  );

  const hotLeads = useQuery(
    api.leads.getLeadsByHeat,
    shouldFetch ? { currentUserId: currentUser._id, heat: "hot" } : "skip"
  );

  const coldLeads = useQuery(
    api.leads.getLeadsByHeat,
    shouldFetch ? { currentUserId: currentUser._id, heat: "cold" } : "skip"
  );

  const matureLeads = useQuery(
    api.leads.getLeadsByHeat,
    shouldFetch ? { currentUserId: currentUser._id, heat: "matured" } : "skip"
  );

  const metrics = [
    {
      title: "Unattended Leads",
      value: unattendedLeads?.length ?? 0,
      description: "Leads older than 48h with no activity",
      route: "/dashboard/unattended",
      color: "text-red-600",
    },
    {
      title: "Hot Leads",
      value: hotLeads?.length ?? 0,
      description: "High priority leads",
      route: "/dashboard/hot",
      color: "text-orange-600",
    },
    {
      title: "Cold Leads",
      value: coldLeads?.length ?? 0,
      description: "Low priority leads",
      route: "/dashboard/cold",
      color: "text-blue-600",
    },
    {
      title: "Mature Leads",
      value: matureLeads?.length ?? 0,
      description: "Matured leads",
      route: "/dashboard/mature",
      color: "text-green-600",
    },
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <Card
              key={metric.route}
              className="cursor-pointer hover:shadow-lg transition-shadow bg-white/80 backdrop-blur-sm border-blue-100"
              onClick={() => navigate(metric.route)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${metric.color}`}>{metric.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
          <CardHeader>
            <CardTitle>Total Leads Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{allLeads?.length ?? 0}</div>
            <p className="text-sm text-muted-foreground">Total leads in system</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}