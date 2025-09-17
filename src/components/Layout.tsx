import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, LogOut, FileText, Settings, Upload, UserPlus, Download } from "lucide-react";
import { motion } from "framer-motion";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate, useLocation } from "react-router";
import { ROLES } from "@/convex/schema";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { currentUser, logout, initializeAuth } = useCrmAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useQuery(api.notifications.getUnreadCount);

  // Add data and mutations early so hooks order is stable even when currentUser is null
  const allLeadsForExport = useQuery(api.leads.getAllLeads, { filter: "all" }) ?? [];
  const assignableUsers = useQuery(api.users.getAssignableUsers) ?? [];
  const bulkCreateLeads = useMutation(api.leads.bulkCreateLeads);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importAssignInputRef = useRef<HTMLInputElement | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");

  useEffect(() => {
    initializeAuth();
  }, []); // run once to avoid re-run loops

  // CSV parser (simple): expects first row headers
  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1);

    const items = rows.map((line) => {
      // naive CSV split; assumes no quoted commas (sufficient for this use)
      const cols = line.split(",").map((c) => c.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = cols[i] ?? "";
      });
      return obj;
    });
    return items;
  };

  // Build lead objects from parsed CSV row objects
  const mapRowsToLeads = (rows: Array<Record<string, string>>) => {
    const mapped = rows.map((r) => {
      return {
        name: r.name ?? "",
        subject: r.subject ?? "",
        message: r.message ?? "",
        mobileNo: r.mobileno ?? r.mobile ?? r.phone ?? "",
        email: r.email ?? "",
        altMobileNo: r.altmobileno ?? r.altmobile ?? r["alternate mobile"] ?? undefined,
        altEmail: r.altemail ?? r["alternate email"] ?? undefined,
        state: r.state ?? "",
        source: r.source ?? "manual",
      };
    });
    // basic required fields check
    return mapped.filter((m) => m.name && m.subject && m.message && m.mobileNo && m.email && m.state);
  };

  const handleImportFile = async (file: File, assignedTo?: string) => {
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const leads = mapRowsToLeads(rows);
      if (leads.length === 0) {
        toast.error("No valid rows found. Ensure headers and required fields are present.");
        return;
      }
      await bulkCreateLeads({
        leads,
        assignedTo: assignedTo ? (assignedTo as any) : undefined,
      });
      toast.success(`Imported ${leads.length} lead(s)${assignedTo ? " and assigned" : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to import");
    }
  };

  // .xlsx export using dynamic import of xlsx (keeps bundle lean if unused)
  const handleExport = async () => {
    try {
      const headers = [
        "name",
        "subject",
        "message",
        "mobileNo",
        "email",
        "altMobileNo",
        "altEmail",
        "state",
        "status",
        "assignedTo",
        "nextFollowup",
        "source",
      ];

      const data = allLeadsForExport ?? [];

      const escapeCsv = (val: any) => {
        const str = String(val ?? "");
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      };

      const rows: string[] = [];
      rows.push(headers.join(","));

      if (data.length > 0) {
        for (const l of data) {
          const row = [
            escapeCsv(l.name ?? ""),
            escapeCsv(l.subject ?? ""),
            escapeCsv(l.message ?? ""),
            escapeCsv(l.mobileNo ?? ""),
            escapeCsv(l.email ?? ""),
            escapeCsv(l.altMobileNo ?? ""),
            escapeCsv(l.altEmail ?? ""),
            escapeCsv(l.state ?? ""),
            escapeCsv(l.status ?? ""),
            escapeCsv(l.assignedTo ?? ""),
            escapeCsv(l.nextFollowup ? new Date(l.nextFollowup).toISOString() : ""),
            escapeCsv(l.source ?? ""),
          ];
          rows.push(row.join(","));
        }
      }
      // If there are no rows beyond headers, it still downloads just the headers as requested
      const csvContent = rows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cafoli_leads.csv";
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Export complete");
    } catch (e: any) {
      toast.error(e.message || "Failed to export");
    }
  };

  if (!currentUser) {
    return <>{children}</>;
  }

  const isAdminOrManager = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER;

  const navigationItems = [
    { 
      label: "All Leads", 
      path: "/all_leads", 
      icon: FileText,
      roles: [ROLES.ADMIN, ROLES.MANAGER] 
    },
    { 
      label: "My Leads", 
      path: "/leads", 
      icon: FileText,
      roles: [ROLES.MANAGER, ROLES.STAFF] 
    },
    { 
      label: "Admin Panel", 
      path: "/admin", 
      icon: Settings,
      roles: [ROLES.ADMIN] 
    },
  ];

  const filteredNavItems = navigationItems.filter(item => 
    item.roles.includes(currentUser.role)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <motion.div 
              className="flex items-center space-x-3 cursor-pointer"
              onClick={() => navigate("/all_leads")}
              whileHover={{ scale: 1.05 }}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Cafoli CRM
              </span>
            </motion.div>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? "default" : "ghost"}
                    className={`flex items-center space-x-2 ${
                      isActive 
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white" 
                        : "text-gray-600 hover:text-blue-600"
                    }`}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </nav>

            {/* User Actions */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Import/Export (Admin/Manager) */}
              {isAdminOrManager && (
                <div className="hidden sm:flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export All Leads
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => importInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    Import Leads
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setAssignDialogOpen(true)}
                  >
                    <UserPlus className="w-4 h-4" />
                    Import And Assign
                  </Button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleImportFile(file);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <input
                    ref={importAssignInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && selectedAssignee) {
                        await handleImportFile(file, selectedAssignee);
                        e.currentTarget.value = "";
                        setAssignDialogOpen(false);
                        setSelectedAssignee("");
                      } else if (!selectedAssignee) {
                        toast.error("Select an assignee first");
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
              )}

              {/* Notifications */}
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate("/notifications")}
              >
                <Bell className="w-5 h-5" />
                {unreadCount && unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>

              {/* User Info */}
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{currentUser.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="text-gray-500 hover:text-red-600"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Assign Dialog */}
      {isAdminOrManager && (
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import and Assign</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Select a user to assign all imported leads to, then choose a CSV file.
              </p>
              <Select
                value={selectedAssignee}
                onValueChange={(v) => setSelectedAssignee(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {(assignableUsers ?? []).map((u: any) => (
                    <SelectItem key={String(u._id)} value={String(u._id)}>
                      {u.name || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!selectedAssignee) {
                    toast.error("Select an assignee");
                    return;
                  }
                  importAssignInputRef.current?.click();
                }}
              >
                Choose CSV & Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}