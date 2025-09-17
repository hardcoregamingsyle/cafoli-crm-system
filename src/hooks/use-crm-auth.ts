import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

// Initialize currentUser from localStorage to prevent redirect loops
export function useCrmAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem("crmUser");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  
  const loginMutation = useMutation(api.users.loginWithCredentials);
  
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const user = await loginMutation({ username, password });
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
    localStorage.removeItem("crmUser");
    // Redirect to login page
    window.location.href = "/";
  };
  
  const initializeAuth = () => {
    // Still keep this for idempotency; now it's already initialized at hook creation
    const stored = localStorage.getItem("crmUser");
    if (stored) {
      setCurrentUser(JSON.parse(stored));
    }
  };
  
  return {
    currentUser,
    isLoading,
    login,
    logout,
    initializeAuth,
  };
}