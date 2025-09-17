import { Toaster } from "@/components/ui/sonner";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
import Landing from "./pages/Landing.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import "./types/global.d.ts";
import AllLeadsPage from "@/pages/AllLeads.tsx";
import MyLeadsPage from "@/pages/MyLeads.tsx";
import AdminPage from "@/pages/Admin.tsx";
import NotificationsPage from "@/pages/Notifications.tsx";

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
        <RouteSyncer />
        <Routes>
          <Route path="/" element={<ConvexProviderWrapper><Login /></ConvexProviderWrapper>} />
          <Route path="/all_leads" element={<ConvexProviderWrapper><AllLeadsPage /></ConvexProviderWrapper>} />
          <Route path="/leads" element={<ConvexProviderWrapper><MyLeadsPage /></ConvexProviderWrapper>} />
          <Route path="/admin" element={<ConvexProviderWrapper><AdminPage /></ConvexProviderWrapper>} />
          <Route path="/notifications" element={<ConvexProviderWrapper><NotificationsPage /></ConvexProviderWrapper>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </InstrumentationProvider>
  </StrictMode>,
);