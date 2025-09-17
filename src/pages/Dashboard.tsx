import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Users, FileText, Clock, TrendingUp, Bell, Target } from "lucide-react";
import { ROLES } from "@/convex/schema";

export default function Dashboard() {
  const { currentUser } = useCrmAuth();

  const isAdmin = currentUser?.role === ROLES.ADMIN;
  const isManager = currentUser?.role === ROLES.MANAGER;
  
  const allLeads = useQuery(api.leads.getAllLeads, { filter: "all", currentUserId: currentUser?._id });
  const myLeads = useQuery(api.leads.getMyLeads, { currentUserId: currentUser?._id });
  const notifications = useQuery(api.notifications.getMyNotifications, { currentUserId: currentUser?._id });
  const upcomingFollowups = useQuery(api.leads.getUpcomingFollowups, { currentUserId: currentUser?._id });

  if (!currentUser) return null;

  const totalLeads = allLeads?.length || 0;
  const assignedLeads = allLeads?.filter((lead: any) => lead.assignedTo)?.length || 0;
  const unassignedLeads = totalLeads - assignedLeads;
  const myLeadsCount = myLeads?.length || 0;
  const unreadNotifications = notifications?.filter((n: any) => !n.read)?.length || 0;
  const upcomingCount = upcomingFollowups?.length || 0;

  const stats = [
    ...(isAdmin || isManager ? [
      {
        title: "Total Leads",
        value: totalLeads,
        icon: FileText,
        color: "from-blue-500 to-blue-600",
        description: "All leads in system"
      },
      {
        title: "Assigned Leads", 
        value: assignedLeads,
        icon: Target,
        color: "from-green-500 to-green-600",
        description: "Leads with assignees"
      },
      {
        title: "Unassigned Leads",
        value: unassignedLeads, 
        icon: Users,
        color: "from-orange-500 to-orange-600",
        description: "Leads awaiting assignment"
      }
    ] : []),
    ...(!isAdmin ? [
      {
        title: "My Leads",
        value: myLeadsCount,
        icon: FileText,
        color: "from-purple-500 to-purple-600", 
        description: "Leads assigned to me"
      }
    ] : []),
    {
      title: "Upcoming Followups",
      value: upcomingCount,
      icon: Clock,
      color: "from-red-500 to-red-600",
      description: "Due in next 5 minutes"
    },
    {
      title: "Notifications",
      value: unreadNotifications,
      icon: Bell,
      color: "from-indigo-500 to-indigo-600", 
      description: "Unread messages"
    }
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Welcome back, {currentUser.name}!
          </h1>
          <p className="text-gray-600 mt-2">
            Here's what's happening with your CRM today
          </p>
          <Badge variant="secondary" className="mt-2 capitalize">
            {currentUser.role}
          </Badge>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm border-blue-100 hover:shadow-lg transition-all duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${stat.color}`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Notifications */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="h-5 w-5 text-blue-600" />
                  <span>Recent Notifications</span>
                </CardTitle>
                <CardDescription>Your latest updates and alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {notifications?.slice(0, 5).map((notification: any) => (
                    <div
                      key={notification._id}
                      className={`p-3 rounded-lg border ${
                        notification.read 
                          ? "bg-gray-50 border-gray-200" 
                          : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notification._creationTime).toLocaleString()}
                      </p>
                    </div>
                  )) || (
                    <p className="text-gray-500 text-center py-4">No notifications yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Upcoming Followups */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-red-600" />
                  <span>Upcoming Followups</span>
                </CardTitle>
                <CardDescription>Leads requiring attention soon</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {upcomingFollowups?.slice(0, 5).map((lead: any) => (
                    <div
                      key={lead._id}
                      className="p-3 rounded-lg border border-red-200 bg-red-50"
                    >
                      <p className="text-sm font-medium">{lead.name}</p>
                      <p className="text-xs text-gray-600 mt-1">{lead.subject}</p>
                      <p className="text-xs text-red-600 mt-1">
                        Due: {lead.nextFollowup ? new Date(lead.nextFollowup).toLocaleString() : "Not set"}
                      </p>
                    </div>
                  )) || (
                    <p className="text-gray-500 text-center py-4">No upcoming followups</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}