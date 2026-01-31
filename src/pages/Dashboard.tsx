import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Vicovibe Coder
        </h1>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => navigate("/login")}>
            Logout
          </Button>
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Projects</h2>
          <Button className="w-full mb-4">+ New Project</Button>
          <div className="space-y-2">
            <p className="text-gray-400 text-sm">No projects yet.</p>
          </div>
        </div>

        <div className="col-span-2 bg-gray-800 rounded-xl p-6 border border-gray-700 min-h-[500px] flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Editor / Chat</h2>
          <div className="flex-1 bg-gray-900 rounded-lg border border-gray-700 p-4 flex items-center justify-center text-gray-500">
            Select a project to start coding with Gemini
          </div>
        </div>
      </main>
    </div>
  );
}