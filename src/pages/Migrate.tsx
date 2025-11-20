import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useCrmAuth } from "@/hooks/use-crm-auth";

export default function Migrate() {
  const { currentUser } = useCrmAuth();

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Only administrators can access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Database Migration</CardTitle>
          <CardDescription>
            Normalize all existing phone numbers to the new format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              This migration will normalize all phone numbers in the database to the new format:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remove all non-digit characters (spaces, dashes, parentheses, etc.)</li>
                <li>Preserve existing country codes for numbers with more than 10 digits</li>
                <li>Add default country code '91' for 10-digit numbers</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-lg">
            <p className="font-semibold mb-2">To run this migration:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Open your terminal</li>
              <li>Navigate to your project directory</li>
              <li>Run the following command:</li>
            </ol>
            <code className="block mt-3 p-3 bg-background rounded border">
              npx convex run migrate:normalizeAllPhoneNumbers
            </code>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">Important Notes:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>This operation will update all leads and WhatsApp messages</li>
              <li>The migration is safe and will only update numbers that need normalization</li>
              <li>Existing normalized numbers will not be changed</li>
              <li>This is a one-time operation and should be run after the code update</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}