import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ROLES } from "@/convex/schema";

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

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Webhook Logs</h1>
          <Button variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
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
