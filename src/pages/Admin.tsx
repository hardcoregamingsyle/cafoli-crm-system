import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ROLES, Role } from "@/convex/schema";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KeyRound, LogIn } from "lucide-react";

export default function AdminPage() {
  const { currentUser, initializeAuth, impersonateUser } = useCrmAuth();
  const navigate = useNavigate();

  useEffect(() => {
    initializeAuth();
  }, []); // run once to avoid re-run loops

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!currentUser) {
      navigate("/");
      return;
    }
  }, [currentUser, navigate]);

  const users = useQuery(api.users.getAllUsers, { currentUserId: currentUser?._id }) ?? [];
  const createUser = useMutation(api.users.createUser);
  const updateUserRole = useMutation(api.users.updateUserRole);
  const deleteUser = useMutation(api.users.deleteUser);
  const sendNotification = useMutation(api.notifications.sendNotification);
  const initializeDefaultUsers = useMutation(api.users.initializeDefaultUsers);
  const deleteAllUsersMutation = useMutation(api.users.deleteAllUsers);
  const deleteAllLeadsMutation = useMutation(api.leads.deleteAllLeads);
  const adminChangePassword = useMutation(api.users.adminChangeUserPassword);
  const loginAsUserMutation = useMutation(api.users.loginAsUser);

  const [adminPasswordDialogOpen, setAdminPasswordDialogOpen] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<any>(null);
  const [adminNewPassword, setAdminNewPassword] = useState("");

  // Email key manager hooks
  const emailKeys = useQuery(
    api.emailKeys.listEmailApiKeys,
    currentUser?._id && currentUser.role === ROLES.ADMIN
      ? { currentUserId: currentUser._id }
      : "skip"
  ) ?? [];
  const saveEmailKey = useMutation(api.emailKeys.saveEmailApiKey);
  const toggleEmailKey = useMutation(api.emailKeys.setEmailKeyActive);
  const resetEmailKey = useMutation(api.emailKeys.resetEmailKeyCount);
  const deleteEmailKey = useMutation(api.emailKeys.deleteEmailKey);

  if (!currentUser) return <Layout><div /></Layout>;
  if (currentUser.role !== ROLES.ADMIN) {
    return <Layout><div className="max-w-4xl mx-auto"><Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent>Only admins can access this page.</CardContent></Card></div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const ok = window.confirm(
                    "Are you sure you want to delete ALL leads? This action cannot be undone."
                  );
                  if (!ok) return;
                  await deleteAllLeadsMutation({ currentUserId: currentUser._id });
                  toast.success("All leads have been deleted");
                } catch (e: any) {
                  toast.error(e?.message || "Failed to delete all leads");
                }
              }}
            >
              Delete All Leads
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  const ok = window.confirm(
                    "Are you sure you want to delete ALL user accounts? This action cannot be undone."
                  );
                  if (!ok) return;
                  await deleteAllUsersMutation({ currentUserId: currentUser._id });
                  toast.success("All user accounts have been deleted");
                } catch (e: any) {
                  toast.error(e?.message || "Failed to delete all accounts");
                }
              }}
            >
              Delete All Accounts
            </Button>
          </div>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
          <CardHeader><CardTitle>Create User</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-5 gap-2">
            <CreateUserForm onCreate={async (data) => {
              try {
                await createUser({
                  ...data,
                  createdByUserId: currentUser._id,
                });
                toast.success("User created");
              } catch (e: any) {
                toast.error(e.message || "Failed to create");
              }
            }} />
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
          <CardHeader><CardTitle>Email API Keys (Brevo)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <EmailKeyForm
              onSave={async (data) => {
                try {
                  await saveEmailKey({
                    currentUserId: currentUser._id,
                    name: data.name.trim(),
                    apiKey: data.apiKey.trim(),
                    dailyLimit: data.dailyLimit || 295,
                    active: data.active,
                  });
                  toast.success("Key saved");
                } catch (e: any) {
                  toast.error(e?.message || "Failed to save key");
                }
              }}
            />

            <div className="space-y-2">
              {(emailKeys ?? []).length === 0 ? (
                <div className="text-sm text-gray-600">No keys yet. Add one above.</div>
              ) : (
                (emailKeys ?? []).map((k: any) => (
                  <EmailKeyRow
                    key={String(k._id)}
                    k={k}
                    currentUserId={currentUser._id}
                    onToggle={async () => {
                      try {
                        await toggleEmailKey({ currentUserId: currentUser._id, id: k._id, active: !k.active });
                        toast.success(k.active ? "Deactivated" : "Activated");
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to toggle");
                      }
                    }}
                    onReset={async () => {
                      try {
                        await resetEmailKey({ currentUserId: currentUser._id, id: k._id });
                        toast.success("Count reset");
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to reset");
                      }
                    }}
                    onDelete={async () => {
                      const ok = window.confirm(`Delete key "${k.name}"?`);
                      if (!ok) return;
                      try {
                        await deleteEmailKey({ currentUserId: currentUser._id, id: k._id });
                        toast.success("Key deleted");
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to delete");
                      }
                    }}
                    onEditSave={async (updates) => {
                      try {
                        const limitNum = Number(updates.dailyLimit);
                        const parsedLimit = Number.isFinite(limitNum) && limitNum > 0 ? Math.floor(limitNum) : 295;
                        // Save via upsert: same name, updated apiKey/dailyLimit, preserve active as-is
                        await saveEmailKey({
                          currentUserId: currentUser._id,
                          name: k.name,
                          apiKey: updates.apiKey.trim(),
                          dailyLimit: parsedLimit,
                          active: k.active,
                        });
                        toast.success("Key updated");
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to update key");
                      }
                    }}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
          <CardHeader><CardTitle>Users</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {users.length === 0 && (
              <div className="flex items-center justify-between border p-3 rounded-md">
                <div className="text-sm text-gray-600">
                  No users found. You can create users above or seed default users.
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await initializeDefaultUsers({});
                      toast.success("Default users created");
                    } catch (e: any) {
                      toast.error(e.message || "Failed to seed default users");
                    }
                  }}
                >
                  Seed Default Users
                </Button>
              </div>
            )}

            {(users ?? []).map((u: any) => (
              <div key={String(u._id)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border p-3 rounded-md">
                <div className="text-sm">
                  <div className="font-medium">{u.name || u.username}</div>
                  <div className="text-xs text-gray-500">{u.email || "-"}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    defaultValue={u.role || ROLES.STAFF}
                    onValueChange={async (val) => {
                      try {
                        await updateUserRole({ 
                          userId: u._id, 
                          role: val as any,
                          currentUserId: currentUser._id,
                        });
                        toast.success("Role updated");
                      } catch (e: any) {
                        toast.error(e.message || "Failed to update role");
                      }
                    }}
                  >
                    <SelectTrigger className="w-40"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
                      <SelectItem value={ROLES.MANAGER}>Manager</SelectItem>
                      <SelectItem value={ROLES.STAFF}>Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedUserForPassword(u);
                      setAdminPasswordDialogOpen(true);
                    }}
                  >
                    <KeyRound className="w-4 h-4 mr-1" />
                    Change Password
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const confirm = window.confirm(`Login as ${u.name || u.username}?`);
                      if (!confirm) return;
                      try {
                        const targetUser = await loginAsUserMutation({
                          currentUserId: currentUser._id,
                          targetUserId: u._id,
                        });
                        impersonateUser(targetUser, currentUser);
                        toast.success(`Logged in as ${targetUser.name}`);
                        navigate("/dashboard");
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to login as user");
                      }
                    }}
                  >
                    <LogIn className="w-4 h-4 mr-1" />
                    Login As
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      try {
                        await deleteUser({ 
                          userId: u._id,
                          currentUserId: currentUser._id,
                        });
                        toast.success("User deleted");
                      } catch (e: any) {
                        toast.error(e.message || "Failed to delete");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
                <SendNotification userId={String(u._id)} onSend={async (message) => {
                  try {
                    await sendNotification({ userId: u._id, message, currentUserId: currentUser._id });
                    toast.success("Notification sent");
                  } catch (e: any) {
                    toast.error(e.message || "Failed to send");
                  }
                }} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={adminPasswordDialogOpen} onOpenChange={setAdminPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password for {selectedUserForPassword?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="New Password"
              value={adminNewPassword}
              onChange={(e) => setAdminNewPassword(e.target.value)}
            />
            <p className="text-sm text-gray-600">
              As admin, you can change this user's password without knowing their current password.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAdminPasswordDialogOpen(false);
              setAdminNewPassword("");
              setSelectedUserForPassword(null);
            }}>
              Cancel
            </Button>
            <Button onClick={async () => {
              try {
                if (!adminNewPassword || adminNewPassword.length < 6) {
                  toast.error("Password must be at least 6 characters");
                  return;
                }
                await adminChangePassword({
                  currentUserId: currentUser._id,
                  targetUserId: selectedUserForPassword._id,
                  newPassword: adminNewPassword,
                });
                toast.success("Password changed successfully");
                setAdminPasswordDialogOpen(false);
                setAdminNewPassword("");
                setSelectedUserForPassword(null);
              } catch (e: any) {
                toast.error(e?.message || "Failed to change password");
              }
            }}>
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function CreateUserForm({ onCreate }: { onCreate: (data: { name: string; username: string; password: string; role: Role; email?: string; }) => Promise<void>; }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(ROLES.STAFF);
  const [email, setEmail] = useState("");

  return (
    <>
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ROLES.MANAGER}>Manager</SelectItem>
          <SelectItem value={ROLES.STAFF}>Staff</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button
          onClick={async () => {
            if (!name || !username || !password) {
              toast.error("Fill required fields");
              return;
            }
            try {
              await onCreate({ name, username, password, role, email: email || undefined });
              setName(""); setUsername(""); setPassword(""); setRole(ROLES.STAFF); setEmail("");
            } catch (e: any) {
              const raw = e?.message ?? "";
              const msg = typeof raw === "string" && raw.toLowerCase().includes("username already exists")
                ? "Username already exists"
                : "Failed to create user";
              toast.error(msg);
            }
          }}
        >
          Create
        </Button>
      </div>
    </>
  );
}

function SendNotification({ userId, onSend }: { userId: string; onSend: (message: string) => Promise<void>; }) {
  const [message, setMessage] = useState("");
  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <Input
        placeholder="Admin message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button
        variant="outline"
        onClick={async () => {
          if (!message.trim()) return;
          await onSend(message);
          setMessage("");
        }}
      >
        Send
      </Button>
    </div>
  );
}

function EmailKeyForm({
  onSave,
}: {
  onSave: (data: { name: string; apiKey: string; dailyLimit?: number; active: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [dailyLimit, setDailyLimit] = useState<string>("295");
  const [active, setActive] = useState(true);

  return (
    <div className="grid md:grid-cols-5 gap-2">
      <Input placeholder="Name (e.g., brevo_1)" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      <Input
        placeholder="Daily Limit"
        value={dailyLimit}
        onChange={(e) => setDailyLimit(e.target.value)}
        type="number"
        min={1}
      />
      <Select value={active ? "true" : "false"} onValueChange={(v) => setActive(v === "true")}>
        <SelectTrigger><SelectValue placeholder="Active?" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Active</SelectItem>
          <SelectItem value="false">Inactive</SelectItem>
        </SelectContent>
      </Select>
      <Button
        onClick={async () => {
          if (!name.trim() || !apiKey.trim()) {
            toast.error("Name and API key are required");
            return;
          }
          const limitNum = Number(dailyLimit);
          const parsedLimit = Number.isFinite(limitNum) && limitNum > 0 ? Math.floor(limitNum) : 295;
          try {
            await onSave({ name, apiKey, dailyLimit: parsedLimit, active });
            setName("");
            setApiKey("");
            setDailyLimit("295");
            setActive(true);
          } catch (e: any) {
            toast.error(e?.message || "Failed to save");
          }
        }}
      >
        Save Key
      </Button>
    </div>
  );
}

function EmailKeyRow({
  k,
  currentUserId,
  onToggle,
  onReset,
  onDelete,
  onEditSave,
}: {
  k: any;
  currentUserId: string;
  onToggle: () => Promise<void>;
  onReset: () => Promise<void>;
  onDelete: () => Promise<void>;
  onEditSave: (updates: { apiKey: string; dailyLimit: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState<string>(k.apiKey || "");
  const [dailyLimit, setDailyLimit] = useState<string>(String(k.dailyLimit ?? 295));
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-col gap-2 border p-3 rounded-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="text-sm">
          <div className="font-medium">{k.name}</div>
          <div className="text-xs text-gray-500">
            Daily: {k.dailyLimit ?? 295} • Sent today: {k.sentToday ?? 0} • Active: {k.active ? "Yes" : "No"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onToggle}>
            {k.active ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="outline" onClick={onReset}>
            Reset Count
          </Button>
          <Button variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      {editing && (
        <div className="grid md:grid-cols-3 gap-2 pt-2">
          <Input
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Input
            placeholder="Daily Limit"
            type="number"
            min={1}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
          />
          <Button
            disabled={saving}
            onClick={async () => {
              if (!apiKey.trim()) {
                toast.error("API key is required");
                return;
              }
              setSaving(true);
              try {
                await onEditSave({ apiKey, dailyLimit });
                setEditing(false);
              } catch {
                // toast handled upstream
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}