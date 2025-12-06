import { Layout } from "@/components/Layout";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useLocation, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ROLES } from "@/convex/schema";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { 
  XCircle, 
  CheckCircle, 
  HelpCircle, 
  AlertTriangle, 
  Flame, 
  Snowflake, 
  TrendingUp,
  CalendarX,
  AlertCircle
} from "lucide-react";

export default function AllLeadsAdminView() {
  const { currentUser } = useCrmAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");

  // Redirect non-admins
  if (currentUser && currentUser.role !== ROLES.ADMIN) {
    navigate("/all_leads");
    return null;
  }

  if (!currentUser) {
    return <Layout><div /></Layout>;
  }

  const subPages = [
    { path: "/all-leads-adv/irrelevant", label: "Irrelevant", icon: XCircle, color: "text-red-600", query: "irrelevant" },
    { path: "/all-leads-adv/relevant", label: "Relevant", icon: CheckCircle, color: "text-green-600", query: "relevant" },
    { path: "/all-leads-adv/yetodecide", label: "Yet to Decide", icon: HelpCircle, color: "text-yellow-600", query: "yetToDecide" },
    { path: "/all-leads-adv/overdue", label: "Overdue", icon: AlertTriangle, color: "text-orange-600", query: "overdue" },
    { path: "/all-leads-adv/hot", label: "Hot", icon: Flame, color: "text-red-500", query: "hot" },
    { path: "/all-leads-adv/cold", label: "Cold", icon: Snowflake, color: "text-blue-400", query: "cold" },
    { path: "/all-leads-adv/mature", label: "Mature", icon: TrendingUp, color: "text-purple-600", query: "mature" },
    { path: "/all-leads-adv/nofollowset", label: "No Follow-up Set", icon: CalendarX, color: "text-gray-600", query: "noFollowup" },
  ];

  const currentPath = location.pathname;
  const isMainPage = currentPath === "/all-leads-adv";
  
  // Determine which query to run based on current path
  const currentSubPage = subPages.find(page => page.path === currentPath);
  
  // Fetch leads based on current subpage
  const irrelevantLeads = useQuery(
    (api as any).leadsAdminView.getIrrelevantLeads,
    currentSubPage?.query === "irrelevant" ? { currentUserId: currentUser._id } : "skip"
  );
  
  const relevantLeads = useQuery(
    (api as any).leadsAdminView.getRelevantLeads,
    currentSubPage?.query === "relevant" ? { currentUserId: currentUser._id } : "skip"
  );
  
  const yetToDecideLeads = useQuery(
    (api as any).leadsAdminView.getYetToDecideLeads,
    currentSubPage?.query === "yetToDecide" ? { currentUserId: currentUser._id } : "skip"
  );
  
  const overdueLeads = useQuery(
    (api as any).leadsAdminView.getOverdueLeads,
    currentSubPage?.query === "overdue" ? { currentUserId: currentUser._id } : "skip"
  );
  
  const hotLeads = useQuery(
    (api as any).leadsAdminView.getHotLeads,
    currentSubPage?.query === "hot" ? { currentUserId: currentUser._id } : "skip"
  );
  
  const coldLeads = useQuery(
    (api as any).leadsAdminView.getColdLeads,
    currentSubPage?.query === "cold" ? { currentUserId: currentUser._id } : "skip"
  );
  
  const matureLeads = useQuery(
    (api as any).leadsAdminView.getMatureLeads,
    currentSubPage?.query === "mature" ? { currentUserId: currentUser._id } : "skip"
  );
  
  const noFollowupLeads = useQuery(
    (api as any).leadsAdminView.getNoFollowupLeads,
    currentSubPage?.query === "noFollowup" ? { currentUserId: currentUser._id } : "skip"
  );

  // Get the appropriate leads array
  const getLeadsForCurrentPage = () => {
    if (!currentSubPage) return [];
    
    switch (currentSubPage.query) {
      case "irrelevant": return irrelevantLeads || [];
      case "relevant": return relevantLeads || [];
      case "yetToDecide": return yetToDecideLeads || [];
      case "overdue": return overdueLeads || [];
      case "hot": return hotLeads || [];
      case "cold": return coldLeads || [];
      case "mature": return matureLeads || [];
      case "noFollowup": return noFollowupLeads || [];
      default: return [];
    }
  };

  const rawLeads = getLeadsForCurrentPage();

  // Add search filtering
  const displayedLeads = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return rawLeads;

    return rawLeads.filter((lead: any) => {
      const fields = [
        lead?.name,
        lead?.subject,
        lead?.message,
        lead?.mobileNo,
        lead?.email,
        lead?.state,
        lead?.district,
        lead?.source,
        lead?.assignedUserName,
      ];
      return fields.some((f: any) => String(f || "").toLowerCase().includes(q));
    });
  }, [rawLeads, search]);

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

        {/* Search Bar - Added */}
        {!isMainPage && (
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

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
          <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentSubPage && <currentSubPage.icon className={`w-5 h-5 ${currentSubPage.color}`} />}
                {currentSubPage?.label} Leads
                <Badge variant="secondary" className="ml-2">
                  {displayedLeads.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {displayedLeads.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {search ? `No leads found matching "${search}"` : `No ${currentSubPage?.label.toLowerCase()} leads found`}
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {displayedLeads.map((lead: any) => (
                    <AccordionItem key={String(lead._id)} value={String(lead._id)}>
                      <AccordionTrigger className="text-left">
                        <div className="flex flex-col w-full gap-2">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium">{lead.name || "-"}</div>
                              {lead.requiresAdminAssignment && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Admin Assignment Required
                                </Badge>
                              )}
                              {lead.wasPreviouslyIrrelevant && (
                                <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
                                  Previously Irrelevant
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs sm:text-sm">
                              <span className="text-gray-500">
                                Source: <span className="text-gray-800">{lead.source || "-"}</span>
                              </span>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-500">
                                Assigned To: <span className="text-gray-800">{lead.assignedUserName || "Unassigned"}</span>
                              </span>
                            </div>
                          </div>
                          {currentSubPage?.query === "irrelevant" && lead.markedByUserName && (
                            <div className="text-xs text-red-600">
                              Marked as irrelevant by: {lead.markedByUserName}
                              {lead.markedIrrelevantAt && ` on ${new Date(lead.markedIrrelevantAt).toLocaleString()}`}
                            </div>
                          )}
                          <div className="text-xs text-gray-600">
                            Subject: <span className="text-gray-800">{lead.subject || "-"}</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-3">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-gray-500">Mobile No.</div>
                              <div className="text-sm">{lead.mobileNo || "-"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Email</div>
                              <div className="text-sm break-all">{lead.email || "-"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">State</div>
                              <div className="text-sm">{lead.state || "-"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">District</div>
                              <div className="text-sm">{lead.district || "-"}</div>
                            </div>
                          </div>
                          {lead.message && (
                            <div>
                              <div className="text-xs text-gray-500">Message</div>
                              <div className="text-sm break-words">{lead.message}</div>
                            </div>
                          )}
                          {lead.nextFollowup && (
                            <div>
                              <div className="text-xs text-gray-500">Next Follow-up</div>
                              <div className="text-sm">
                                {new Date(lead.nextFollowup).toLocaleString()}
                                {lead.nextFollowup < Date.now() && (
                                  <Badge variant="destructive" className="ml-2">Overdue</Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}