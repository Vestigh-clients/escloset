import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminRoute, ProtectedRoute, SuperAdminRoute } from "@/components/auth/RouteGuards";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/cart/CartDrawer";
import RouteExperienceManager from "@/components/navigation/RouteExperienceManager";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import ProductPage from "./pages/ProductPage";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Checkout from "./pages/Checkout";
import CheckoutEntry from "./pages/CheckoutEntry";
import CheckoutConfirmation from "./pages/CheckoutConfirmation";
import OrderTracking from "./pages/OrderTracking";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import VerifyEmail from "./pages/auth/VerifyEmail";
import AccountLayout from "./pages/account/AccountLayout";
import AccountOverview from "./pages/account/AccountOverview";
import AccountOrders from "./pages/account/AccountOrders";
import AccountAddresses from "./pages/account/AccountAddresses";
import AccountProfile from "./pages/account/AccountProfile";
import AccountPassword from "./pages/account/AccountPassword";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminOrderDetailPage from "./pages/admin/AdminOrderDetailPage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminProductEditorPage from "./pages/admin/AdminProductEditorPage";
import AdminCategoriesPage from "./pages/admin/AdminCategoriesPage";
import AdminInventoryPricingPage from "./pages/admin/AdminInventoryPricingPage";
import AdminCustomersPage from "./pages/admin/AdminCustomersPage";
import AdminCustomerDetailPage from "./pages/admin/AdminCustomerDetailPage";
import AdminDiscountCodesPage from "./pages/admin/AdminDiscountCodesPage";
import AdminProductReviewsPage from "./pages/admin/AdminProductReviewsPage";
import AdminShippingRatesPage from "./pages/admin/AdminShippingRatesPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";
import { StorefrontConfigProvider, useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { storeConfig } from "@/config/store.config";
import {
  AUTH_MODAL_EMAIL_QUERY_PARAM,
  AUTH_MODAL_QUERY_PARAM,
  AUTH_MODAL_REGISTERED_QUERY_PARAM,
  buildPathWithSearch,
  clearAuthModalSearch,
  isAuthModalMode,
} from "@/lib/authModal";

const queryClient = new QueryClient();

const AppShell = () => {
  const { storefrontConfig } = useStorefrontConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const authMode = useMemo(() => {
    const requestedMode = new URLSearchParams(location.search).get(AUTH_MODAL_QUERY_PARAM);
    return isAuthModalMode(requestedMode) ? requestedMode : null;
  }, [location.search]);
  const routeTransitionSearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    params.delete(AUTH_MODAL_QUERY_PARAM);
    params.delete(AUTH_MODAL_EMAIL_QUERY_PARAM);
    params.delete(AUTH_MODAL_REGISTERED_QUERY_PARAM);
    params.delete("redirect");
    return params.toString();
  }, [location.search]);
  const showNavbar = !isAdminRoute;
  const showFooter = !isAdminRoute;
  const showCartDrawer = !isAdminRoute;

  const closeAuthModal = useCallback(() => {
    const nextSearch = clearAuthModalSearch(location.search);
    navigate(buildPathWithSearch(location.pathname, nextSearch, location.hash), { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!authMode) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAuthModal();
      }
    };

    window.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [authMode, closeAuthModal]);

  useEffect(() => {
    document.title = storefrontConfig.storeName;

    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute("content", storefrontConfig.storeTagline || storefrontConfig.storeName);
    }

    const existingFavicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (existingFavicon) {
      existingFavicon.href = storefrontConfig.faviconUrl;
      return;
    }

    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.href = storefrontConfig.faviconUrl;
    document.head.appendChild(favicon);
  }, [location.pathname, storefrontConfig.faviconUrl, storefrontConfig.storeName, storefrontConfig.storeTagline]);

  return (
    <>
      <RouteExperienceManager />
      {showNavbar ? <Navbar /> : null}
      <main className={showFooter ? "min-h-screen" : ""}>
        <div key={`${location.pathname}?${routeTransitionSearch}`} className="lux-page-enter">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/shop/:slug" element={<ProductPage />} />
            <Route
              path="/checkout/confirmation"
              element={<CheckoutConfirmation />}
            />
            <Route path="/checkout" element={<CheckoutEntry />} />
            <Route
              path="/orders/:orderNumber"
              element={storeConfig.features.orderTracking ? <OrderTracking /> : <Navigate to="/" replace />}
            />
            <Route path="/checkout/*" element={<Checkout />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />

            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AccountLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AccountOverview />} />
              <Route path="orders" element={<AccountOrders />} />
              <Route path="addresses" element={<AccountAddresses />} />
              <Route path="profile" element={<AccountProfile />} />
              <Route path="password" element={<AccountPassword />} />
              <Route path="*" element={<Navigate to="/account" replace />} />
            </Route>

            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="orders/:orderNumber" element={<AdminOrderDetailPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="products/new" element={<AdminProductEditorPage />} />
              <Route path="products/:id/edit" element={<AdminProductEditorPage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="inventory-pricing" element={<AdminInventoryPricingPage />} />
              <Route path="customers" element={<AdminCustomersPage />} />
              <Route path="customers/:id" element={<AdminCustomerDetailPage />} />
              <Route path="discounts" element={<AdminDiscountCodesPage />} />
              <Route path="reviews" element={<AdminProductReviewsPage />} />
              <Route path="shipping" element={<AdminShippingRatesPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route
                path="users"
                element={
                  <SuperAdminRoute>
                    <AdminUsersPage />
                  </SuperAdminRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <SuperAdminRoute>
                    <AdminSettingsPage />
                  </SuperAdminRoute>
                }
              />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      {showFooter ? <Footer /> : null}
      {showCartDrawer ? <CartDrawer /> : null}
      {authMode ? (
        <div className="fixed inset-0 z-[2200] overflow-y-auto">
          <button
            type="button"
            onClick={closeAuthModal}
            className="fixed right-4 top-4 z-[2201] flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.85)] font-body text-xl leading-none text-[var(--color-secondary)] transition-opacity hover:opacity-80"
            aria-label="Close authentication modal"
          >
            &times;
          </button>

          {authMode === "login" ? <Login /> : null}
          {authMode === "register" ? <Register /> : null}
          {authMode === "forgot-password" ? <ForgotPassword /> : null}
          {authMode === "reset-password" ? <ResetPassword /> : null}
          {authMode === "verify-email" ? <VerifyEmail /> : null}
        </div>
      ) : null}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <CartProvider>
          <StorefrontConfigProvider>
            <ThemeProvider>
              <BrowserRouter>
                <AppShell />
              </BrowserRouter>
            </ThemeProvider>
          </StorefrontConfigProvider>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
