import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Users, 
  Database, 
  Mail, 
  MessageSquare, 
  Phone, 
  Shield, 
  Zap,
  FileText,
  Tag,
  Bell,
  BarChart,
  Workflow
} from "lucide-react";

export default function SpecsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Cafoli CRM
              </span>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="container mx-auto px-4 py-12"
      >
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Title Section */}
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              System Specifications
            </h1>
            <p className="text-lg text-gray-600">
              Complete overview of Cafoli CRM features, capabilities, and technical details
            </p>
          </div>

          {/* Core Features */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                Core Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FeatureItem
                icon={<Users className="w-5 h-5" />}
                title="Multi-Role User Management"
                description="Support for Admin, Manager, Staff, and User roles with granular permissions"
              />
              <FeatureItem
                icon={<Database className="w-5 h-5" />}
                title="Lead Management System"
                description="Comprehensive lead tracking with status, heat levels (Hot/Cold/Mature), assignment, and follow-up scheduling"
              />
              <FeatureItem
                icon={<Tag className="w-5 h-5" />}
                title="Lead Tagging & Comments"
                description="Organize leads with custom tags and maintain conversation history with comments"
              />
              <FeatureItem
                icon={<Bell className="w-5 h-5" />}
                title="Smart Notifications"
                description="Real-time follow-up reminders at 10, 5, and 1 minute intervals with audio alerts"
              />
              <FeatureItem
                icon={<Workflow className="w-5 h-5" />}
                title="Campaign Management"
                description="Visual workflow editor for creating multi-channel marketing campaigns"
              />
            </CardContent>
          </Card>

          {/* Communication Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                Multi-Channel Communication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FeatureItem
                icon={<MessageSquare className="w-5 h-5" />}
                title="WhatsApp Integration"
                description="Full WhatsApp Business API integration with template management, media support, and two-way messaging"
              />
              <FeatureItem
                icon={<Mail className="w-5 h-5" />}
                title="Email System"
                description="Brevo-powered email sending with queue management and API key rotation"
              />
              <FeatureItem
                icon={<Phone className="w-5 h-5" />}
                title="SMS & RCS Messaging"
                description="NimbusIT SMS API integration and RCS messaging support for rich communication"
              />
            </CardContent>
          </Card>

          {/* Lead Management Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-green-600" />
                Lead Management Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-4">
                <SpecItem label="Lead Status Types" value="Relevant, Not Relevant, Yet to Decide" />
                <SpecItem label="Heat Levels" value="Hot, Cold, Mature" />
                <SpecItem label="Batch Processing" value="Automated lead batching with configurable size" />
                <SpecItem label="Data Normalization" value="Phone number formatting, pincode auto-fill" />
                <SpecItem label="Deduplication" value="Automatic duplicate detection by email/phone" />
                <SpecItem label="Assignment System" value="Role-based lead assignment with tracking" />
                <SpecItem label="Follow-up Scheduling" value="Date/time picker with reminder notifications" />
                <SpecItem label="Activity Tracking" value="Complete audit trail of all lead interactions" />
              </div>
            </CardContent>
          </Card>

          {/* User Roles & Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                User Roles & Permissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RoleCard
                role="Admin"
                permissions={[
                  "Full system access",
                  "User management (create, edit, delete)",
                  "View and manage all leads",
                  "Assign leads to any user",
                  "Access to all reports and logs",
                  "Campaign management",
                  "System configuration"
                ]}
              />
              <RoleCard
                role="Manager"
                permissions={[
                  "View assigned leads",
                  "Edit lead details",
                  "Set follow-ups",
                  "Request new leads from masterdata",
                  "Send messages (WhatsApp, SMS, Email)",
                  "Create and manage campaigns",
                  "View personal reports"
                ]}
              />
              <RoleCard
                role="Staff"
                permissions={[
                  "View assigned leads",
                  "Edit lead details",
                  "Set follow-ups",
                  "Request new leads from masterdata",
                  "Send messages (WhatsApp, SMS, Email)",
                  "View personal reports"
                ]}
              />
            </CardContent>
          </Card>

          {/* Technical Stack */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600" />
                Technical Stack
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <TechItem category="Frontend" items={["React with TypeScript", "Vite", "React Router", "Tailwind CSS", "shadcn/ui", "Framer Motion"]} />
                <TechItem category="Backend" items={["Convex (serverless)", "Real-time database", "File storage", "Scheduled functions"]} />
                <TechItem category="Authentication" items={["Convex Auth", "Email OTP", "Role-based access control"]} />
                <TechItem category="Integrations" items={["WhatsApp Business API", "Brevo (Email)", "NimbusIT (SMS)", "RCS Messaging", "IP Geolocation (ipstack, apiip.net)"]} />
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="w-5 h-5 text-red-600" />
                Data Management & Reporting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FeatureItem
                icon={<FileText className="w-5 h-5" />}
                title="Masterdata Pool"
                description="Central repository for unassigned leads with request/approval workflow"
              />
              <FeatureItem
                icon={<BarChart className="w-5 h-5" />}
                title="Time-Series Reports"
                description="Comprehensive reporting with date range filtering and export capabilities"
              />
              <FeatureItem
                icon={<Shield className="w-5 h-5" />}
                title="Audit Logging"
                description="Complete audit trail of all user actions and system events"
              />
              <FeatureItem
                icon={<Database className="w-5 h-5" />}
                title="Webhook & IP Logging"
                description="Track all incoming webhooks and user IP addresses for security"
              />
            </CardContent>
          </Card>

          {/* Pages Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Available Pages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-3">
                <PageBadge name="Landing" path="/" />
                <PageBadge name="Login" path="/login" />
                <PageBadge name="Dashboard" path="/dashboard" />
                <PageBadge name="My Leads" path="/leads" />
                <PageBadge name="All Leads" path="/all_leads" />
                <PageBadge name="All Leads Admin" path="/all-leads-adv" />
                <PageBadge name="Admin Panel" path="/admin" />
                <PageBadge name="Campaigns" path="/campaigns" />
                <PageBadge name="WhatsApp" path="/whatsapp" />
                <PageBadge name="Notifications" path="/notifications" />
                <PageBadge name="Reports" path="/report" />
                <PageBadge name="Webhook Logs" path="/webhook/logs" />
                <PageBadge name="IP Logs" path="/ip-logs" />
                <PageBadge name="Compose Email" path="/compose-email" />
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

function RoleCard({ role, permissions }: { role: string; permissions: string[] }) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
        <Badge variant="secondary">{role}</Badge>
      </h3>
      <ul className="space-y-2">
        {permissions.map((permission, idx) => (
          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
            <span className="text-green-600 mt-0.5">✓</span>
            <span>{permission}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TechItem({ category, items }: { category: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-semibold text-gray-900 mb-2">{category}</h3>
      <ul className="space-y-1">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm text-gray-600 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PageBadge({ name, path }: { name: string; path: string }) {
  return (
    <Badge variant="outline" className="justify-start">
      <span className="font-medium">{name}</span>
      <span className="text-xs text-gray-500 ml-2">{path}</span>
    </Badge>
  );
}
