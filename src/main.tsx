import { Toaster } from "@/components/ui/sonner";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import "./index.css";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import Landing from "./pages/Landing.tsx";
import "./types/global.d.ts";
import AllLeadsPage from "@/pages/AllLeads.tsx";
import MyLeadsPage from "@/pages/MyLeads.tsx";
import AdminPage from "@/pages/Admin.tsx";
import CampaignsPage from "@/pages/Campaigns.tsx";
import CampaignSelectRecipientsPage from "@/pages/CampaignSelectRecipients.tsx";
import NotificationsPage from "@/pages/Notifications.tsx";
import WebhookLogsPage from "@/pages/WebhookLogs.tsx";
import IpLogsPage from "@/pages/IpLogs.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Migrate from "./pages/Migrate.tsx";
import ReportPage from "@/pages/Report.tsx";
import WhatsAppPage from "@/pages/WhatsApp.tsx";
import CreateTemplatePage from "@/pages/CreateTemplate.tsx";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

function ConvexProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VlyToolbar />
    <InstrumentationProvider>
      <BrowserRouter>
        <ConvexProviderWrapper>
          <RouteSyncer />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/assigned" element={<MyLeadsPage />} />
            <Route path="/dashboard/followup" element={<MyLeadsPage />} />
            <Route path="/dashboard/cold" element={<AllLeadsPage />} />
            <Route path="/dashboard/hot" element={<AllLeadsPage />} />
            <Route path="/dashboard/mature" element={<AllLeadsPage />} />
            <Route path="/all_leads" element={<AllLeadsPage />} />
            <Route path="/leads" element={<MyLeadsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/campaigns/select/:campaignId" element={<CampaignSelectRecipientsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/webhook/logs" element={<WebhookLogsPage />} />
            <Route path="/ip-logs" element={<IpLogsPage />} />
            <Route path="/migrate" element={<Migrate />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/whatsapp/create-template" element={<CreateTemplatePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ConvexProviderWrapper>
      </BrowserRouter>
      <Toaster />
    </InstrumentationProvider>
  </StrictMode>,
);