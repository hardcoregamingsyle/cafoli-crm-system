import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Users, FileText, Clock, TrendingUp, Bell, Target } from "lucide-react";
import { ROLES } from "@/convex/schema";

export default function Dashboard() {
  const { currentUser } = useCrmAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  const myLeads = useQuery(
    api.leads.getMyLeads,
    currentUser ? { currentUserId: currentUser._id } : "skip"
  );

  // Get comments for all my leads to check followup completion
  const allComments = useQuery(
    api.comments.getAllCommentsForUser,
    currentUser ? { currentUserId: currentUser._id } : "skip"
  );

  if (!currentUser) return null;

  // Compute requested metrics from my leads
  const myLeadsCount = myLeads?.length || 0;
  const hotLeads = (myLeads ?? []).filter((l: any) => (l.heat || "").toLowerCase() === "hot").length;
  const coldLeads = (myLeads ?? []).filter((l: any) => (l.heat || "").toLowerCase() === "cold").length;
  const maturedLeads = (myLeads ?? []).filter((l: any) => (l.heat || "").toLowerCase() === "matured").length;

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

  const stats = [
    {
      title: "Leads Assigned",
      value: myLeadsCount,
      icon: FileText,
      color: "from-indigo-500 to-indigo-600",
      description: "Assigned to you",
    },
    {
      title: "Hot Leads",
      value: hotLeads,
      icon: TrendingUp,
      color: "from-red-500 to-red-600",
      description: "High-priority",
    },
    {
      title: "Cold Leads",
      value: coldLeads,
      icon: Users,
      color: "from-blue-500 to-blue-600",
      description: "Low-priority",
    },
    {
      title: "Mature Leads",
      value: maturedLeads,
      icon: Target,
      color: "from-green-500 to-green-600",
      description: "Ready to close",
    },
    {
      title: "Closest Followup",
      value: closestFollowupText,
      icon: Clock,
      color: "from-orange-500 to-orange-600",
      description: "Pending followup",
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
                <Card className="bg-white/80 backdrop-blur-sm border-blue-100 hover:shadow-lg transition-all duration-300">
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