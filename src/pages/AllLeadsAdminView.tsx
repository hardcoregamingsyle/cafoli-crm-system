import { Layout } from "@/components/Layout";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROLES } from "@/convex/schema";
import { motion } from "framer-motion";
import { 
  XCircle, 
  CheckCircle, 
  HelpCircle, 
  AlertTriangle, 
  Flame, 
  Snowflake, 
  TrendingUp,
  CalendarX
} from "lucide-react";

export default function AllLeadsAdminView() {
  const { currentUser } = useCrmAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect non-admins
  if (currentUser && currentUser.role !== ROLES.ADMIN) {
    navigate("/all_leads");
    return null;
  }

  const subPages = [
    { path: "/all-leads-adv/irrelevant", label: "Irrelevant", icon: XCircle, color: "text-red-600" },
    { path: "/all-leads-adv/relevant", label: "Relevant", icon: CheckCircle, color: "text-green-600" },
    { path: "/all-leads-adv/yetodecide", label: "Yet to Decide", icon: HelpCircle, color: "text-yellow-600" },
    { path: "/all-leads-adv/overdue", label: "Overdue", icon: AlertTriangle, color: "text-orange-600" },
    { path: "/all-leads-adv/hot", label: "Hot", icon: Flame, color: "text-red-500" },
    { path: "/all-leads-adv/cold", label: "Cold", icon: Snowflake, color: "text-blue-400" },
    { path: "/all-leads-adv/mature", label: "Mature", icon: TrendingUp, color: "text-purple-600" },
    { path: "/all-leads-adv/nofollowset", label: "No Follow-up Set", icon: CalendarX, color: "text-gray-600" },
  ];

  const currentPath = location.pathname;
  const isMainPage = currentPath === "/all-leads-adv";

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              All Leads - Admin View
            </h1>
            <p className="text-gray-600 mt-1">Advanced lead filtering and management</p>
          </div>
        </div>

        {/* Sub-page Navigation */}
        <div className="flex flex-wrap gap-2">
          {subPages.map((page) => {
            const Icon = page.icon;
            const isActive = currentPath === page.path;
            
            return (
              <Button
                key={page.path}
                variant={isActive ? "default" : "outline"}
                className={`gap-2 ${isActive ? "bg-gradient-to-r from-blue-600 to-indigo-600" : ""}`}
                onClick={() => navigate(page.path)}
              >
                <Icon className={`w-4 h-4 ${!isActive ? page.color : ""}`} />
                {page.label}
              </Button>
            );
          })}
        </div>

        {/* Main Content */}
        {isMainPage ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {subPages.map((page) => {
              const Icon = page.icon;
              return (
                <Card
                  key={page.path}
                  className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(page.path)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Icon className={`w-8 h-8 ${page.color}`} />
                    <h3 className="font-semibold text-lg">{page.label}</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    View and manage {page.label.toLowerCase()} leads
                  </p>
                </Card>
              );
            })}
          </motion.div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            Select a filter category above to view leads
          </div>
        )}
      </div>
    </Layout>
  );
}
