import { useEffect, useMemo, useState } from "react";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type LoginLog = {
  _id: string;
  timestamp: number;
  username: string | null;
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  isp: string | null;
  userAgent: string | null;
  formatted: string | null;
};

export default function IpLogsPage() {
  const { currentUser, initializeAuth } = useCrmAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(100);
  const [error, setError] = useState<string | null>(null);

  const webhookBase = import.meta.env.VITE_WEBHOOK_URL as string | undefined;
  const isWebhookConfigured = useMemo(
    () => !!webhookBase && webhookBase.startsWith("http"),
    [webhookBase]
  );

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== "admin") {
      toast.error("Admins only");
      navigate("/");
      return;
    }
    if (!isWebhookConfigured) return;

    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `${webhookBase}/api/iplogging?limit=${limit}`
        );
        const json = await res.json();
        if (!json?.ok) {
          throw new Error(json?.error || "Failed to fetch logs");
        }
        setLogs(json.logs ?? []);
      } catch (e: any) {
        setError(e?.message || "Failed to fetch logs");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [currentUser, isWebhookConfigured, webhookBase, navigate, limit]);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (currentUser.role !== "admin") {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Login IP Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isWebhookConfigured && (
            <div className="rounded-md bg-yellow-100 text-yellow-900 p-3 text-sm">
              VITE_WEBHOOK_URL is not configured. Set it to your Convex .site URL in the API Keys tab to enable fetching logs.
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={!isWebhookConfigured || loading}
              onClick={() => setLimit((prev) => Math.min(prev + 50, 500))}
            >
              Show more
            </Button>
            <Button
              variant="outline"
              disabled={!isWebhookConfigured || loading}
              onClick={() => setLimit(100)}
            >
              Reset
            </Button>
            <Button
              disabled={!isWebhookConfigured || loading}
              onClick={() => {
                // Trigger refetch by nudging limit
                setLimit((prev) => prev);
              }}
            >
              Refresh
            </Button>
            <span className="text-sm text-gray-500">Showing up to {limit} entries</span>
          </div>

          {loading && <div>Loading logs...</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="space-y-3">
            {logs.length === 0 && !loading ? (
              <div className="text-sm text-gray-500">No logs found.</div>
            ) : (
              logs.map((log) => (
                <Card key={String(log._id)}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold">User:</span>{" "}
                          {log.username || "-"}
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold">IP:</span>{" "}
                          {log.ip || "-"}
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold">Location:</span>{" "}
                          {[log.city, log.region, log.country].filter(Boolean).join(", ") || "-"}
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold">ISP:</span>{" "}
                          {log.isp || "-"}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          <span className="font-semibold">User-Agent:</span>{" "}
                          {log.userAgent || "-"}
                        </div>
                      </div>
                    </div>
                    {log.formatted && (
                      <pre className="mt-3 text-xs bg-gray-50 p-3 rounded-md overflow-auto whitespace-pre-wrap">
                        {log.formatted}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}