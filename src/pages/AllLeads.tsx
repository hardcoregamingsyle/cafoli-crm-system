import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Filter } from "lucide-react";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ROLES, LEAD_STATUS } from "@/convex/schema";
import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

type Filter = "all" | "assigned" | "unassigned";

export default function AllLeadsPage() {
  const { currentUser, initializeAuth, logout } = useCrmAuth();
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
    if (authReady && !currentUser) {
      navigate("/");
      return;
    }
  }, [authReady, currentUser, navigate]);

  // Add search state
  const [search, setSearch] = useState("");

  // Add filter states
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedHeats, setSelectedHeats] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showNoFollowup, setShowNoFollowup] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Wrap queries with error handling to catch invalid user IDs
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Wrap queries with error handling to catch invalid user IDs
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
  
  try {
=======
  }, [authReady, currentUser?._id, currentUser?.role, enforcedHeatRoute]); // Removed 'filter' from dependencies to prevent loop

  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
  
  try {
=======
  // For non-admins on /all_leads, default to "Unassigned" so assigned leads disappear from this list
  useEffect(() => {
    if (!authReady || !currentUser) return;
    if (!enforcedHeatRoute && currentUser.role !== ROLES.ADMIN && filter === "all") {
      setFilter("unassigned");
    }
  }, [authReady, currentUser?._id, currentUser?.role, enforcedHeatRoute]); // Removed 'filter' from dependencies to prevent loop

  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
  
  try {
=======
  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Wrap queries with error handling to catch invalid user IDs
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Wrap queries with error handling to catch invalid user IDs
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
  
  try {
    leads = useQuery(
=======
  const [filter, setFilter] = useState<Filter>("all");
  const [showNotRelevant, setShowNotRelevant] = useState(false);

  // For non-admins on /all_leads, default to "Unassigned" so assigned leads disappear from this list
  useEffect(() => {
    if (!authReady || !currentUser) return;
    if (!enforcedHeatRoute && currentUser.role !== ROLES.ADMIN && filter === "all") {
      setFilter("unassigned");
    }
  }, [authReady, currentUser?._id, currentUser?.role, enforcedHeatRoute]);

  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
  
  try {
    leads = useQuery(
=======
  // Wrap queries with error handling to catch invalid user IDs
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Wrap queries with error handling to catch invalid user IDs
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
  
  try {
=======
  }, [authReady, currentUser?._id, currentUser?.role, enforcedHeatRoute]); // Removed 'filter' from dependencies to prevent loop

  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
  
  try {
=======
  // For non-admins on /all_leads, default to "Unassigned" so assigned leads disappear from this list
  useEffect(() => {
    if (!authReady || !currentUser) return;
    if (!enforcedHeatRoute && currentUser.role !== ROLES.ADMIN && filter === "all") {
      setFilter("unassigned");
    }
  }, [authReady, currentUser?._id, currentUser?.role, enforcedHeatRoute]); // Removed 'filter' from dependencies to prevent loop

  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
  
  try {
=======
  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Wrap queries with error handling to catch invalid user IDs
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Wrap queries with error handling to catch invalid user IDs
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
  
  try {
=======
  }, [authReady, currentUser?._id, currentUser?.role, enforcedHeatRoute]); // Removed 'filter' from dependencies to prevent loop

  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
  
  try {
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Wrap queries with error handling to catch invalid user IDs
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Ensure stable, string-only state for the assignee filter to avoid re-render loops
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Add: fetch all tags
  const allTags = useQuery(
    (api as any).leadTags.getAllTags,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  ) ?? [];

  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
=======
  // Wrap queries with error handling to catch invalid user IDs
=======
  // Add: mutations for tag management
  const createTag = useMutation((api as any).leadTags.createTag);

  // Wrap queries with error handling to catch invalid user IDs

  // Wrap queries with error handling to catch invalid user IDs
=======

  // Wrap queries with error handling to catch invalid user IDs
  let leads, users, assignable, myLeads, notRelevantLeads;
  
  try {
    leads = useQuery(
      (api as any).leads.getAllLeads,
      currentUser && authReady
        ? {
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
    
    users = useQuery(
      (api as any).users.getAllUsers,
      currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
    );
    
    assignable = useQuery(
      (api as any).users.getAssignableUsers,
      currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
    );
    
    myLeads = useQuery(
      (api as any).leads.getMyLeads,
      currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
    );
    
    notRelevantLeads = useQuery(
      (api as any).leads.getNotRelevantLeads,
      currentUser && authReady && showNotRelevant && currentUser.role === ROLES.ADMIN
        ? { currentUserId: currentUser._id }
        : "skip"
    );
  } catch (error: any) {
    // If there's an authentication error (invalid user ID), log out
    if (error?.message?.includes("ArgumentValidationError") || 
        error?.message?.includes("does not match the table name")) {
      console.error("Authentication error detected, logging out:", error);
      logout();
      return null;
    }
    throw error;
  }

  const assignLead = useMutation((api as any).leads.assignLead);
  const setNextFollowup = useMutation((api as any).leads.setNextFollowup);
  const cancelFollowup = useMutation((api as any).leads.cancelFollowup);
  const deleteLeadAdmin = useMutation((api as any).leads.deleteLeadAdmin);
  const updateLeadStatus = useMutation((api as any).leads.updateLeadStatus);
  const updateLeadDetails = useMutation((api as any).leads.updateLeadDetails);
  const updateLeadHeat = useMutation((api as any).leads.updateLeadHeat);
  const normalizePhoneNumbers = useMutation((api as any).migrate.normalizeAllPhoneNumbers);
  const deleteLeadsWithPlaceholderEmail = useMutation((api as any).leads.deleteLeadsWithPlaceholderEmail);
  const assignTagToLead = useMutation((api as any).leadTags.assignTagToLead);
  const removeTagFromLead = useMutation((api as any).leadTags.removeTagFromLead);

  // Add: state for normalization process
  const [isNormalizing, setIsNormalizing] = useState(false);

  // Decide data source: Admin -> all leads; Manager/Staff -> depends on context
  const sourceLeads = useMemo(() => {
    if (!currentUser) return leads;
    
    // If showing not relevant leads, use that data source
    if (showNotRelevant && currentUser.role === ROLES.ADMIN) {
      return notRelevantLeads;
    }
    
    // For dashboard heat routes, non-admins should see their assigned leads
    if (enforcedHeatRoute && currentUser.role !== ROLES.ADMIN) {
      return myLeads;
    }
    
    // For regular All Leads page, everyone sees the filtered results from getAllLeads
    return leads;
  }, [currentUser?.role, leads, myLeads, enforcedHeatRoute, showNotRelevant, notRelevantLeads]);

  // Get unique sources from all leads
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    (sourceLeads ?? []).forEach((lead: any) => {
      if (lead?.source) {
        sources.add(lead.source);
      }
    });
    return Array.from(sources).sort();
  }, [sourceLeads]);

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
  
  // Both Admin and Manager can edit all fields
  const canEdit = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER;

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

  // Enhanced filtering logic
  const filteredLeads = useMemo(() => {
    let list: Array<any> = sourceLeads ?? [];
    const q = (search || "").trim().toLowerCase();

    // Apply all filters
    const filtered = list.filter((lead: any) => {
      // Search filter
      if (q) {
        const assignedUserName = lead?.assignedUser?.name || lead?.assignedUser?.username || "";
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
          lead?.country,
          assignedUserName,
        ];
        const matchesSearch = fields.some((f: any) => String(f || "").toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // Status filter
      if (selectedStatuses.length > 0) {
        const leadStatus = lead?.status || LEAD_STATUS.YET_TO_DECIDE;
        if (!selectedStatuses.includes(leadStatus)) return false;
      }

      // Source filter
      if (selectedSources.length > 0) {
        const leadSource = lead?.source || "";
        if (!selectedSources.includes(leadSource)) return false;
      }

      // Heat filter
      if (selectedHeats.length > 0) {
        const leadHeat = lead?.heat || "";
        if (!selectedHeats.includes(leadHeat)) return false;
      }

      // Tag filter
      if (selectedTags.length > 0) {
        const leadTags = lead?.tags || [];
        const hasMatchingTag = selectedTags.some((tagId) =>
          leadTags.some((t: any) => String(t._id) === tagId)
        );
        if (!hasMatchingTag) return false;
      }

      // No Followup filter
      if (showNoFollowup) {
        if (lead?.nextFollowup) return false;
      }

      // ... keep existing enforcedHeatRoute filter logic
      if (enforcedHeatRoute) {
        const leadHeat = (lead?.heat || "").toLowerCase();
        const normalizedRoute = enforcedHeatRoute === "mature" ? "matured" : enforcedHeatRoute;
        const normalizedLead = leadHeat === "mature" ? "matured" : leadHeat;
        if (normalizedLead !== normalizedRoute) return false;
      }

      return true;
    });

    // ... keep existing sort logic
    return filtered.sort((a: any, b: any) => {
      const heatOrder: Record<string, number> = { hot: 0, mature: 1, matured: 1, cold: 2 };
      const aHeat = heatOrder[String(a?.heat || "").toLowerCase()] ?? 3;
      const bHeat = heatOrder[String(b?.heat || "").toLowerCase()] ?? 3;
      return aHeat - bHeat;
    });
  }, [sourceLeads, search, selectedStatuses, selectedSources, selectedHeats, selectedTags, showNoFollowup, enforcedHeatRoute]);

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

  // Toggle functions for filters
  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleSource = (source: string) => {
    setSelectedSources(prev => 
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    );
  };

  const toggleHeat = (heat: string) => {
    setSelectedHeats(prev => 
      prev.includes(heat) ? prev.filter(h => h !== heat) : [...prev, heat]
    );
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedSources([]);
    setSelectedHeats([]);
    setSelectedTags([]);
    setShowNoFollowup(false);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">
            {showNotRelevant
              ? "Not Relevant Leads"
              : enforcedHeatRoute === "cold"
              ? "Cold Leads"
              : enforcedHeatRoute === "hot"
              ? "Hot Leads"
              : enforcedHeatRoute === "mature"
              ? "Mature Leads"
              : "All Leads"}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                  {(selectedStatuses.length > 0 || selectedSources.length > 0 || selectedHeats.length > 0 || selectedTags.length > 0 || showNoFollowup) && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedStatuses.length + selectedSources.length + selectedHeats.length + selectedTags.length + (showNoFollowup ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter Leads</SheetTitle>
                  <SheetDescription>
                    Select multiple filters to refine your leads
                  </SheetDescription>
                </SheetHeader>
                
                <div className="mt-6 space-y-6">
                  {/* Status Filters */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Status</h3>
                      {selectedStatuses.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedStatuses([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="status-relevant"
                          checked={selectedStatuses.includes(LEAD_STATUS.RELEVANT)}
                          onCheckedChange={() => toggleStatus(LEAD_STATUS.RELEVANT)}
                        />
                        <Label htmlFor="status-relevant" className="cursor-pointer">
                          Relevant
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="status-yet-to-decide"
                          checked={selectedStatuses.includes(LEAD_STATUS.YET_TO_DECIDE)}
                          onCheckedChange={() => toggleStatus(LEAD_STATUS.YET_TO_DECIDE)}
                        />
                        <Label htmlFor="status-yet-to-decide" className="cursor-pointer">
                          Yet to Decide
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Source Filters */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Lead Source</h3>
                      {selectedSources.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedSources([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {uniqueSources.map((source) => (
                        <div key={source} className="flex items-center space-x-2">
                          <Checkbox
                            id={`source-${source}`}
                            checked={selectedSources.includes(source)}
                            onCheckedChange={() => toggleSource(source)}
                          />
                          <Label htmlFor={`source-${source}`} className="cursor-pointer capitalize">
                            {source}
                          </Label>
                        </div>
                      ))}
                      {uniqueSources.length === 0 && (
                        <p className="text-sm text-gray-500">No sources available</p>
                      )}
                    </div>
                  </div>

                  {/* Heat Filters */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Lead Type</h3>
                      {selectedHeats.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedHeats([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="heat-hot"
                          checked={selectedHeats.includes("hot")}
                          onCheckedChange={() => toggleHeat("hot")}
                        />
                        <Label htmlFor="heat-hot" className="cursor-pointer">
                          Hot
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="heat-cold"
                          checked={selectedHeats.includes("cold")}
                          onCheckedChange={() => toggleHeat("cold")}
                        />
                        <Label htmlFor="heat-cold" className="cursor-pointer">
                          Cold
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="heat-matured"
                          checked={selectedHeats.includes("matured")}
                          onCheckedChange={() => toggleHeat("matured")}
                        />
                        <Label htmlFor="heat-matured" className="cursor-pointer">
                          Mature
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Tag Filters */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Tags</h3>
                      {selectedTags.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedTags([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {(allTags ?? []).map((tag: any) => (
                        <div key={String(tag._id)} className="flex items-center space-x-2">
                          <Checkbox
                            id={`tag-${tag._id}`}
                            checked={selectedTags.includes(String(tag._id))}
                            onCheckedChange={() => toggleTag(String(tag._id))}
                          />
                          <Label htmlFor={`tag-${tag._id}`} className="cursor-pointer flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </Label>
                        </div>
                      ))}
                      {(allTags ?? []).length === 0 && (
                        <p className="text-sm text-gray-500">No tags available</p>
                      )}
                    </div>
                  </div>

                  {/* No Followup Filter */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Followup Status</h3>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="no-followup"
                          checked={showNoFollowup}
                          onCheckedChange={(checked) => setShowNoFollowup(!!checked)}
                        />
                        <Label htmlFor="no-followup" className="cursor-pointer">
                          No Followup Set
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Clear All Button */}
                  {(selectedStatuses.length > 0 || selectedSources.length > 0 || selectedHeats.length > 0 || selectedTags.length > 0 || showNoFollowup) && (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={clearFilters}
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {currentUser.role === ROLES.ADMIN && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={filter === "all" ? "default" : "outline"}
                    onClick={() => {
                      setFilter("all");
                      setShowNotRelevant(false);
                    }}
                    className="shrink-0"
                  >
                    All
                  </Button>
                  <Button
                    variant={filter === "assigned" ? "default" : "outline"}
                    onClick={() => {
                      setFilter("assigned");
                      setShowNotRelevant(false);
                    }}
                    className="shrink-0"
                  >
                    Assigned
                  </Button>
                  <Button
                    variant={filter === "unassigned" ? "default" : "outline"}
                    onClick={() => {
                      setFilter("unassigned");
                      setShowNotRelevant(false);
                    }}
                    className="shrink-0"
                  >
                    Unassigned
                  </Button>
                  <Button
                    variant={showNotRelevant ? "default" : "outline"}
                    onClick={() => setShowNotRelevant(!showNotRelevant)}
                    className="shrink-0"
                  >
                    Not Relevant
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
              </>
            )}
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
              <Button 
                size="sm" 
                variant="outline" 
                onClick={async () => {
                  if (isNormalizing) return;
                  const confirm = window.confirm("Normalize all phone numbers and delete leads with placeholder emails (unknown@example.com)? This will update all leads and WhatsApp messages.");
                  if (!confirm) return;
                  
                  try {
                    setIsNormalizing(true);
                    
                    // First, delete placeholder email leads
                    const deleteResult = await deleteLeadsWithPlaceholderEmail({ currentUserId: currentUser._id });
                    
                    // Then normalize phone numbers
                    const normalizeResult = await normalizePhoneNumbers({});
                    
                    toast.success(`Deleted ${deleteResult.deletedCount} placeholder leads. Normalized ${normalizeResult.updatedCount} phone numbers with ${normalizeResult.errorCount} errors.`);
                    window.location.reload();
                  } catch (error: any) {
                    toast.error(error?.message || "Failed to normalize and clean up");
                  } finally {
                    setIsNormalizing(false);
                  }
                }}
                disabled={isNormalizing}
              >
                {isNormalizing ? "Normalizing..." : "Normalize"}
              </Button>
            </div>
          </div>
        )}

        <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
          <CardHeader>
            <CardTitle>Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {displayedLeadsSorted.map((lead: any) => {
                // Get highlight status similar to MyLeads page
                const now = Date.now();
                let highlightClass = "";
                
                // Check for inactivity highlighting (highest priority)
                if (lead.assignedTo && lead.lastActivityTime) {
                  const timeSinceActivity = now - lead.lastActivityTime;
                  const daysSinceActivity = timeSinceActivity / (24 * 60 * 60 * 1000);
                  
                  let inactivityThreshold = 0;
                  if (lead.status === "relevant") {
                    inactivityThreshold = 3;
                  } else if (lead.status === "yet_to_decide") {
                    inactivityThreshold = 2;
                  } else if (lead.heat === "matured") {
                    inactivityThreshold = 15;
                  } else if (lead.heat === "hot") {
                    inactivityThreshold = 5;
                  }
                  
                  if (inactivityThreshold > 0 && daysSinceActivity >= inactivityThreshold) {
                    highlightClass = "bg-orange-100 border-l-4 border-orange-500";
                  }
                }
                
                // Check for followup highlighting
                if (!highlightClass && lead.nextFollowup) {
                  const timeUntilFollowup = lead.nextFollowup - now;
                  const minutesUntilFollowup = timeUntilFollowup / (60 * 1000);
                  
                  if (timeUntilFollowup < 0) {
                    highlightClass = "bg-red-100 border-l-4 border-red-500";
                  } else if (minutesUntilFollowup <= 15) {
                    highlightClass = "bg-yellow-100 border-l-4 border-yellow-400";
                  } else if (minutesUntilFollowup <= 30) {
                    highlightClass = "bg-green-100 border-l-4 border-green-400";
                  }
                }
                
                return (
                <AccordionItem key={String(lead._id)} value={String(lead._id)} className={highlightClass}>
                  <AccordionTrigger className="text-left">
                    <div className="flex flex-col w-full gap-2">
                      {/* Top line: Name — Source — Assigned To (read-only) */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">
                            {lead.name || "-"}
                          </div>
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
                    {/* Tags section at the top */}
                    <div className="mb-4 pb-4 border-b">
                      <LeadTagsSection
                        leadId={String(lead._id)}
                        currentUserId={String(currentUser._id)}
                        currentUserRole={currentUser.role}
                        leadAssignedTo={lead.assignedTo}
                        allTags={allTags}
                        onAssign={async (tagId) => {
                          try {
                            await assignTagToLead({
                              currentUserId: currentUser._id,
                              leadId: lead._id,
                              tagId: tagId as any,
                            });
                            toast.success("Tag assigned");
                          } catch (e: any) {
                            toast.error(e?.message || "Failed to assign tag");
                          }
                        }}
                        onRemove={async (tagId) => {
                          try {
                            await removeTagFromLead({
                              currentUserId: currentUser._id,
                              leadId: lead._id,
                              tagId: tagId as any,
                            });
                            toast.success("Tag removed");
                          } catch (e: any) {
                            toast.error(e?.message || "Failed to remove tag");
                          }
                        }}
                        onCreateTag={async () => {
                          const name = prompt("Enter tag name:");
                          if (!name) return;
                          const color = prompt("Enter tag color (hex code, e.g., #FF5733):");
                          if (!color) return;
                          try {
                            await createTag({
                              currentUserId: currentUser._id,
                              name,
                              color,
                            });
                            toast.success("Tag created");
                          } catch (e: any) {
                            toast.error(e?.message || "Failed to create tag");
                          }
                        }}
                      />
                    </div>

                    {/* Editable Name/Subject/Message block */}
                    <div className="grid md:grid-cols-3 gap-4 py-2">
                      {/* Name (Manual Input) - Both Admin and Manager can edit */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Name {canEdit ? "(Manual Input)" : ""}</div>
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

                      {/* Subject (Manual Input) - Both Admin and Manager can edit */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Subject {canEdit ? "(Manual Input)" : ""}</div>
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

                      {/* Message (Manual Input) - Both Admin and Manager can edit */}
                      <div className="space-y-1 md:col-span-1">
                        <div className="text-xs text-gray-500">Message {canEdit ? "(Manual Input)" : ""}</div>
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
                        <div className="text-xs text-gray-500">Agency Name {canEdit ? "(Manual Input)" : ""}</div>
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
                        <div className="text-xs text-gray-500">Pincode {canEdit ? "(Manual Input)" : ""}</div>
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
                        <div className="text-xs text-gray-500">State {canEdit ? "(Manual Input)" : ""}</div>
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
                        <div className="text-xs text-gray-500">District {canEdit ? "(Manual Input)" : ""}</div>
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
                        <div className="text-xs text-gray-500">Station {canEdit ? "(Manual Input)" : ""}</div>
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
                        <div className="text-xs text-gray-500">Mobile No. {canEdit ? "(Manual Input)" : ""}</div>
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
                        <div className="text-xs text-gray-500">Alt Mobile No. {canEdit ? "(Manual Input)" : ""}</div>
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
                        <div className="text-xs text-gray-500">Email {canEdit ? "(Manual Input)" : ""}</div>
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
                        <div className="text-xs text-gray-500">Alt Email {canEdit ? "(Manual Input)" : ""}</div>
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
              );
              })}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function LeadTagsSection({
  leadId,
  currentUserId,
  currentUserRole,
  leadAssignedTo,
  allTags,
  onAssign,
  onRemove,
  onCreateTag,
}: {
  leadId: string;
  currentUserId: string;
  currentUserRole: string;
  leadAssignedTo?: string;
  allTags: any[];
  onAssign: (tagId: string) => Promise<void>;
  onRemove: (tagId: string) => Promise<void>;
  onCreateTag: () => Promise<void>;
}) {
  const leadTags = useQuery(
    (api as any).leadTags.getLeadTags,
    { currentUserId: currentUserId as any, leadId: leadId as any }
  ) ?? [];

  const [showTagPopover, setShowTagPopover] = useState(false);

  const availableTags = allTags.filter(
    (tag) => !leadTags.some((lt: any) => String(lt._id) === String(tag._id))
  );

  // Check if user can add/remove tags (admin or assigned to lead)
  const canManageTags = currentUserRole === ROLES.ADMIN || String(leadAssignedTo) === String(currentUserId);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">Tags</div>
      <div className="flex flex-wrap items-center gap-2">
        {leadTags.length === 0 && (
          <span className="text-xs text-gray-400">No tags assigned</span>
        )}
        {leadTags.map((tag: any) => (
          <Badge
            key={String(tag._id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-white border-0"
            style={{ backgroundColor: tag.color }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full bg-white/30"
            />
            <span className="font-medium">{tag.name}</span>
            {canManageTags && (
              <button
                onClick={() => onRemove(String(tag._id))}
                className="ml-1 hover:opacity-70 font-bold text-sm"
              >
                ×
              </button>
            )}
          </Badge>
        ))}
        {canManageTags && (
          <Sheet open={showTagPopover} onOpenChange={setShowTagPopover}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
              >
                + Add Tag
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Add Tag to Lead</SheetTitle>
                <SheetDescription>
                  Select an existing tag or create a new one
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3">
                <Button
                  variant="default"
                  className="w-full"
                  onClick={async () => {
                    await onCreateTag();
                    setShowTagPopover(false);
                  }}
                >
                  + Create New Tag
                </Button>
                <div className="border-t pt-3">
                  <div className="text-sm font-medium mb-2">Available Tags</div>
                  {availableTags.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-4">No tags available</div>
                  ) : (
                    <div className="space-y-2">
                      {availableTags.map((tag: any) => (
                        <Button
                          key={String(tag._id)}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={async () => {
                            await onAssign(String(tag._id));
                            setShowTagPopover(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span>{tag.name}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}

function CommentsBox({ leadId, currentUserId }: { leadId: string; currentUserId: string }) {
  const comments = useQuery((api as any).comments.getLeadComments, { leadId: leadId as any, currentUserId: currentUserId as any }) ?? [];
  const addComment = useMutation((api as any).comments.addComment);
  const [content, setContent] = useState("");

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Comments</div>
      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
        {comments.length === 0 && <div className="text-xs text-gray-400">No comments yet</div>}
        {comments.map((c: any) => (
          <div 
            key={c._id} 
            className={`text-xs ${c.isSystemComment ? 'bg-yellow-100 p-2 rounded border-l-4 border-yellow-400' : ''}`}
          >
            {c.isSystemComment ? (
              <>
                <div className="font-medium text-gray-700">{c.content}</div>
                <span className="text-gray-400 text-[10px]">{new Date(c.timestamp).toLocaleString()}</span>
              </>
            ) : (
              <>
                <span className="font-medium">{c.userName}</span>: {c.content}
                <span className="text-gray-400"> • {new Date(c.timestamp).toLocaleString()}</span>
              </>
            )}
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