import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

export default function NotificationsPage() {
  const { currentUser, initializeAuth } = useCrmAuth();
  const navigate = useNavigate();

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      navigate("/");
    }
  }, [currentUser, navigate]);

  const notifications = useQuery(api.notifications.getMyNotifications) ?? [];
  const markAsRead = useMutation(api.notifications.markAsRead);

  if (!currentUser) return <Layout><div /></Layout>;

  const unread = notifications.filter((n: any) => !n.read);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unread.length > 0 && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await Promise.all(
                    unread.map((n: any) => markAsRead({ notificationId: n._id as any }))
                  );
                  toast.success("Marked all as read");
                } catch (e: any) {
                  toast.error(e.message || "Failed to mark all");
                }
              }}
            >
              Mark All as Read
            </Button>
          )}
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
          <CardHeader>
            <CardTitle>Your Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.length === 0 && (
              <div className="text-sm text-gray-500">No notifications yet.</div>
            )}
            {notifications.map((n: any) => (
              <div
                key={String(n._id)}
                className="flex items-start justify-between border p-3 rounded-md"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{n.title}</span>
                    {!n.read && <Badge variant="destructive">New</Badge>}
                  </div>
                  <div className="text-sm text-gray-700">{n.message}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(n._creationTime).toLocaleString()}
                  </div>
                </div>
                {!n.read && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await markAsRead({ notificationId: n._id as any });
                      } catch (e: any) {
                        toast.error(e.message || "Failed to mark as read");
                      }
                    }}
                  >
                    Mark as Read
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
