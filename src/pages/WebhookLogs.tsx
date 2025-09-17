import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useEffect } from "react";
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

  const logs = useQuery(api.audit.getWebhookLogs, { currentUserId: currentUser._id, limit: 200 }) ?? [];

  // Derive listening URL from env or current origin
  const base = (import.meta as any).env?.VITE_WEBHOOK_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const listeningUrl = `${base.replace(/\/+$/, "")}/api/webhook/indiamart`;

  // Mutations
  const importFromWebhookLogs = useMutation(api.webhook.importFromWebhookLogs);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Webhook Logs</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(listeningUrl);
                toast("Webhook URL copied");
              }}
            >
              Copy Webhook URL
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
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
                  window.location.reload();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to send test");
                }
              }}
            >
              Test Log
            </Button>
            <Button
              variant="default"
              onClick={async () => {
                try {
                  const res = await importFromWebhookLogs({ currentUserId: currentUser._id, limit: 500 });
                  toast.success(`Imported=${res.created}, Clubbed=${res.clubbed}, Skipped=${res.skipped}`);
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

        <div className="text-sm text-gray-600">
          Listening URL: <span className="font-mono break-all">{listeningUrl}</span>
        </div>

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