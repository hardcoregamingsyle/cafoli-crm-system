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
  const unreadCount = useQuery(api.notifications.getUnreadCount, { currentUserId: currentUser?._id });

  // Add data and mutations early so hooks order is stable even when currentUser is null
  const allLeadsForExport = useQuery(api.leads.getAllLeads, { filter: "all", currentUserId: currentUser?._id }) ?? []
  const assignableUsers = useQuery(api.users.getAssignableUsers, { currentUserId: currentUser?._id }) ?? [];
  const bulkCreateLeads = useMutation(api.leads.bulkCreateLeads);
  const runDeduplication = useMutation(api.leads.runDeduplication);
  const importPincodeMappings = useMutation(api.leads.bulkImportPincodeMappings);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importAssignInputRef = useRef<HTMLInputElement | null>(null);
  const pincodeCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");

  useEffect(() => {
    initializeAuth();
  }, []); // run once to avoid re-run loops

  // CSV parser (simple): expects fixed column order and skips the first row (headers)
  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    // If only headers or empty, nothing to import
    if (lines.length <= 1) return [];
    // Always ignore the first line as headers (row-1)
    const dataLines = lines.slice(1);
    // Naive CSV split; assumes no quoted commas
    const rows: Array<string[]> = dataLines.map((line) =>
      line.split(",").map((c) => c.trim())
    );
    return rows;
  };

  // Add: parse Pincode CSV (expects header row: Pincode,District,State)
  const handleImportPincodeCsv = async (file: File) => {
    try {
      if (file.size === 0) {
        toast.error("The selected CSV file is empty.");
        return;
      }
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        toast("No rows found beyond headers.");
        return;
      }
      const dataLines = lines.slice(1); // skip headers
      const rows = dataLines
        .map((line) => line.split(",").map((c) => c.trim()))
        .filter((cols) => cols.length >= 3);

      const records = rows
        .map((cols) => ({
          pincode: (cols[0] ?? "").toString().trim(),
          district: (cols[1] ?? "").toString().trim(),
          state: (cols[2] ?? "").toString().trim(),
        }))
        .filter((r) => !!r.pincode && (!!r.district || !!r.state));

      if (records.length === 0) {
        toast("No valid pincode mappings found.");
        return;
      }

      // Add auth guard and use currentUser from component scope (avoid calling hooks here)
      if (!currentUser?._id) {
        toast.error("Not authenticated");
        return;
      }

      // Batch the records to stay under Convex's array arg limit (<= 8192)
      const BATCH_SIZE = 2000; // safe chunk size well below 8192
      const total = records.length;
      const totalBatches = Math.ceil(total / BATCH_SIZE);

      toast(`Importing ${total} mappings in ${totalBatches} batch(es)...`);

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        // eslint-disable-next-line no-await-in-loop
        await importPincodeMappings({
          records: batch,
          currentUserId: currentUser._id,
        });
      }

      toast.success(`Imported/updated ${records.length} pincode mapping(s) in ${totalBatches} batch(es)`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to import pincode CSV");
    }
  };

  // Build lead objects from parsed CSV using fixed column order
  // Order: [0] Name, [1] Mobile No, [2] Email, [3] Subject, [4] Message, [5] Alt Mobile, [6] Alt Email, [7] State
  const mapRowsToLeads = (rows: Array<string[]>) => {
    const mapped = rows.map((cols) => {
      const name = (cols[0] ?? "").trim();
      const mobileNo = (cols[1] ?? "").toString().trim();
      const email = (cols[2] ?? "").trim();
      const subject = (cols[3] ?? "").trim();
      const message = (cols[4] ?? "").trim();
      const altMobileNo = (cols[5] ?? "").toString().trim();
      const altEmail = (cols[6] ?? "").trim();
      const state = (cols[7] ?? "").trim();
      const source = "manual";

      return {
        name,
        subject,
        message,
        mobileNo,
        email,
        altMobileNo: altMobileNo || undefined,
        altEmail: altEmail || undefined,
        state,
        source,
      };
    });

    // Relaxed validation: only require mobileNo to be present
    return mapped.filter((m) => !!m.mobileNo);
  };

  const handleImportFile = async (file: File, assignedTo?: string) => {
    try {
      // Early check for empty files
      if (file.size === 0) {
        toast("The selected CSV file is empty.");
        return;
      }

      const text = await file.text();
      const rows = parseCsv(text);
      const leads = mapRowsToLeads(rows);
      const skipped = rows.length - leads.length;
      if (leads.length === 0) {
        toast("No valid rows found. Ensure at least a mobile number is present.");
        return;
      }
      if (skipped > 0) {
        toast(`Skipped ${skipped} row(s) with no mobile number.`);
      }
      await bulkCreateLeads({
        leads,
        assignedTo: assignedTo ? (assignedTo as any) : undefined,
        // pass current user for authorization
        currentUserId: currentUser._id,
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

  const isAdmin = currentUser.role === ROLES.ADMIN;

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
              {/* Import/Export (Admin only) */}
              {isAdmin && (
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
                  {/* New: Run Deduplication */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={async () => {
                      try {
                        if (!currentUser?._id) {
                          toast.error("Not authenticated");
                          return;
                        }
                        const confirmRun = window.confirm("Run deduplication across all leads now?");
                        if (!confirmRun) return;
                        const res = await runDeduplication({ currentUserId: currentUser._id });
                        toast.success(
                          `Dedup done: groups=${res?.groupsProcessed ?? 0}, merged=${res?.mergedCount ?? 0}, deleted=${res?.deletedCount ?? 0}`
                        );
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to run deduplication");
                      }
                    }}
                  >
                    Run Deduplication
                  </Button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={async (e) => {
                      const inputEl = e.currentTarget; // cache before await
                      const file = inputEl.files?.[0];
                      if (!file) return;
                      if (file.size === 0) {
                        toast.error("The selected CSV file is empty.");
                        inputEl.value = "";
                        return;
                      }
                      await handleImportFile(file);
                      inputEl.value = "";
                    }}
                  />
                  <input
                    ref={importAssignInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={async (e) => {
                      const inputEl = e.currentTarget; // cache before await
                      const file = inputEl.files?.[0];
                      if (file && selectedAssignee) {
                        if (file.size === 0) {
                          toast.error("The selected CSV file is empty.");
                          inputEl.value = "";
                          return;
                        }
                        await handleImportFile(file, selectedAssignee);
                        inputEl.value = "";
                        setAssignDialogOpen(false);
                        setSelectedAssignee("");
                      } else if (!selectedAssignee) {
                        toast.error("Select an assignee first");
                        inputEl.value = "";
                      }
                    }}
                  />
                  {/* New: Import Pincode .csv */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => pincodeCsvInputRef.current?.click()}
                  >
                    Import Pincode .csv
                  </Button>
                  <input
                    ref={pincodeCsvInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={async (e) => {
                      const inputEl = e.currentTarget;
                      const file = inputEl.files?.[0];
                      if (!file) return;
                      await handleImportPincodeCsv(file);
                      inputEl.value = "";
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
      {isAdmin && (
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