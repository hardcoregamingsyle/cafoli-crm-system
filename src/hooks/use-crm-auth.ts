import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";

// Helper function to validate user ID format
const isValidUserId = (id: any): boolean => {
  return typeof id === 'string' && id.length >= 10 && !id.includes('undefined') && !id.includes('null');
};

// Initialize currentUser from localStorage to prevent redirect loops
export function useCrmAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem("crmUser");
      if (!stored) return null;
      const user = JSON.parse(stored);
      
      // Validate that the user ID exists and looks valid (basic check)
      if (!isValidUserId(user?._id)) {
        // Invalid user ID format, clear storage
        localStorage.removeItem("crmUser");
        localStorage.removeItem("originalAdmin");
        return null;
      }
      
      return user;
    } catch {
      localStorage.removeItem("crmUser");
      localStorage.removeItem("originalAdmin");
      return null;
    }
  });
  
  // Track if admin is impersonating another user
  const [originalAdmin, setOriginalAdmin] = useState<any>(() => {
    try {
      const stored = localStorage.getItem("originalAdmin");
      if (!stored) return null;
      const admin = JSON.parse(stored);
      
      // Validate admin ID as well
      if (!isValidUserId(admin?._id)) {
        localStorage.removeItem("originalAdmin");
        return null;
      }
      
      return admin;
    } catch {
      return null;
    }
  });
  
  const loginMutation = useMutation((api as any).users.loginWithCredentials);
  
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const user = await loginMutation({ username, password });
      
      // Validate the returned user ID before storing
      if (!isValidUserId(user?._id)) {
        throw new Error("Invalid user ID returned from server");
      }
      
      setCurrentUser(user);
      localStorage.setItem("crmUser", JSON.stringify(user));
      return user;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  const logout = () => {
    setCurrentUser(null);
    setOriginalAdmin(null);
    localStorage.removeItem("crmUser");
    localStorage.removeItem("originalAdmin");
    // Redirect to login page
    window.location.href = "/";
  };
  
  const initializeAuth = () => {
    // Still keep this for idempotency; now it's already initialized at hook creation
    const stored = localStorage.getItem("crmUser");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        // Basic validation only
        if (!isValidUserId(user?._id)) {
          logout();
          return;
        }
        setCurrentUser(user);
      } catch {
        logout();
      }
    }
    const adminStored = localStorage.getItem("originalAdmin");
    if (adminStored) {
      try {
        const admin = JSON.parse(adminStored);
        if (!isValidUserId(admin?._id)) {
          localStorage.removeItem("originalAdmin");
          setOriginalAdmin(null);
          return;
        }
        setOriginalAdmin(admin);
      } catch {
        localStorage.removeItem("originalAdmin");
        setOriginalAdmin(null);
      }
    }
  };
  
  const impersonateUser = (targetUser: any, adminUser: any) => {
    // Validate both user IDs before impersonation
    if (!isValidUserId(targetUser?._id) || !isValidUserId(adminUser?._id)) {
      throw new Error("Invalid user IDs for impersonation");
    }
    
    // Store original admin
    setOriginalAdmin(adminUser);
    localStorage.setItem("originalAdmin", JSON.stringify(adminUser));
    
    // Switch to target user
    setCurrentUser(targetUser);
    localStorage.setItem("crmUser", JSON.stringify(targetUser));
  };
  
  const returnToAdmin = () => {
    if (originalAdmin && isValidUserId(originalAdmin._id)) {
      setCurrentUser(originalAdmin);
      localStorage.setItem("crmUser", JSON.stringify(originalAdmin));
      setOriginalAdmin(null);
      localStorage.removeItem("originalAdmin");
    }
  };
  
  return {
    currentUser,
    isLoading,
    login,
    logout,
    initializeAuth,
    originalAdmin,
    impersonateUser,
    returnToAdmin,
  };
}