import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ROLES } from "@/convex/schema";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useLocation } from "react-router";
import { toast } from "sonner";

type Filter = "all" | "assigned" | "unassigned";

export default function AllLeadsPage() {
  const { currentUser, initializeAuth } = useCrmAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Define dashboard-enforced heat route to avoid use-before-declaration issues
  const enforcedHeatRoute: "hot" | "cold" | "mature" | "" =
    location.pathname.includes("/dashboard/hot")
      ? "hot"
      : location.pathname.includes("/dashboard/cold")
      ? "cold"
      : location.pathname.includes("/dashboard/mature")
      ? "mature"
      : "";

  // Add: wait for auth to settle before running queries (prevents early invalid args in deploy)
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    initializeAuth();
    // Mark ready on next tick to allow localStorage-based auth to rehydrate
    const t = setTimeout(() => setAuthReady(true), 50);
    return () => clearTimeout(t);
  }, []); // run once to avoid re-run loops

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!currentUser) {
      navigate("/");
      return;
    }
  }, [currentUser, navigate]);

  const [filter, setFilter] = useState<Filter>("all");
  // For non-admins on /all_leads, default to "Unassigned" so assigned leads disappear from this list
  useEffect(() => {
    if (!authReady || !currentUser) return;
    if (!enforcedHeatRoute && currentUser.role !== ROLES.ADMIN && filter === "all") {
      setFilter("unassigned");
    }
  }, [authReady, currentUser?._id, currentUser?.role, enforcedHeatRoute, filter]);
  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const leads = useQuery(
    api.leads.getAllLeads,
    currentUser && authReady
      ? {
          // Pass the selected filter to the backend so results match the UI buttons
          filter,
          currentUserId: currentUser._id as any,
          assigneeId:
            assigneeFilter === "all"
              ? undefined
              : assigneeFilter === "unassigned"
              ? ("unassigned" as any)
              : (assigneeFilter as any),
        }
      : "skip"
  );
  const users = useQuery(
    api.users.getAllUsers,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ); // Admin only
  const assignable = useQuery(
    api.users.getAssignableUsers,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ); // Admin + Manager
  const assignLead = useMutation(api.leads.assignLead);
  const setNextFollowup = useMutation(api.leads.setNextFollowup);
  const cancelFollowup = useMutation(api.leads.cancelFollowup);
  const deleteLeadAdmin = useMutation(api.leads.deleteLeadAdmin);
  const updateLeadStatus = useMutation(api.leads.updateLeadStatus);
  const updateLeadDetails = useMutation(api.leads.updateLeadDetails);
  const updateLeadHeat = useMutation(api.leads.updateLeadHeat);

  // New: also subscribe to my leads (used for dashboard heat routes for Manager/Staff)
  const myLeads = useQuery(
    api.leads.getMyLeads,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  );

  // Decide data source: Admin -> all leads; Manager/Staff -> depends on context
  const sourceLeads = useMemo(() => {
    if (!currentUser) return leads;
    
    // For dashboard heat routes, non-admins should see their assigned leads
    if (enforcedHeatRoute && currentUser.role !== ROLES.ADMIN) {
      return myLeads;
    }
    
    // For regular All Leads page, everyone sees the filtered results from getAllLeads
    return leads;
  }, [currentUser?.role, leads, myLeads, enforcedHeatRoute]);

  const userOptions = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === ROLES.ADMIN) {
      return users ?? [];
    }
    if (currentUser.role === ROLES.MANAGER) {
      return assignable ?? [];
    }
    return [];
  }, [currentUser?.role, currentUser?._id, users, assignable]);

  const canView = currentUser && (currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER);
  
  if (!currentUser) return <Layout><div /></Layout>;
  if (!canView) return <Layout><div className="max-w-4xl mx-auto"><Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent>You don't have access to this page.</CardContent></Card></div></Layout>;

  // Debug: Compare server-side count vs UI count (same deployment as webhook HTTP)
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [serverLatest, setServerLatest] = useState<{ _id: string; _creationTime: number; name?: string } | null>(null);
  // Use ONLY the explicit webhook URL for HTTP endpoints (.site)
  const envWebhookBase = (import.meta as any).env?.VITE_WEBHOOK_URL as string | undefined;
  const isWebhookUrlConfigured = !!(envWebhookBase && envWebhookBase.trim().length > 0);

  // Add: syncing state for the Sync button
  const [syncing, setSyncing] = useState(false);

  async function loadServerCount() {
    if (!isWebhookUrlConfigured) {
      toast.error("VITE_WEBHOOK_URL is not configured.");
      return;
    }
    try {
      setSyncing(true); // start loading
      // Normalize base URL by trimming trailing forward slashes
      const base = envWebhookBase!.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/webhook/leads_count`, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.ok) {
        setServerCount(Number(json.count ?? 0));
        setServerLatest(json.latest ?? null);
        toast.success("Synced server counts");
      } else {
        setServerCount(null);
        setServerLatest(null);
        toast.error(json?.error || "Failed to sync");
      }
    } catch (e: any) {
      setServerCount(null);
      setServerLatest(null);
      toast.error(e?.message || "Sync error");
    } finally {
      setSyncing(false);
    }
  }

  // Add: sync action to import from logs, then refresh counts and UI
  async function syncNow() {
    if (!isWebhookUrlConfigured) {
      toast.error("VITE_WEBHOOK_URL is not configured.");
      return;
    }
    try {
      setSyncing(true);
      const base = envWebhookBase!.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/webhook/import_from_logs`, { method: "POST" });
      const json = await res.json();
      if (!json?.ok) {
        throw new Error(json?.error || "Failed to import from logs");
      }
      toast.success(`Imported=${json.created}, Clubbed=${json.clubbed}, Skipped=${json.skipped}`);
      await loadServerCount();
      // Force UI to reflect latest leads (ensures useQuery updates immediately on deployment)
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadServerCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute filtered leads locally
  const filteredLeads = useMemo(() => {
    const arr: Array<any> = ((sourceLeads ?? []) as Array<any>);

    // Apply UI-level assignment filters so assigned leads disappear immediately on /all_leads
    const withAssignFilters = arr.filter((lead: any) => {
      const assignedId = String(
        lead?.assignedTo ||
          lead?.assignedUserId ||
          lead?.assignedUser?._id ||
          ""
      );
      const hasAssignee = !!assignedId || !!lead?.assignedUserName;

      // Top buttons: All / Assigned / Unassigned
      if (filter === "unassigned" && hasAssignee) return false;
      if (filter === "assigned" && !hasAssignee) return false;

      // Account dropdown: All / Unassigned / Specific user
      if (assigneeFilter === "unassigned") return !hasAssignee;
      if (assigneeFilter !== "all") {
        return assignedId && assignedId === assigneeFilter;
      }
      return true;
    });

    const q = (search || "").trim().toLowerCase();
    if (!q) return withAssignFilters;

    return withAssignFilters.filter((lead: any) => {
      const fields = [
        lead?.name,
        lead?.subject,
        lead?.message,
        lead?.mobileNo,
        lead?.altMobileNo,
        lead?.email,
        lead?.altEmail,
        lead?.agencyName,
        lead?.state,
        lead?.district,
        lead?.station,
        lead?.source,
        lead?.assignedUserName,
      ];
      return fields.some((f) => String(f || "").toLowerCase().includes(q));
    });
  }, [sourceLeads, search, filter, assigneeFilter]);

  // Apply enforced heat from dashboard; exclude leads without a heat
  const filteredLeadsByDashboardHeat = (() => {
    const base: Array<any> =
      (typeof filteredLeads !== "undefined"
        ? (filteredLeads as Array<any>)
        : (sourceLeads as Array<any>)) ?? [];
    if (!enforcedHeatRoute) return base;

    const norm = (s: any) =>
      String(s ?? "")
        .toLowerCase()
        .trim();

    return base.filter((l) => {
      const raw = l?.heat ?? l?.Heat ?? l?.leadType;
      const n = norm(raw);
      if (!n) return false;

      if (enforcedHeatRoute === "hot") {
        return n === "hot" || n.includes("hot");
      }
      if (enforcedHeatRoute === "cold") {
        return n === "cold" || n.includes("cold");
      }
      if (enforcedHeatRoute === "mature") {
        return n === "matured" || n.startsWith("mature");
      }
      return false;
    });
  })();

  // Sort by heat for consistent ordering (Hot -> Mature/Matured -> Cold -> Unset)
  const normalizeHeat = (s: any) =>
    String(s ?? "")
      .toLowerCase()
      .trim()
      .replace(/[\s_-]+/g, "");

  const heatOrder = (h: any) => {
    const n = String(h ?? "").toLowerCase().trim();
    if (n === "hot") return 0;
    if (n === "matured" || n === "mature") return 1;
    if (n === "cold") return 2;
    return 3; // unset/others
  };

  const displayedLeadsSorted: Array<any> = [...((filteredLeadsByDashboardHeat ?? []) as Array<any>)].sort(
    (a, b) => heatOrder(a?.heat) - heatOrder(b?.heat)
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">
            {enforcedHeatRoute === "cold"
              ? "Cold Leads"
              : enforcedHeatRoute === "hot"
              ? "Hot Leads"
              : enforcedHeatRoute === "mature"
              ? "Mature Leads"
              : "All Leads"}
          </h1>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex-1 min-w-[180px] sm:min-w-[240px] sm:max-w-[260px]">
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
                className="shrink-0"
              >
                All
              </Button>
              <Button
                variant={filter === "assigned" ? "default" : "outline"}
                onClick={() => setFilter("assigned")}
                className="shrink-0"
              >
                Assigned
              </Button>
              <Button
                variant={filter === "unassigned" ? "default" : "outline"}
                onClick={() => setFilter("unassigned")}
                className="shrink-0"
              >
                Unassigned
              </Button>
            </div>

            <div className="w-full sm:w-56">
              <Select
                value={assigneeFilter}
                onValueChange={(val) => {
                  setAssigneeFilter(val);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {(users ?? []).map((u: any) => (
                    <SelectItem key={String(u._id)} value={String(u._id)}>
                      {u.name || u.username || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Debug banner: shows server vs UI counts to diagnose deployment mismatch */}
        {currentUser.role === ROLES.ADMIN && isWebhookUrlConfigured && (
          <div className="text-xs sm:text-sm border rounded-md p-3 bg-white/80 backdrop-blur-sm border-blue-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="font-medium">Server leads:</span> {serverCount ?? "—"}{" "}
              <span className="mx-2">•</span>
              <span className="font-medium">UI leads:</span> {(filteredLeads ?? []).length}
              {serverLatest && (
                <>
                  <span className="mx-2">•</span>
                  <span className="font-medium">Latest:</span>{" "}
                  {new Date(serverLatest._creationTime).toLocaleString()}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={syncNow} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
            </div>
          </div>
        )}

        <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
          <CardHeader>
            <CardTitle>Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {displayedLeadsSorted.map((lead: any) => (
                <AccordionItem key={String(lead._id)} value={String(lead._id)}>
                  <AccordionTrigger className="text-left">
                    <div className="flex flex-col w-full gap-2">
                      {/* Top line: Name — Source — Assigned To (read-only) */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="text-sm font-medium">
                          {lead.name || "-"}
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                          <span className="text-gray-500">
                            Source: <span className="text-gray-800">{lead.source || "-"}</span>
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500">
                            Assigned To: <span className="text-gray-800">{lead.assignedUserName || "-"}</span>
                          </span>
                        </div>
                      </div>
                      {/* Second line: Subject */}
                      <div className="text-xs text-gray-600">
                        Subject: <span className="text-gray-800">{lead.subject || "-"}</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {/* Editable Name/Subject/Message block */}
                    <div className="grid md:grid-cols-3 gap-4 py-2">
                      {/* Name (Manual Input) */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Name (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.name || ""}
                            placeholder="Enter name"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  name: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("Name saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save name");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>

                      {/* Subject (Manual Input) */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Subject (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.subject || ""}
                            placeholder="Enter subject"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  subject: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("Subject saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save subject");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>

                      {/* Message (Manual Input) */}
                      <div className="space-y-1 md:col-span-1">
                        <div className="text-xs text-gray-500">Message (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.message || ""}
                            placeholder="Enter message"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  message: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("Message saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save message");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Message (read-only) */}
                    <div className="grid gap-4 py-3">
                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500">Message</div>
                        <div className="text-sm break-words">{lead.message || "-"}</div>
                      </div>
                    </div>

                    {/* Agency Name (Manual Input), Pincode (Manual Input) — State (Manual Input) — District (Manual Input) — Station */}
                    <div className="grid md:grid-cols-5 gap-4 py-2">
                      <div className="md:col-span-2 space-y-1">
                        <div className="text-xs text-gray-500">Agency Name (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.agencyName || ""}
                            placeholder="Enter agency name"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  agencyName: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("Agency name saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save agency name");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Pincode (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.pincode || ""}
                            placeholder="Enter pincode"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  pincode: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("Pincode saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save pincode");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">State (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.state || ""}
                            placeholder="Enter state"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  state: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("State saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save state");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">District (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.district || ""}
                            placeholder="Enter district"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  district: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("District saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save district");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Station (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.station || ""}
                            placeholder="Enter station"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  station: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("Station saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save station");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Assign To (Dynamic Dropdown) and Relevance (Dropdown for Managers) */}
                    <div className="grid md:grid-cols-3 gap-4 mt-4">
                      {/* Assign To */}
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500">Assign To</div>
                        <Select
                          key={`assign-${lead._id}`}
                          onValueChange={async (val) => {
                            try {
                              if (val === "self") {
                                await assignLead({ leadId: lead._id, assignedTo: currentUser._id, currentUserId: currentUser._id });
                                toast.success("Assigned to yourself");
                              } else if (val === "unassign") {
                                await assignLead({ leadId: lead._id, assignedTo: undefined, currentUserId: currentUser._id });
                                toast.success("Lead unassigned");
                              } else {
                                await assignLead({ leadId: lead._id, assignedTo: val as any, currentUserId: currentUser._id });
                                toast.success("Lead assigned");
                              }
                            } catch (e: any) {
                              toast.error(e.message || "Failed to assign");
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder={lead.assignedUserName || "Select assignee"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="self">Assign to Self</SelectItem>
                            <SelectItem value="unassign">Unassign</SelectItem>
                            {userOptions.map((u: any) => (
                              <SelectItem key={String(u._id)} value={String(u._id)}>{u.name || u.username}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Relevance (Managers only; Admin is not permitted by backend) */}
                      {currentUser.role === ROLES.MANAGER && (
                        <div className="space-y-2">
                          <div className="text-xs text-gray-500">Relevance</div>
                          <Select
                            defaultValue={String(lead.status || "yet_to_decide")}
                            onValueChange={async (val) => {
                              try {
                                await updateLeadStatus({ leadId: lead._id, status: val as any, currentUserId: currentUser._id });
                                if (val === "not_relevant") {
                                  toast.success("Lead deleted");
                                } else if (val === "relevant") {
                                  toast.success("Marked relevant");
                                } else {
                                  toast.success("Marked yet-to-decide");
                                }
                              } catch (e: any) {
                                toast.error(e.message || "Failed to update status");
                              }
                            }}
                          >
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="relevant">Relevant</SelectItem>
                              <SelectItem value="not_relevant">Not-Relevant</SelectItem>
                              <SelectItem value="yet_to_decide">Yet-to-Decide</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Lead Type */}
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500">Lead Type</div>
                        <Select
                          defaultValue={String(lead.heat || "")}
                          onValueChange={async (val) => {
                            try {
                              await updateLeadHeat({ leadId: lead._id, heat: val as any, currentUserId: currentUser._id });
                              toast.success("Lead type updated");
                            } catch (e: any) {
                              toast.error(e?.message || "Failed to update lead type");
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Select lead type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hot">Hot Lead</SelectItem>
                            <SelectItem value="cold">Cold Lead</SelectItem>
                            <SelectItem value="matured">Matured Lead</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Next Followup */}
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500">Set Next Followup</div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="datetime-local"
                            onChange={(e) => {
                              (e.currentTarget as any)._ts = new Date(e.target.value).getTime();
                            }}
                          />
                          <Button
                            variant="outline"
                            onClick={async (e) => {
                              const input = (e.currentTarget.parentElement?.querySelector("input[type='datetime-local']") as any);
                              const ts = input?._ts;
                              if (!ts || isNaN(ts)) {
                                toast.error("Pick a valid date/time");
                                return;
                              }
                              try {
                                await setNextFollowup({ leadId: lead._id, followupTime: ts, currentUserId: currentUser._id });
                                toast.success("Followup set");
                              } catch (err: any) {
                                toast.error(err.message || "Failed to set followup");
                              }
                            }}
                          >
                            Save
                          </Button>
                          {currentUser.role === ROLES.ADMIN && (
                            <Button
                              variant="destructive"
                              onClick={async () => {
                                try {
                                  await cancelFollowup({ leadId: lead._id, currentUserId: currentUser._id });
                                  toast.success("Followup cancelled");
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to cancel");
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contacts */}
                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Mobile No. (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.mobileNo || ""}
                            placeholder="Enter mobile number"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  mobileNo: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("Mobile saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save mobile");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Alt Mobile No. (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.altMobileNo || ""}
                            placeholder="Enter alt mobile number"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  altMobileNo: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("Alt mobile saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save alt mobile");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Email (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.email || ""}
                            placeholder="Enter email"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  email: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("Email saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save email");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Alt Email (Manual Input)</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.altEmail || ""}
                            placeholder="Enter alt email"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              const input = (e.currentTarget.previousElementSibling as any);
                              const val = input?._val ?? input?.value ?? "";
                              try {
                                await updateLeadDetails({
                                  leadId: lead._id,
                                  altEmail: val,
                                  currentUserId: currentUser._id,
                                });
                                toast.success("Alt email saved");
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to save alt email");
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Comments */}
                    <CommentsBox leadId={String(lead._id)} currentUserId={String(currentUser._id)} />

                    {/* Admin-only controls */}
                    {currentUser.role === ROLES.ADMIN && (
                      <div className="mt-4">
                        <Button
                          variant="destructive"
                          onClick={async () => {
                            const ok = window.confirm("Delete this lead permanently?");
                            if (!ok) return;
                            try {
                              await deleteLeadAdmin({ leadId: lead._id, currentUserId: currentUser._id });
                              toast.success("Lead deleted");
                            } catch (e: any) {
                              toast.error(e?.message || "Failed to delete lead");
                            }
                          }}
                        >
                          Delete Lead
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function CommentsBox({ leadId, currentUserId }: { leadId: string; currentUserId: string }) {
  const comments = useQuery(api.comments.getLeadComments, { leadId: leadId as any, currentUserId: currentUserId as any }) ?? [];
  const addComment = useMutation(api.comments.addComment);
  const [content, setContent] = useState("");

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Comments</div>
      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
        {comments.length === 0 && <div className="text-xs text-gray-400">No comments yet</div>}
        {comments.map((c: any) => (
          <div key={c._id} className="text-xs">
            <span className="font-medium">{c.userName}</span>: {c.content}
            <span className="text-gray-400"> • {new Date(c.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add a comment"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={async () => {
            if (!content.trim()) return;
            try {
              await addComment({ leadId: leadId as any, content, currentUserId: currentUserId as any });
              setContent("");
            } catch (e: any) {
              toast.error(e.message || "Failed to add comment");
            }
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}