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
    <div className="bg-[var(--color-secondary)] px-6 py-[80px] sm:px-6">
      <div className="mx-auto max-w-[720px]">
        <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Account</p>
        <h1 className="mt-3 font-display text-[40px] italic font-light leading-none text-[var(--color-primary)] sm:text-[52px]">
          {displayName}
        </h1>
        <p className="mt-4 font-body text-[13px] font-light leading-[1.8] text-[var(--color-muted)]">
          Manage your profile and orders from here.
        </p>

        <div className="mt-10 grid gap-3 sm:max-w-[340px]">
          <Link
            to="/account/orders"
            className="rounded-[var(--border-radius)] border border-[var(--color-border)] px-5 py-[14px] font-body text-[11px] uppercase tracking-[0.14em] text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)]"
          >
            My Orders
          </Link>

          <button
            type="button"
            onClick={requestSignOut}
            className="rounded-[var(--border-radius)] bg-[var(--color-primary)] px-5 py-[14px] text-left font-body text-[11px] uppercase tracking-[0.14em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)]"
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



