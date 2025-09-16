import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

export function useCrmAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
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
  };
  
  const initializeAuth = () => {
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
