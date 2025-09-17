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
import { toast } from "sonner";

type Filter = "all" | "assigned" | "unassigned";

export default function AllLeadsPage() {
  const { currentUser, initializeAuth } = useCrmAuth();
  const navigate = useNavigate();

  useEffect(() => {
    initializeAuth();
  }, []); // run once to avoid re-run loops

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!currentUser) {
      navigate("/");
      return;
    }
  }, [currentUser, navigate]);

  const [filter, setFilter] = useState<Filter>("all");
  const leads = useQuery(api.leads.getAllLeads, { filter, currentUserId: currentUser?._id });
  const users = useQuery(api.users.getAllUsers, { currentUserId: currentUser?._id }); // Admin only
  const assignable = useQuery(api.users.getAssignableUsers, { currentUserId: currentUser?._id }); // Admin + Manager
  const assignLead = useMutation(api.leads.assignLead);
  const setNextFollowup = useMutation(api.leads.setNextFollowup);
  const cancelFollowup = useMutation(api.leads.cancelFollowup);
  const deleteLeadAdmin = useMutation(api.leads.deleteLeadAdmin);

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

  useEffect(() => {
    loadServerCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">All Leads</h1>
          <div className="flex items-center gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
            <Button variant={filter === "assigned" ? "default" : "outline"} onClick={() => setFilter("assigned")}>Assigned</Button>
            <Button variant={filter === "unassigned" ? "default" : "outline"} onClick={() => setFilter("unassigned")}>Unassigned</Button>
          </div>
        </div>

        {/* Debug banner: shows server vs UI counts to diagnose deployment mismatch */}
        {isWebhookUrlConfigured && (
          <div className="text-xs sm:text-sm border rounded-md p-3 bg-white/80 backdrop-blur-sm border-blue-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="font-medium">Server leads:</span> {serverCount ?? "—"}{" "}
              <span className="mx-2">•</span>
              <span className="font-medium">UI leads:</span> {(leads ?? []).length}
              {serverLatest && (
                <>
                  <span className="mx-2">•</span>
                  <span className="font-medium">Latest:</span>{" "}
                  {new Date(serverLatest._creationTime).toLocaleString()}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={loadServerCount} disabled={syncing}>
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
              {(leads ?? []).map((lead: any) => (
                <AccordionItem key={String(lead._id)} value={String(lead._id)}>
                  <AccordionTrigger className="text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-2">
                      <div className="text-sm">
                        <div className="font-medium">{lead.name} <span className="text-gray-500">• {lead.subject}</span></div>
                        <div className="text-xs text-gray-600 line-clamp-1">{lead.message}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {lead.assignedTo ? (
                          <Badge variant="secondary">Assigned {lead.assignedUserName ? `• ${lead.assignedUserName}` : ""}</Badge>
                        ) : (
                          <Badge variant="outline">Unassigned</Badge>
                        )}
                        <Badge className="capitalize">{lead.status || "yet_to_decide"}</Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid md:grid-cols-2 gap-4 py-3">
                      {/* Name */}
                      <div>
                        <div className="text-xs text-gray-500">Name</div>
                        <div className="text-sm">{lead.name || "-"}</div>
                      </div>
                      {/* Subject */}
                      <div>
                        <div className="text-xs text-gray-500">Subject</div>
                        <div className="text-sm">{lead.subject || "-"}</div>
                      </div>
                      {/* Message (full width on md) */}
                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500">Message</div>
                        <div className="text-sm break-words">{lead.message || "-"}</div>
                      </div>

                      {/* Mobile No */}
                      <div>
                        <div className="text-xs text-gray-500">Mobile No.</div>
                        <div className="text-sm">{lead.mobileNo || "-"}</div>
                      </div>
                      {/* Alt. Mobile */}
                      <div>
                        <div className="text-xs text-gray-500">Alt. Mobile</div>
                        <div className="text-sm">{lead.altMobileNo || "-"}</div>
                      </div>

                      {/* Email */}
                      <div>
                        <div className="text-xs text-gray-500">Email</div>
                        <div className="text-sm break-all">{lead.email || "-"}</div>
                      </div>
                      {/* Alt. Email */}
                      <div>
                        <div className="text-xs text-gray-500">Alt. Email</div>
                        <div className="text-sm break-all">{lead.altEmail || "-"}</div>
                      </div>

                      {/* State */}
                      <div>
                        <div className="text-xs text-gray-500">State</div>
                        <div className="text-sm">{lead.state || "-"}</div>
                      </div>
                      {/* Assigned To */}
                      <div>
                        <div className="text-xs text-gray-500">Assigned To</div>
                        <div className="text-sm">{lead.assignedUserName || "-"}</div>
                      </div>

                      {/* Relevance */}
                      <div>
                        <div className="text-xs text-gray-500">Relevance</div>
                        <div className="text-sm capitalize">{lead.status || "yet_to_decide"}</div>
                      </div>
                      {/* Next Followup */}
                      <div>
                        <div className="text-xs text-gray-500">Next Followup</div>
                        <div className="text-sm">{lead.nextFollowup ? new Date(lead.nextFollowup).toLocaleString() : "Not set"}</div>
                      </div>
                    </div>

                    {/* Controls: Assign, Followup, Comments */}
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
                              <SelectItem key={u._id} value={u._id}>{u.name || u.username}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Followup */}
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

                      {/* Comments */}
                      <CommentsBox leadId={lead._id} currentUserId={currentUser._id} />
                    </div>

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