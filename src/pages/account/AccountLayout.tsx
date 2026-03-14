import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useOutletContext } from "react-router-dom";
import SignOutConfirmModal from "@/components/auth/SignOutConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import { useSignOutWithCartWarning } from "@/hooks/useSignOutWithCartWarning";
import { fetchAccountCustomerProfile, type AccountCustomerProfile } from "@/services/accountService";

interface AccountLayoutContextValue {
  profile: AccountCustomerProfile | null;
  isProfileLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  firstName: string;
}

const accountNavLinks = [
  { label: "Overview", to: "/account" },
  { label: "My Orders", to: "/account/orders" },
  { label: "Addresses", to: "/account/addresses" },
  { label: "Personal Details", to: "/account/profile" },
  { label: "Change Password", to: "/account/password" },
];

const isOverviewPath = (pathname: string): boolean => pathname === "/account" || pathname === "/account/";

const isActiveRoute = (pathname: string, to: string): boolean => {
  if (to === "/account") {
    return isOverviewPath(pathname);
  }

  return pathname === to || pathname.startsWith(`${to}/`);
};

const readMetadataName = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const AccountLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { isConfirmOpen, isSubmitting, requestSignOut, confirmSignOut, cancelSignOut } = useSignOutWithCartWarning();

  const [profile, setProfile] = useState<AccountCustomerProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    setProfileError(null);

    try {
      const fetchedProfile = await fetchAccountCustomerProfile(user.id);
      setProfile(fetchedProfile);
    } catch {
      setProfile(null);
      setProfileError("We couldn't load your account details right now.");
    } finally {
      setIsProfileLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fallbackFirstName = readMetadataName(metadata.first_name) || readMetadataName(metadata.given_name) || "Customer";
  const fallbackLastName = readMetadataName(metadata.last_name) || readMetadataName(metadata.family_name);

  const firstName = profile?.first_name || fallbackFirstName;
  const lastName = profile?.last_name || fallbackLastName;
  const fullName = `${firstName} ${lastName}`.trim();
  const email = profile?.email || user?.email || "";
  const avatarInitial = (firstName?.trim()?.slice(0, 1) || email.slice(0, 1) || "U").toUpperCase();

  const contextValue = useMemo<AccountLayoutContextValue>(
    () => ({
      profile,
      isProfileLoading,
      profileError,
      refreshProfile: loadProfile,
      firstName,
    }),
    [profile, isProfileLoading, profileError, loadProfile, firstName],
  );

  return (
    <div className="bg-[#F5F0E8]">
      <div className="mx-auto w-full max-w-[1240px] lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="border-b border-[#d4ccc2] px-6 py-6 sm:px-8 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1A1A1A] font-body text-[18px] text-[#F5F0E8]">
              {avatarInitial}
            </div>
            <div>
              <p className="font-display text-[20px] italic text-[#1A1A1A]">{fullName || "My Account"}</p>
              <p className="font-body text-[11px] text-[#aaaaaa]">{email}</p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <nav className="flex min-w-max items-center gap-5 border-b border-[#d4ccc2] pb-2">
              {accountNavLinks.map((link) => {
                const isActive = isActiveRoute(location.pathname, link.to);

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`whitespace-nowrap border-b-2 pb-[6px] font-body text-[11px] uppercase tracking-[0.12em] transition-colors ${
                      isActive
                        ? "border-[#C4A882] text-[#1A1A1A]"
                        : "border-transparent text-[#888888] hover:text-[#1A1A1A]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={requestSignOut}
                className="whitespace-nowrap border-b-2 border-transparent pb-[6px] font-body text-[11px] uppercase tracking-[0.12em] text-[#aaaaaa] transition-colors hover:text-[#C0392B]"
              >
                Sign Out
              </button>
            </nav>
          </div>
        </div>

        <aside className="hidden border-r border-[#d4ccc2] px-8 py-[48px] lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1A1A1A] font-body text-[18px] text-[#F5F0E8]">
              {avatarInitial}
            </div>
            <div>
              <p className="font-display text-[20px] italic text-[#1A1A1A]">{fullName || "My Account"}</p>
              <p className="font-body text-[11px] text-[#aaaaaa]">{email}</p>
            </div>
          </div>

          <nav className="mt-10">
            {accountNavLinks.map((link) => {
              const isActive = isActiveRoute(location.pathname, link.to);

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`block border-l-2 py-[10px] pl-4 font-body text-[11px] uppercase tracking-[0.12em] transition-colors ${
                    isActive
                      ? "border-[#C4A882] text-[#1A1A1A]"
                      : "border-transparent text-[#888888] hover:text-[#1A1A1A]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={requestSignOut}
              className="mt-4 block w-full border-l-2 border-transparent py-[10px] pl-4 text-left font-body text-[11px] uppercase tracking-[0.12em] text-[#aaaaaa] transition-colors hover:text-[#C0392B]"
            >
              Sign Out
            </button>
          </nav>

          {isProfileLoading ? (
            <p className="mt-10 font-body text-[11px] uppercase tracking-[0.12em] text-[#aaaaaa]">Loading profile...</p>
          ) : null}
          {profileError ? <p className="mt-4 font-body text-[11px] text-[#C0392B]">{profileError}</p> : null}
        </aside>

        <section className="px-6 py-10 sm:px-8 lg:px-[60px] lg:py-[48px]">
          <Outlet context={contextValue} />
        </section>
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

export const useAccountLayoutContext = () => useOutletContext<AccountLayoutContextValue>();

export default AccountLayout;
