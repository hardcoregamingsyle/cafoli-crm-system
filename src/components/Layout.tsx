import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, LogOut, FileText, Settings, Upload, UserPlus, Download, PlusCircle, Menu, User, KeyRound, Send } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { currentUser, logout, initializeAuth, originalAdmin, returnToAdmin } = useCrmAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    authReady && currentUser ? { currentUserId: currentUser._id } : "skip"
  );

  // Add data and mutations early so hooks order is stable even when currentUser is null
  const allLeadsForExport = useQuery(
    api.leads.getAllLeads,
    authReady && currentUser ? { filter: "all", currentUserId: currentUser._id } : "skip"
  ) ?? []
  const assignableUsers =
    useQuery(
      api.users.getAssignableUsers,
      authReady && currentUser ? { currentUserId: currentUser._id } : "skip"
    ) ?? [];
  const bulkCreateLeads = useMutation(api.leads.bulkCreateLeads);
  const runDeduplication = useMutation(api.leads.runDeduplication);
  const importPincodeMappings = useMutation(api.leads.bulkImportPincodeMappings);

  // Add: subscribe to my leads to detect assignment increases (for sound)
  const myLeadsForAssignSound =
    useQuery(
      api.leads.getMyLeads,
      authReady && currentUser ? { currentUserId: currentUser._id } : "skip"
    ) ?? [];

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importAssignInputRef = useRef<HTMLInputElement | null>(null);
  const pincodeCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  // Add: mobile nav open state
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: "",
    mobileNo: "",
    email: "",
    subject: "",
    message: "",
    altMobileNo: "",
    altEmail: "",
    state: "",
    source: "",
    station: "",
    district: "",
    pincode: "",
    agencyName: "",
  });

  // Track previous total leads count to detect newly arrived leads
  const [prevLeadsCount, setPrevLeadsCount] = useState<number | null>(null);

  // Add: Track previous assigned-to-me leads count to detect new assignments
  const [prevAssignedCount, setPrevAssignedCount] = useState<number | null>(null);

  // Add: Change password dialog state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const changePasswordMutation = useMutation(api.users.changePassword);

  useEffect(() => {
    initializeAuth();
  }, []); // run once to avoid re-run loops

  // Play sound + toast when new leads arrive (single vs multiple)
  useEffect(() => {
    if (!currentUser) return;

    const canReceive =
      currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER;
    if (!canReceive) return;

    const count = (allLeadsForExport ?? []).length;

    // Initialize baseline without notifying
    if (prevLeadsCount === null) {
      setPrevLeadsCount(count);
      return;
    }

    // If count increased, notify with sound + toast
    if (count > prevLeadsCount) {
      const delta = count - prevLeadsCount;

      // Change: Always play minecraft_bell for any number of new leads
      const soundSrc = "/assets/minecraft_bell.mp3";
      try {
        const audio = new Audio(soundSrc);
        audio.play().catch(() => {
          // Ignore autoplay errors silently
        });
      } catch {
        // Ignore sound errors
      }

      toast.success(`${delta} new lead${delta > 1 ? "s" : ""} have arrived`);
      setPrevLeadsCount(count);
      return;
    }

    // Keep baseline in sync if decreased/changed
    if (count !== prevLeadsCount) {
      setPrevLeadsCount(count);
    }
  }, [currentUser, allLeadsForExport?.length, prevLeadsCount]);

  // New: Play bike sound + toast when a lead is assigned to the current user
  useEffect(() => {
    if (!currentUser) return;

    // Only Managers and Staff receive personal assignment sounds
    const canReceiveAssignment =
      currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.STAFF;
    if (!canReceiveAssignment) return;

    const count = (myLeadsForAssignSound ?? []).length;

    // Initialize baseline without notifying
    if (prevAssignedCount === null) {
      setPrevAssignedCount(count);
      return;
    }

    // If my assigned leads count increased, play assignment sound
    if (count > prevAssignedCount) {
      const delta = count - prevAssignedCount;

      try {
        const audio = new Audio("/assets/bike.mp3");
        audio.play().catch(() => {
          // ignore autoplay errors
        });
      } catch {
        // ignore
      }

      toast.success(
        delta === 1
          ? "A lead has been assigned to you"
          : `${delta} leads have been assigned to you`
      );

      setPrevAssignedCount(count);
      return;
    }

    // Keep baseline in sync if decreased/changed
    if (count !== prevAssignedCount) {
      setPrevAssignedCount(count);
    }
  }, [currentUser, myLeadsForAssignSound?.length, prevAssignedCount]);

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
  // Order: [0] Name, [1] Source, [2] Email, [3] Phone No., [4] Alt Email, [5] Alt Phone No, [6] Subject, [7] Message, [8] State, [9] Station, [10] District, [11] Pincode, [12] Agency Name
  const mapRowsToLeads = (rows: Array<string[]>) => {
    const mapped = rows.map((cols) => {
      const name = (cols[0] ?? "").trim();
      const source = (cols[1] ?? "").trim() || "manual";
      const email = (cols[2] ?? "").trim();
      const mobileNo = (cols[3] ?? "").toString().trim();
      const altEmail = (cols[4] ?? "").trim();
      const altMobileNo = (cols[5] ?? "").toString().trim();
      const subject = (cols[6] ?? "").trim();
      const message = (cols[7] ?? "").trim();
      const state = (cols[8] ?? "").trim();
      const station = (cols[9] ?? "").trim();
      const district = (cols[10] ?? "").trim();
      const pincode = (cols[11] ?? "").trim();
      const agencyName = (cols[12] ?? "").trim();

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
        station: station || undefined,
        district: district || undefined,
        pincode: pincode || undefined,
        agencyName: agencyName || undefined,
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

      if (!currentUser?._id) {
        toast.error("Not authenticated");
        return;
      }

      // Batch the leads to stay under Convex's array arg limit (<= 8192)
      const BATCH_SIZE = 2000; // safe chunk size well below 8192
      const total = leads.length;
      const totalBatches = Math.ceil(total / BATCH_SIZE);

      toast(`Importing ${total} lead(s) in ${totalBatches} batch(es)...`);

      let imported = 0;
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        // eslint-disable-next-line no-await-in-loop
        await bulkCreateLeads({
          leads: batch,
          assignedTo: assignedTo ? (assignedTo as any) : undefined,
          currentUserId: currentUser._id,
        });
        imported += batch.length;
      }

      toast.success(
        `Imported ${imported} lead(s)${assignedTo ? " and assigned" : ""} in ${totalBatches} batch(es)`
      );
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

  const handleChangePassword = async () => {
    try {
      if (!currentUser?._id) {
        toast.error("Not authenticated");
        return;
      }
      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        toast.error("All fields are required");
        return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        toast.error("New passwords do not match");
        return;
      }
      if (passwordForm.newPassword.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
      
      await changePasswordMutation({
        currentUserId: currentUser._id,
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      
      toast.success("Password changed successfully");
      setChangePasswordOpen(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e: any) {
      toast.error(e?.message || "Failed to change password");
    }
  };

  if (!currentUser) {
    return <>{children}</>;
  }

  const isAdmin = currentUser.role === ROLES.ADMIN;
  const isManager = currentUser.role === ROLES.MANAGER;

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
    // Temporarily disabled Campaigns
    // { 
    //   label: "Campaigns", 
    //   path: "/campaigns", 
    //   icon: Send,
    //   roles: [ROLES.ADMIN, ROLES.MANAGER] 
    // },
    { 
      label: "Admin Panel", 
      path: "/admin", 
      icon: Settings,
      roles: [ROLES.ADMIN] 
    },
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: FileText,
      roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF]
    },
  ];

  const filteredNavItems = navigationItems.filter(item => 
    item.roles.includes(currentUser.role)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Admin Impersonation Banner */}
      {originalAdmin && (
        <div className="bg-yellow-500 text-black px-4 py-2 text-center font-medium flex items-center justify-center gap-4">
          <span>
            Logged in as <strong>{currentUser?.name || currentUser?.username}</strong> (Admin View)
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={returnToAdmin}
            className="bg-white hover:bg-gray-100"
          >
            Return to Admin
          </Button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Left: Mobile Menu + Logo */}
            <div className="flex items-center gap-2">
              {/* Mobile menu trigger */}
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    aria-label="Open Menu"
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-4">
                    <SheetHeader>
                      <SheetTitle className="text-white">Cafoli CRM</SheetTitle>
                    </SheetHeader>
                    {currentUser && (
                      <div className="mt-2 text-sm opacity-90">
                        <div className="font-medium">{currentUser.name}</div>
                        <div className="capitalize">{currentUser.role}</div>
                      </div>
                    )}
                  </div>
                  <nav className="px-2 py-3 space-y-1">
                    {filteredNavItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Button
                          key={item.path}
                          variant="ghost"
                          className="w-full justify-start gap-2"
                          onClick={() => {
                            navigate(item.path);
                            setMobileNavOpen(false);
                          }}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </Button>
                      );
                    })}
                  </nav>
                  <div className="px-2 pt-2 pb-4 border-t space-y-2">
                    {(isAdmin || isManager) && (
                      <Button
                        className="w-full gap-2"
                        onClick={() => {
                          setAddDialogOpen(true);
                          setMobileNavOpen(false);
                        }}
                      >
                        <PlusCircle className="w-4 h-4" />
                        Add Lead
                      </Button>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1"
                        onClick={() => {
                          navigate("/notifications");
                          setMobileNavOpen(false);
                        }}
                      >
                        <Bell className="w-4 h-4 mr-2" />
                        Notifications
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex-1 text-red-600"
                        onClick={() => {
                          setMobileNavOpen(false);
                          logout();
                        }}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Logo */}
              <motion.div
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => navigate("/all_leads")}
                whileHover={{ scale: 1.05 }}
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">C</span>
                </div>
                <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Cafoli CRM
                </span>
              </motion.div>
            </div>

            {/* Navigation (desktop) */}
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
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Add Lead quick action on mobile */}
              {(isAdmin || isManager) && (
                <Button
                  variant="default"
                  size="icon"
                  className="sm:hidden"
                  onClick={() => setAddDialogOpen(true)}
                  aria-label="Add Lead"
                >
                  <PlusCircle className="w-4 h-4" />
                </Button>
              )}

              {/* Notifications */}
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate("/notifications")}
                aria-label="Notifications"
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

              {/* Import/Export (Admin only, desktop already) */}
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const headers = [
                        "Name",
                        "Source",
                        "Email",
                        "Phone No.",
                        "Alt Email",
                        "Alt Phone No",
                        "Subject",
                        "Message",
                        "State",
                        "Station",
                        "District",
                        "Pincode",
                        "Agency Name"
                      ];
                      const csvContent = headers.join(",");
                      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "import_template.csv";
                      link.click();
                      URL.revokeObjectURL(url);
                      toast.success("Template downloaded");
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Download Import Template
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

              {/* User Info + Logout */}
              <div className="hidden sm:flex items-center space-x-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{currentUser.role}</p>
                      </div>
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Change Password
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout} className="text-red-600">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* Compact logout for mobile */}
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="sm:hidden text-gray-500 hover:text-red-600"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Current Password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
            />
            <Input
              type="password"
              placeholder="New Password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
            />
            <Input
              type="password"
              placeholder="Confirm New Password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword}>
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Add Lead Dialog (Admin + Manager) */}
      {(isAdmin || isManager) && (
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Lead Manually</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Left column */}
              <div className="space-y-2">
                <Input
                  placeholder="Name (required)"
                  value={leadForm.name}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, name: e.target.value }))}
                />
                <Input
                  placeholder="Mobile No (required)"
                  value={leadForm.mobileNo}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, mobileNo: e.target.value }))}
                />
                <Input
                  placeholder="Email (required)"
                  value={leadForm.email}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                />
                <Input
                  placeholder="Alt Mobile"
                  value={leadForm.altMobileNo}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, altMobileNo: e.target.value }))}
                />
                <Input
                  placeholder="Alt Email"
                  value={leadForm.altEmail}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, altEmail: e.target.value }))}
                />
                <Input
                  placeholder="State (required)"
                  value={leadForm.state}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, state: e.target.value }))}
                />
                <Input
                  placeholder="Source"
                  value={leadForm.source}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, source: e.target.value }))}
                />
              </div>

              {/* Right column */}
              <div className="space-y-2">
                <Input
                  placeholder="Subject (required)"
                  value={leadForm.subject}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, subject: e.target.value }))}
                />
                <Textarea
                  placeholder="Message (required)"
                  value={leadForm.message}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, message: e.target.value }))}
                />
                <Input
                  placeholder="Station"
                  value={leadForm.station}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, station: e.target.value }))}
                />
                <Input
                  placeholder="District"
                  value={leadForm.district}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, district: e.target.value }))}
                />
                <Input
                  placeholder="Pincode"
                  value={leadForm.pincode}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, pincode: e.target.value }))}
                />
                <Input
                  placeholder="Agency Name"
                  value={leadForm.agencyName}
                  onChange={(e: any) => setLeadForm((f) => ({ ...f, agencyName: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAddDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    if (!currentUser?._id) {
                      toast.error("Not authenticated");
                      return;
                    }
                    const req = ["name", "mobileNo", "email", "subject", "message", "state"] as const;
                    for (const k of req) {
                      if (!String(leadForm[k]).trim()) {
                        toast.error(`Missing required: ${k}`);
                        return;
                      }
                    }
                    await bulkCreateLeads({
                      leads: [
                        {
                          name: leadForm.name,
                          subject: leadForm.subject,
                          message: leadForm.message,
                          mobileNo: leadForm.mobileNo,
                          email: leadForm.email,
                          altMobileNo: leadForm.altMobileNo || "",
                          altEmail: leadForm.altEmail || "",
                          state: leadForm.state,
                          source: leadForm.source || "manual",
                          station: leadForm.station || undefined,
                          district: leadForm.district || undefined,
                          pincode: leadForm.pincode || undefined,
                          agencyName: leadForm.agencyName || undefined,
                        },
                      ],
                      currentUserId: currentUser._id,
                    });
                    toast.success("Lead added");
                    setAddDialogOpen(false);
                    setLeadForm({
                      name: "",
                      mobileNo: "",
                      email: "",
                      subject: "",
                      message: "",
                      altMobileNo: "",
                      altEmail: "",
                      state: "",
                      source: "",
                      station: "",
                      district: "",
                      pincode: "",
                      agencyName: "",
                    });
                  } catch (e: any) {
                    toast.error(e?.message || "Failed to add lead");
                  }
                }}
              >
                Save Lead
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}