import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ROLES } from "@/convex/schema";
import { toast } from "sonner";

export default function WebhookLogsPage() {
  const { currentUser, initializeAuth } = useCrmAuth();
  const navigate = useNavigate();

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      navigate("/");
      return;
    }
  }, [currentUser, navigate]);

  if (!currentUser) return <Layout><div /></Layout>;
  if (currentUser.role !== ROLES.ADMIN) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
            <CardContent>Only admins can access webhook logs.</CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // moved: envWebhookBase/isWebhookUrlConfigured/listeningUrl are defined above
  const [logs, setLogs] = useState<any[]>([]);
  // NEW: capture last GET response output
  const [lastGetOutput, setLastGetOutput] = useState<string>("");

  // Add bulk import mutation
  const bulkCreateLeads = useMutation(api.leads.bulkCreateLeads);

  // Also fetch users so we can resolve assignees from Column J
  const users = useQuery(api.users.getAllUsers, { currentUserId: currentUser?._id as any }) ?? [];

  async function loadLogs() {
    if (!isWebhookUrlConfigured) return;
    try {
      const res = await fetch(
        `${envWebhookBase!.replace(/\/+$/, "")}/api/webhook/logs_list?limit=200`,
        { method: "GET" }
      );
      const json = await res.json();
      if (json?.ok && Array.isArray(json.logs)) {
        setLogs(json.logs);
      } else {
        setLogs([]);
      }
    } catch {
      setLogs([]);
    }
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use ONLY the explicit webhook URL; do not fallback to window.origin to avoid mismatched deployments
  const envWebhookBase = (import.meta as any).env?.VITE_WEBHOOK_URL as string | undefined;
  const isWebhookUrlConfigured = !!(envWebhookBase && envWebhookBase.trim().length > 0);
  const listeningUrl = "https://script.google.com/macros/s/AKfycbxKrR7SZjO_DhJwJhguvAmnejgddGydFEvJSdsnmV-hl1UQMINjWNQ-dxJRNT155m-H/exec";

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Webhook Logs</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!isWebhookUrlConfigured) return;
                navigator.clipboard.writeText(listeningUrl);
                toast("Webhook URL copied");
              }}
              disabled={!isWebhookUrlConfigured}
            >
              Copy Webhook URL
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!isWebhookUrlConfigured) {
                  toast.error("VITE_WEBHOOK_URL is not configured.");
                  return;
                }
                try {
                  // Hit the endpoint to produce a log entry
                  const url = new URL(listeningUrl);
                  url.searchParams.set("SENDER_NAME", "Test User");
                  url.searchParams.set("SUBJECT", "Test Subject");
                  url.searchParams.set("QUERY_MESSAGE", "Test message from Test Log button");
                  url.searchParams.set("SENDER_MOBILE", "9999999999");
                  url.searchParams.set("SENDER_EMAIL", "test@example.com");
                  url.searchParams.set("SENDER_STATE", "TestState");
                  const res = await fetch(url.toString(), { method: "GET" });
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  toast.success("Test webhook logged");
                  await loadLogs(); // refresh list without full reload
                } catch (e: any) {
                  toast.error(e?.message || "Failed to send test");
                }
              }}
              disabled={!isWebhookUrlConfigured}
            >
              Test Log
            </Button>
            {/* New: Send a raw GET to the webhook URL without params */}
            <Button
              variant="outline"
              onClick={async () => {
                if (!isWebhookUrlConfigured) {
                  toast.error("VITE_WEBHOOK_URL is not configured.");
                  return;
                }
                try {
                  const res = await fetch(listeningUrl, { method: "GET" });
                  const bodyText = await res.text().catch(() => "");
                  // Always show raw output for debugging
                  setLastGetOutput(`HTTP ${res.status} ${res.statusText}\n\n${bodyText}`);

                  if (!res.ok) {
                    throw new Error(`HTTP ${res.status} ${res.statusText}`);
                  }

                  // Try parsing and importing if JSON array
                  let parsed: any = null;
                  try {
                    parsed = JSON.parse(bodyText);
                  } catch {
                    parsed = null;
                  }

                  if (Array.isArray(parsed)) {
                    // Map Column A..Q -> lead fields + assigned-to (Column J)
                    const getUsersList = Array.isArray(users) ? users : [];
                    const findUserIdByName = (name: string): string | undefined => {
                      if (!name) return undefined;
                      const target = name.trim().toLowerCase();
                      const found = getUsersList.find((u: any) => {
                        const nm = String(u.name ?? "").trim().toLowerCase();
                        const un = String(u.username ?? "").trim().toLowerCase();
                        return nm === target || un === target;
                      });
                      return found?._id as string | undefined;
                    };

                    const rowsWithAssignee = parsed.map((row: any) => {
                      const get = (k: string) => (row && (row[k] ?? row[k.trim()])) ?? "";
                      const mobileRaw = String(get("Column F") ?? "").trim();
                      const mobile = mobileRaw.replace(/[^\d]/g, "");
                      const assignedName = String(get("Column J") ?? "").trim();
                      const assigneeId = findUserIdByName(assignedName);

                      const lead = {
                        name: String(get("Column C") ?? "").trim(),
                        subject: String(get("Column D") ?? "").trim(),
                        message: String(get("Column G") ?? "").trim(),
                        mobileNo: mobile, // required
                        email: String(get("Column E") ?? "").trim(),
                        altMobileNo: String(get("Column I") ?? "").trim() || undefined,
                        altEmail: String(get("Column H") ?? "").trim() || undefined,
                        state: String(get("Column M") ?? "").trim(),
                        source: String(get("Column B") ?? "").trim() || "webhook",
                        station: String(get("Column N") ?? "").trim() || undefined,
                        district: String(get("Column O") ?? "").trim() || undefined,
                        pincode: String(get("Column P") ?? "").trim() || undefined,
                        agencyName: String(get("Column Q") ?? "").trim() || undefined,
                        country: String(get("Column R") ?? "").trim() || undefined,
                      };

                      return { lead, assigneeId };
                    })
                    // only keep those with a mobile number
                    .filter((entry: any) => !!entry.lead.mobileNo);

                    if (rowsWithAssignee.length > 0) {
                      // Group by assigneeId: undefined -> unassigned
                      const groups = new Map<string | undefined, any[]>();
                      for (const entry of rowsWithAssignee) {
                        const key = entry.assigneeId || undefined;
                        if (!groups.has(key)) groups.set(key, []);
                        groups.get(key)!.push(entry.lead);
                      }

                      // Process unassigned first (key: undefined)
                      const unassignedLeads = groups.get(undefined) ?? [];
                      if (unassignedLeads.length > 0) {
                        await bulkCreateLeads({
                          leads: unassignedLeads,
                          currentUserId: currentUser?._id as any,
                        });
                      }

                      // Then process each assigned group
                      for (const [assigneeId, leadsArr] of groups.entries()) {
                        if (!assigneeId) continue;
                        await bulkCreateLeads({
                          leads: leadsArr,
                          assignedTo: assigneeId as any,
                          currentUserId: currentUser?._id as any,
                        });
                      }

                      const totalImported = rowsWithAssignee.length;
                      const assignedCount = [...groups.entries()].reduce((acc, [k, v]) => acc + (k ? v.length : 0), 0);
                      const unassignedCount = unassignedLeads.length;

                      toast.success(`Imported ${totalImported} lead(s) from GET response. Assigned=${assignedCount}, Unassigned=${unassignedCount}`);
                    } else {
                      toast("No valid rows with a mobile number to import.");
                    }
                  } else {
                    toast("GET succeeded but response is not a JSON array; showing raw output.");
                  }

                  await loadLogs();
                } catch (e: any) {
                  setLastGetOutput(`Error: ${e?.message || "Failed to send GET"}`);
                  toast.error(e?.message || "Failed to send GET");
                }
              }}
              disabled={!isWebhookUrlConfigured}
            >
              Send GET
            </Button>
            <Button
              variant="default"
              onClick={async () => {
                try {
                  if (!isWebhookUrlConfigured) {
                    toast.error("VITE_WEBHOOK_URL is not configured.");
                    return;
                  }
                  const res = await fetch(
                    `${envWebhookBase!.replace(/\/*$/, "")}/api/webhook/import_from_logs`,
                    { method: "POST" }
                  );
                  const json = await res.json();
                  if (!json?.ok) throw new Error(json?.error || "Failed");
                  toast.success(`Imported=${json.created}, Clubbed=${json.clubbed}, Skipped=${json.skipped}`);
                  await loadLogs();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to import from logs");
                }
              }}
            >
              Import All Queries
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
          </div>
        </div>

        {!isWebhookUrlConfigured && (
          <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md p-3">
            VITE_WEBHOOK_URL is not configured. Set it to your Convex deployment base URL (e.g. https://cautious-guanaco-541.convex.site) in the API Keys tab. The Test Log and Copy Webhook URL buttons are disabled until configured.
          </div>
        )}

        <div className="text-sm text-gray-600">
          Listening URL:{" "}
          <span className="font-mono break-all">
            {isWebhookUrlConfigured ? listeningUrl : "(not configured)"}
          </span>
        </div>

        {/* NEW: Show the last GET response, if any */}
        {lastGetOutput && (
          <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
            <CardHeader>
              <CardTitle>Last GET Response</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap break-words">{lastGetOutput}</pre>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
          <CardHeader>
            <CardTitle>Latest Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {logs.length === 0 && <div className="text-sm text-gray-500">No logs yet.</div>}
            {logs.map((log: any) => (
              <div key={String(log._id)} className="border rounded-md p-3 bg-white">
                <div className="text-xs text-gray-500 mb-1">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
                <div className="text-sm break-words whitespace-pre-wrap">
                  {log.details}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}