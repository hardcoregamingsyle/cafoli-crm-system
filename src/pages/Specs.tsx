import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router";
import { 
  ArrowLeft, 
  Users, 
  MessageSquare, 
  Mail, 
  Phone, 
  Tag, 
  Bell, 
  BarChart3,
  Shield,
  Database,
  Workflow,
  Zap
} from "lucide-react";

export default function Specs() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50"
    >
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">C</span>
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Cafoli CRM
                </span>
              </div>
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
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            System Specifications
          </h1>
          <p className="text-gray-600 mb-8">
            Complete overview of Cafoli CRM features, capabilities, and technical details
          </p>
        </motion.div>

        <div className="space-y-6">
          {/* Core Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  Core Features
                </CardTitle>
                <CardDescription>Primary functionalities of the CRM system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <FeatureItem icon={<Users />} title="Multi-Role User Management" description="Supports Admin, Manager, Staff, and User roles with granular permissions" />
                <FeatureItem icon={<Database />} title="Lead Management System" description="Comprehensive tracking with status, heat levels (Hot/Cold/Mature), assignment, and follow-up scheduling" />
                <FeatureItem icon={<Tag />} title="Lead Tagging & Comments" description="Organize leads with custom tags and maintain conversation history" />
                <FeatureItem icon={<Bell />} title="Smart Notifications" description="Real-time follow-up reminders at 10, 5, and 1-minute intervals with audio alerts" />
                <FeatureItem icon={<Workflow />} title="Campaign Management" description="Visual workflow editor for creating multi-channel marketing campaigns" />
              </CardContent>
            </Card>
          </motion.div>

          {/* Multi-Channel Communication */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  Multi-Channel Communication
                </CardTitle>
                <CardDescription>Integrated communication channels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <FeatureItem icon={<MessageSquare />} title="WhatsApp Integration" description="Full WhatsApp Business API integration with template management, media support, and two-way messaging" />
                <FeatureItem icon={<Mail />} title="Email System" description="Brevo-powered email sending with queue management and API key rotation" />
                <FeatureItem icon={<Phone />} title="SMS & RCS Messaging" description="NimbusIT SMS API integration and RCS messaging support" />
              </CardContent>
            </Card>
          </motion.div>

          {/* Lead Management Capabilities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  Lead Management Capabilities
                </CardTitle>
                <CardDescription>Detailed lead handling features</CardDescription>
              </CardHeader>
              <CardContent>
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
          </motion.div>

          {/* User Roles & Permissions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  User Roles & Permissions
                </CardTitle>
                <CardDescription>Access control and role-based permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RoleCard 
                  role="Admin" 
                  permissions={[
                    "Full system access",
                    "User management",
                    "Lead management",
                    "Assignment",
                    "Reports",
                    "Campaign management",
                    "System configuration"
                  ]} 
                />
                <RoleCard 
                  role="Manager" 
                  permissions={[
                    "View assigned leads",
                    "Edit details",
                    "Set follow-ups",
                    "Request new leads",
                    "Send messages",
                    "Create/manage campaigns",
                    "View personal reports"
                  ]} 
                />
                <RoleCard 
                  role="Staff" 
                  permissions={[
                    "View assigned leads",
                    "Edit details",
                    "Set follow-ups",
                    "Request new leads",
                    "Send messages",
                    "View personal reports"
                  ]} 
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Technical Stack */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  Technical Stack
                </CardTitle>
                <CardDescription>Technologies powering the system</CardDescription>
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
          </motion.div>

          {/* Data Management & Reporting */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Data Management & Reporting
                </CardTitle>
                <CardDescription>Analytics and data handling capabilities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <FeatureItem icon={<Database />} title="Masterdata Pool" description="Central repository for unassigned leads with request/approval workflow" />
                <FeatureItem icon={<BarChart3 />} title="Time-Series Reports" description="Comprehensive reporting with date range filtering and export capabilities" />
                <FeatureItem icon={<Shield />} title="Audit Logging" description="Complete audit trail of all user actions and system events" />
                <FeatureItem icon={<Zap />} title="Webhook & IP Logging" description="Tracks incoming webhooks and user IP addresses for security" />
              </CardContent>
            </Card>
          </motion.div>

          {/* Available Pages */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Available Pages</CardTitle>
                <CardDescription>All accessible pages within the application</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <PageBadge name="Dashboard" path="/dashboard" />
                  <PageBadge name="My Leads" path="/leads" />
                  <PageBadge name="All Leads" path="/all_leads" />
                  <PageBadge name="All Leads Admin View" path="/all-leads-adv" />
                  <PageBadge name="Admin" path="/admin" />
                  <PageBadge name="Campaigns" path="/campaigns" />
                  <PageBadge name="WhatsApp" path="/whatsapp" />
                  <PageBadge name="Compose Email" path="/compose-email" />
                  <PageBadge name="Notifications" path="/notifications" />
                  <PageBadge name="Report" path="/report" />
                  <PageBadge name="Webhook Logs" path="/webhook/logs" />
                  <PageBadge name="IP Logs" path="/ip-logs" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
        {icon}
      </div>
      <div>
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-gray-900">{label}</dt>
      <dd className="text-sm text-gray-600 mt-1">{value}</dd>
    </div>
  );
}

function RoleCard({ role, permissions }: { role: string; permissions: string[] }) {
  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-semibold mb-2 flex items-center gap-2">
        <Badge variant="outline">{role}</Badge>
      </h4>
      <ul className="space-y-1">
        {permissions.map((permission, index) => (
          <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
            <span className="text-blue-600 mt-1">•</span>
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
      <h4 className="font-semibold mb-2">{category}</h4>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PageBadge({ name, path }: { name: string; path: string }) {
  return (
    <Badge variant="secondary" className="cursor-default">
      {name} <span className="text-xs text-muted-foreground ml-1">({path})</span>
    </Badge>
  );
}
