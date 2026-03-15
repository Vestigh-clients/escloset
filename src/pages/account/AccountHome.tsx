import { Link } from "react-router-dom";
import SignOutConfirmModal from "@/components/auth/SignOutConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import { useSignOutWithCartWarning } from "@/hooks/useSignOutWithCartWarning";

const AccountHome = () => {
  const { user } = useAuth();
  const { isConfirmOpen, isSubmitting, requestSignOut, confirmSignOut, cancelSignOut } = useSignOutWithCartWarning();

  const displayName =
    user?.user_metadata?.first_name && user?.user_metadata?.last_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
      : user?.email ?? "My Account";

  return (
    <div className="bg-[#F5F0E8] px-6 py-[80px] sm:px-6">
      <div className="mx-auto max-w-[720px]">
        <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Account</p>
        <h1 className="mt-3 font-display text-[40px] italic font-light leading-none text-[#1A1A1A] sm:text-[52px]">
          {displayName}
        </h1>
        <p className="mt-4 font-body text-[13px] font-light leading-[1.8] text-[#555555]">
          Manage your profile and orders from here.
        </p>

        <div className="mt-10 grid gap-3 sm:max-w-[340px]">
          <Link
            to="/account/orders"
            className="rounded-[2px] border border-[#d4ccc2] px-5 py-[14px] font-body text-[11px] uppercase tracking-[0.14em] text-[#1A1A1A] transition-colors hover:border-[#1A1A1A]"
          >
            My Orders
          </Link>

          <button
            type="button"
            onClick={requestSignOut}
            className="rounded-[2px] bg-[#1A1A1A] px-5 py-[14px] text-left font-body text-[11px] uppercase tracking-[0.14em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A]"
          >
            Sign Out
          </button>
        </div>
      </div>

      <SignOutConfirmModal
        isOpen={isConfirmOpen}
        isSubmitting={isSubmitting}
        onConfirm={confirmSignOut}
        onCancel={cancelSignOut}
      />
    </div>
  );
};

export default AccountHome;


