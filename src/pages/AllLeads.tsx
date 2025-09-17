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
import { useEffect, useMemo, useState } from "react";
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
  const leads = useQuery(api.leads.getAllLeads, { filter });
  const users = useQuery(api.users.getAllUsers); // Admin only
  const assignable = useQuery(api.users.getAssignableUsers); // Admin + Manager
  const assignLead = useMutation(api.leads.assignLead);
  const setNextFollowup = useMutation(api.leads.setNextFollowup);
  const cancelFollowup = useMutation(api.leads.cancelFollowup);

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
                    <div className="grid md:grid-cols-3 gap-4 py-3">
                      <div>
                        <div className="text-xs text-gray-500">Mobile No.</div>
                        <div className="text-sm">{lead.mobileNo}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Email</div>
                        <div className="text-sm break-all">{lead.email}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">State</div>
                        <div className="text-sm">{lead.state}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Alt. Mobile</div>
                        <div className="text-sm">{lead.altMobileNo || "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Alt. Email</div>
                        <div className="text-sm break-all">{lead.altEmail || "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Next Followup</div>
                        <div className="text-sm">{lead.nextFollowup ? new Date(lead.nextFollowup).toLocaleString() : "Not set"}</div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mt-4">
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500">Assign To</div>
                        <Select
                          key={`assign-${lead._id}`}
                          onValueChange={async (val) => {
                            try {
                              if (val === "self") {
                                await assignLead({ leadId: lead._id, assignedTo: currentUser._id });
                                toast.success("Assigned to yourself");
                              } else if (val === "unassign") {
                                await assignLead({ leadId: lead._id, assignedTo: undefined });
                                toast.success("Lead unassigned");
                              } else {
                                await assignLead({ leadId: lead._id, assignedTo: val as any });
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
                                await setNextFollowup({ leadId: lead._id, followupTime: ts });
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
                                  await cancelFollowup({ leadId: lead._id });
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

                      <CommentsBox leadId={lead._id} />
                    </div>
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

function CommentsBox({ leadId }: { leadId: string }) {
  const comments = useQuery(api.comments.getLeadComments, { leadId: leadId as any }) ?? [];
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
              await addComment({ leadId: leadId as any, content });
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