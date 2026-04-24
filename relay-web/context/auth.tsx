"use client";

// React Context is like a DI container — you wrap your app in a Provider at the top,
// and any component anywhere in the tree can call useAuth() to get the current user.
// No prop-drilling needed, just like injecting ICurrentUserService in .NET.

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AuthUser, clearToken, getStoredUser, saveToken, saveUser } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  setAuth: (user: AuthUser) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On first render, restore auth from localStorage (like reading a cookie on startup)
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
    setIsLoading(false);
  }, []);

  function setAuth(u: AuthUser) {
    saveToken(u.token);
    saveUser(u);
    setUser(u);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setAuth, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
