import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ROLES, LEAD_STATUS } from "@/convex/schema";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function MyLeadsPage() {
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

  const leads = useQuery(
    api.leads.getMyLeads,
    currentUser ? { currentUserId: currentUser._id } : "skip"
  );
  const updateLeadStatus = useMutation(api.leads.updateLeadStatus);
  const setNextFollowup = useMutation(api.leads.setNextFollowup);
  const assignLead = useMutation(api.leads.assignLead);
  const updateLeadDetails = useMutation(api.leads.updateLeadDetails);
  const updateLeadHeat = useMutation(api.leads.updateLeadHeat);

  // Add search state
  const [search, setSearch] = useState("");

  // Compute filtered leads locally
  const filteredLeads = (leads ?? []).filter((lead: any) => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return true;
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
    ];
    return fields.some((f: any) => String(f || "").toLowerCase().includes(q));
  });

  if (!currentUser) return <Layout><div /></Layout>;
  if (currentUser.role === ROLES.ADMIN) {
    return <Layout><div className="max-w-4xl mx-auto"><Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent>Admins don't have access to My Leads.</CardContent></Card></div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Leads</h1>
          <div className="w-56">
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
          <CardHeader>
            <CardTitle>Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {(filteredLeads ?? []).map((lead: any) => (
                <AccordionItem key={String(lead._id)} value={String(lead._id)}>
                  <AccordionTrigger className="text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-2">
                      <div className="text-sm">
                        <div className="font-medium">{lead.name} <span className="text-gray-500">• {lead.subject}</span></div>
                        <div className="text-xs text-gray-600 line-clamp-1">{lead.message}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Assigned</Badge>
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

                    <div className="grid md:grid-cols-3 gap-4 py-2">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Name {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.name || ""}
                            placeholder="Enter name"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, name: val, currentUserId: currentUser._id });
                                  toast.success("Name saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save name");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Subject {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.subject || ""}
                            placeholder="Enter subject"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, subject: val, currentUserId: currentUser._id });
                                  toast.success("Subject saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save subject");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Message {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.message || ""}
                            placeholder="Enter message"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, message: val, currentUserId: currentUser._id });
                                  toast.success("Message saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save message");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-5 gap-4 py-2">
                      <div className="md:col-span-2 space-y-1">
                        <div className="text-xs text-gray-500">Agency Name {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.agencyName || ""}
                            placeholder="Enter agency name"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, agencyName: val, currentUserId: currentUser._id });
                                  toast.success("Agency name saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save agency name");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Pincode {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.pincode || ""}
                            placeholder="Enter pincode"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, pincode: val, currentUserId: currentUser._id });
                                  toast.success("Pincode saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save pincode");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">State {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.state || ""}
                            placeholder="Enter state"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, state: val, currentUserId: currentUser._id });
                                  toast.success("State saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save state");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">District {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.district || ""}
                            placeholder="Enter district"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, district: val, currentUserId: currentUser._id });
                                  toast.success("District saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save district");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Station {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.station || ""}
                            placeholder="Enter station"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, station: val, currentUserId: currentUser._id });
                                  toast.success("Station saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save station");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Mobile No. {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.mobileNo || ""}
                            placeholder="Enter mobile"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, mobileNo: val, currentUserId: currentUser._id });
                                  toast.success("Mobile saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save mobile");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Alt Mobile No. {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.altMobileNo || ""}
                            placeholder="Enter alt mobile"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, altMobileNo: val, currentUserId: currentUser._id });
                                  toast.success("Alt mobile saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save alt mobile");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Email {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.email || ""}
                            placeholder="Enter email"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, email: val, currentUserId: currentUser._id });
                                  toast.success("Email saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save email");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Alt Email {currentUser.role === ROLES.MANAGER ? "(Manual Input)" : ""}</div>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={lead.altEmail || ""}
                            placeholder="Enter alt email"
                            onChange={(e) => ((e.currentTarget as any)._val = e.currentTarget.value)}
                            disabled={currentUser.role !== ROLES.MANAGER}
                          />
                          {currentUser.role === ROLES.MANAGER && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async (e) => {
                                const input = (e.currentTarget.previousElementSibling as any);
                                const val = input?._val ?? input?.value ?? "";
                                try {
                                  await updateLeadDetails({ leadId: lead._id, altEmail: val, currentUserId: currentUser._id });
                                  toast.success("Alt email saved");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to save alt email");
                                }
                              }}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mt-4">
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500">Relevant</div>
                        <Select
                          defaultValue={(lead.status || LEAD_STATUS.YET_TO_DECIDE) as string}
                          onValueChange={async (val) => {
                            try {
                              await updateLeadStatus({ leadId: lead._id, status: val as any, currentUserId: currentUser._id });
                              if (val === LEAD_STATUS.NOT_RELEVANT) {
                                toast.success("Lead deleted");
                              } else if (val === LEAD_STATUS.RELEVANT) {
                                toast.success("Marked relevant (auto email to be added later)");
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
                            <SelectItem value={LEAD_STATUS.RELEVANT}>Relevant</SelectItem>
                            <SelectItem value={LEAD_STATUS.NOT_RELEVANT}>Not-Relevant</SelectItem>
                            <SelectItem value={LEAD_STATUS.YET_TO_DECIDE}>Yet-to-Decide</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

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
                        </div>
                      </div>

                      {currentUser.role !== ROLES.ADMIN && (
                        <div className="space-y-2">
                          <div className="text-xs text-gray-500">Assignment</div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await assignLead({
                                    leadId: lead._id,
                                    assignedTo: undefined as any,
                                    currentUserId: currentUser._id,
                                  });
                                  toast.success("Lead unassigned");
                                } catch (e: any) {
                                  toast.error(e?.message || "Failed to unassign");
                                }
                              }}
                            >
                              Unassign from me
                            </Button>
                          </div>
                        </div>
                      )}

                      <CommentsBox leadId={lead._id} currentUserId={currentUser._id} />
                    </div>

                    <div className="mt-4">
                      <SendSmsButtons
                        primary={lead.mobileNo}
                        secondary={lead.altMobileNo}
                        contactPhoneLabel={"+91-7416229015"} // Provided later in SMS body (placeholder phone to be replaced as needed)
                      />
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

function SendSmsButtons({ primary, secondary, contactPhoneLabel }: { primary: string; secondary?: string | null; contactPhoneLabel: string; }) {
  // Use Convex action to send SMS via backend with SMS_API_KEY
  const sendSms = useAction(api.sms.send);
  const [sending, setSending] = useState(false);

  const buildMessage = () => {
    // Exact message as per provided link
    return "Tetra Pack ORS, Inhalers, Derma, Gynae, Pedia 1500+ Product's Pharma Franchise Mfg by Akums, Synokem, Windlas https://cafoli.in Contact 9518447302";
  };

  const handleSend = async (phone: string, label: string) => {
    const msg = buildMessage();
    try {
      setSending(true);
      const res: any = await sendSms({ to: phone, message: msg });
      const snippet = String(res?.response ?? "").slice(0, 140);
      toast.success(`SMS sent to ${label}. Provider response: ${snippet || "OK"}`);
    } catch (e: any) {
      toast.error(e?.message || `Failed to send SMS to ${label}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        disabled={sending}
        onClick={async () => {
          await handleSend(primary, "primary");
        }}
      >
        {sending ? "Sending..." : "Send SMS (Primary)"}
      </Button>
      {secondary && (
        <Button
          variant="outline"
          disabled={sending}
          onClick={async () => {
            await handleSend(secondary, "alternate");
          }}
        >
          {sending ? "Sending..." : "Send SMS (Alt.)"}
        </Button>
      )}
    </div>
  );
}