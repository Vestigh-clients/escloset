import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

interface UseSignOutWithCartWarningResult {
  isConfirmOpen: boolean;
  isSubmitting: boolean;
  requestSignOut: () => void;
  confirmSignOut: () => void;
  cancelSignOut: () => void;
}

export const useSignOutWithCartWarning = (): UseSignOutWithCartWarningResult => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { items, clearCart } = useCart();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const executeSignOut = async () => {
    setIsSubmitting(true);

    try {
      await logout();
      clearCart();
      navigate("/", { replace: true });
    } catch {
      toast("We couldn't sign you out right now. Please try again.", {
        className: "lux-cart-toast lux-cart-toast-error",
      });
    } finally {
      setIsSubmitting(false);
      setIsConfirmOpen(false);
    }
  };

  const requestSignOut = () => {
    if (items.length > 0) {
      setIsConfirmOpen(true);
      return;
    }

    void executeSignOut();
  };

  const confirmSignOut = () => {
    void executeSignOut();
  };

  const cancelSignOut = () => {
    if (isSubmitting) {
      return;
    }
    setIsConfirmOpen(false);
  };

  return {
    isConfirmOpen,
    isSubmitting,
    requestSignOut,
    confirmSignOut,
    cancelSignOut,
  };
};
