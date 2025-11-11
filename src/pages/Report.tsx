import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function ReportPage() {
  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Reports
          </h1>
          <p className="text-gray-600 mt-2">
            View and generate reports for your CRM data
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Report Dashboard</CardTitle>
            <CardDescription>
              Access various reports and analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Report functionality coming soon...
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </Layout>
  );
}
