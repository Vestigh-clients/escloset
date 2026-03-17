import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { REDIRECT_AFTER_LOGIN_KEY } from "@/services/authService";

interface RouteGuardProps {
  children: ReactNode;
}

const GuardLoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-[var(--color-secondary)] px-6">
    <p className="font-body text-[12px] uppercase tracking-[0.14em] text-[var(--color-muted)]">Loading...</p>
  </div>
);

const storeIntendedPath = (path: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, path);
};

export const ProtectedRoute = ({ children }: RouteGuardProps) => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <GuardLoadingScreen />;
  }

  if (!isAuthenticated) {
    const intendedPath = `${location.pathname}${location.search}${location.hash}`;
    storeIntendedPath(intendedPath);
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
};

export const AdminRoute = ({ children }: RouteGuardProps) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <GuardLoadingScreen />;
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const SuperAdminRoute = ({ children }: RouteGuardProps) => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return <GuardLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (role !== "super_admin") {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};


