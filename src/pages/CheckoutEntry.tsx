import { useEffect } from "react";
import { UserCheck, UserX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { REDIRECT_AFTER_LOGIN_KEY } from "@/services/authService";

const CHECKOUT_MODE_STORAGE_KEY = "luxuriant_checkout_mode";
const CHECKOUT_SESSION_STORAGE_KEY = "luxuriant_checkout_session_v1";
const CHECKOUT_CONTACT_PATH = "/checkout/contact";
const LOGIN_WITH_REDIRECT_PATH = `/auth/login?redirect=${encodeURIComponent(CHECKOUT_CONTACT_PATH)}`;

const CheckoutEntry = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(CHECKOUT_CONTACT_PATH, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleGuestCheckout = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(CHECKOUT_MODE_STORAGE_KEY, "guest");
      window.sessionStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY);
      window.sessionStorage.removeItem(CHECKOUT_SESSION_STORAGE_KEY);
    }

    navigate(CHECKOUT_CONTACT_PATH);
  };

  const handleSignIn = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(CHECKOUT_MODE_STORAGE_KEY);
      window.sessionStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, CHECKOUT_CONTACT_PATH);
    }

    navigate(LOGIN_WITH_REDIRECT_PATH);
  };

  return (
    <div className="bg-[#F5F0E8] px-6 py-[80px]">
      <div className="mx-auto max-w-[480px]">
        <h1 className="font-display text-[38px] italic leading-[1.1] text-[#1A1A1A]">
          How would you like to continue?
        </h1>
        <p className="mb-12 mt-2 font-body text-[12px] text-[#aaaaaa]">Choose an option to proceed to checkout</p>

        <button
          type="button"
          onClick={handleGuestCheckout}
          className="w-full cursor-pointer rounded-[2px] border border-[#d4ccc2] bg-transparent px-8 py-7 text-left transition-all duration-200 ease-in-out hover:border-[#1A1A1A]"
        >
          <div className="flex items-center justify-between">
            <UserX size={20} strokeWidth={1.3} className="text-[#1A1A1A]" />
            <span className="rounded-[2px] border border-[#d4ccc2] px-[10px] py-[3px] font-body text-[9px] uppercase tracking-[0.14em] text-[#888888]">
              Guest
            </span>
          </div>

          <p className="mt-3 font-display text-[22px] italic text-[#1A1A1A]">Continue as Guest</p>
          <p className="mt-1.5 max-w-[290px] font-body text-[12px] font-light leading-[1.7] text-[#888888]">
            No account needed. Enter your details at checkout.
          </p>
        </button>

        <div className="my-[4px] flex items-center gap-3">
          <span className="h-px flex-1 bg-[#d4ccc2]" />
          <span className="font-body text-[11px] text-[#aaaaaa]">or</span>
          <span className="h-px flex-1 bg-[#d4ccc2]" />
        </div>

        <button
          type="button"
          onClick={handleSignIn}
          className="w-full cursor-pointer rounded-[2px] border border-[#d4ccc2] bg-transparent px-8 py-7 text-left transition-all duration-200 ease-in-out hover:border-[#1A1A1A]"
        >
          <div className="flex items-center justify-between">
            <UserCheck size={20} strokeWidth={1.3} className="text-[#C4A882]" />
            <span className="rounded-[2px] border border-[#C4A882] px-[10px] py-[3px] font-body text-[9px] uppercase tracking-[0.14em] text-[#C4A882]">
              Recommended
            </span>
          </div>

          <p className="mt-3 font-display text-[22px] italic text-[#1A1A1A]">Sign In or Create Account</p>
          <p className="mt-1.5 max-w-[320px] font-body text-[12px] font-light leading-[1.7] text-[#888888]">
            Faster checkout with saved details, order history and address book.
          </p>
        </button>
      </div>
    </div>
  );
};

export default CheckoutEntry;
