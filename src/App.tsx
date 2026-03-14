import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminRoute, ProtectedRoute } from "@/components/auth/RouteGuards";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/cart/CartDrawer";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import ProductPage from "./pages/ProductPage";
import CategoryPage from "./pages/CategoryPage";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Checkout from "./pages/Checkout";
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
import AdminCustomerPlaceholderPage from "./pages/admin/AdminCustomerPlaceholderPage";

const queryClient = new QueryClient();

const AppShell = () => {
  const location = useLocation();
  const isAuthRoute = location.pathname.startsWith("/auth/");
  const isAdminRoute = location.pathname.startsWith("/admin");
  const hideStoreChrome = isAuthRoute || isAdminRoute;

  return (
    <>
      {!hideStoreChrome ? <Navbar /> : null}
      <main className={hideStoreChrome ? "" : "min-h-screen"}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route
            path="/checkout/confirmation"
            element={
              <ProtectedRoute>
                <CheckoutConfirmation />
              </ProtectedRoute>
            }
          />
          <Route path="/orders/:orderNumber" element={<OrderTracking />} />
          <Route
            path="/checkout/*"
            element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            }
          />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />

          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/verify-email" element={<VerifyEmail />} />

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
            <Route path="customers/:id" element={<AdminCustomerPlaceholderPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!hideStoreChrome ? <Footer /> : null}
      {!hideStoreChrome ? <CartDrawer /> : null}
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
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
