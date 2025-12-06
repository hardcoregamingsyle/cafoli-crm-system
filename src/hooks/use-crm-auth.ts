import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";

// Helper function to validate user ID format
const isValidUserId = (id: any): boolean => {
  return typeof id === 'string' && id.length >= 10 && !id.includes('undefined') && !id.includes('null');
};

// Helper function to safely parse and validate user from localStorage
const getSafeUserFromStorage = (key: string): any => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const user = JSON.parse(stored);
    
    // Validate that it's an object and has required properties
    if (!user || typeof user !== 'object' || Array.isArray(user)) {
      localStorage.removeItem(key);
      return null;
    }
    
    // Validate that the user ID exists and looks valid
    if (!isValidUserId(user?._id)) {
      localStorage.removeItem(key);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error(`Error parsing ${key} from localStorage:`, error);
    localStorage.removeItem(key);
    return null;
  }
};

// Initialize currentUser from localStorage to prevent redirect loops
export function useCrmAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(() => getSafeUserFromStorage("crmUser"));
  
  // Track if admin is impersonating another user
  const [originalAdmin, setOriginalAdmin] = useState<any>(() => getSafeUserFromStorage("originalAdmin"));
  
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
    const user = getSafeUserFromStorage("crmUser");
    if (user) {
      setCurrentUser(user);
    } else {
      setCurrentUser(null);
    }
    
    const admin = getSafeUserFromStorage("originalAdmin");
    if (admin) {
      setOriginalAdmin(admin);
    } else {
      setOriginalAdmin(null);
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