import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAdminNotifications,
  fetchAdminProfile,
  fetchAdminUnreadNotificationsCount,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  subscribeToAdminNotifications,
  type AdminNotification,
} from "@/services/adminService";
import { formatRelativeDate } from "@/lib/adminFormatting";

interface ToastItem {
  id: string;
  title: string;
  description: string | null;
}

interface AdminNavLink {
  label: string;
  to: string;
  minRole?: "admin" | "super_admin";
}

interface AdminNavGroup {
  label: string;
  links: AdminNavLink[];
}

const navGroups: AdminNavGroup[] = [
  {
    label: "Store",
    links: [
      { label: "Dashboard", to: "/admin" },
      { label: "Orders", to: "/admin/orders" },
      { label: "Products", to: "/admin/products" },
      { label: "Categories", to: "/admin/categories" },
    ],
  },
  {
    label: "Customers",
    links: [
      { label: "All Customers", to: "/admin/customers" },
      { label: "Discount Codes", to: "/admin/discounts" },
    ],
  },
  {
    label: "Settings",
    links: [
      { label: "Shipping Rates", to: "/admin/shipping" },
      { label: "Admin Users", to: "/admin/users", minRole: "super_admin" },
      { label: "Site Settings", to: "/admin/settings", minRole: "super_admin" },
    ],
  },
];

const canAccessNavLink = (link: AdminNavLink, role: "customer" | "admin" | "super_admin" | null): boolean => {
  if (link.minRole === "super_admin") {
    return role === "super_admin";
  }
  return true;
};

const readMetadataName = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const breadcrumbLabel = (segment: string) => {
  if (!segment) return "";
  if (/^LUX-\d{4}-\d+/i.test(segment)) return segment.toUpperCase();
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const notificationDestination = (notification: AdminNotification) => {
  if (notification.link && notification.link.trim()) {
    return notification.link;
  }
  return "/admin";
};

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();

  const [profileName, setProfileName] = useState<{ firstName: string; lastName: string } | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const desktopDropdownRef = useRef<HTMLDivElement | null>(null);
  const mobileDropdownRef = useRef<HTMLDivElement | null>(null);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    setIsDropdownOpen(false);
    document.body.style.overflow = "hidden";
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    document.body.style.overflow = "";
  }, []);

  useEffect(() => {
    const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const fallbackFirstName = readMetadataName(metadata.first_name) || readMetadataName(metadata.given_name) || "Admin";
    const fallbackLastName = readMetadataName(metadata.last_name) || readMetadataName(metadata.family_name);

    if (!user?.id) {
      setProfileName({
        firstName: fallbackFirstName,
        lastName: fallbackLastName,
      });
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      try {
        const profile = await fetchAdminProfile(user.id);
        if (!isMounted) return;

        if (profile) {
          setProfileName({
            firstName: profile.first_name || fallbackFirstName,
            lastName: profile.last_name || fallbackLastName,
          });
          return;
        }

        setProfileName({
          firstName: fallbackFirstName,
          lastName: fallbackLastName,
        });
      } catch {
        if (!isMounted) return;
        setProfileName({
          firstName: fallbackFirstName,
          lastName: fallbackLastName,
        });
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.user_metadata]);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const [list, unread] = await Promise.all([fetchAdminNotifications(35), fetchAdminUnreadNotificationsCount()]);
        if (!isMounted) return;
        setNotifications(list);
        setUnreadCount(unread);
      } catch {
        if (!isMounted) return;
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    void loadNotifications();

    const unsubscribe = subscribeToAdminNotifications((notification) => {
      setNotifications((current) => [notification, ...current].slice(0, 60));
      setUnreadCount((current) => current + (notification.is_read ? 0 : 1));

      const nextToast: ToastItem = {
        id: notification.id,
        title: notification.title,
        description: notification.description,
      };
      setToasts((current) => [...current, nextToast]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== notification.id));
      }, 4000);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedDesktopDropdown = desktopDropdownRef.current?.contains(target) ?? false;
      const clickedMobileDropdown = mobileDropdownRef.current?.contains(target) ?? false;

      if (!clickedDesktopDropdown && !clickedMobileDropdown) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", onClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    closeDrawer();
    setIsDropdownOpen(false);
  }, [closeDrawer, location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const breadcrumb = useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean).slice(1);
    return ["Admin", ...segments.map((segment) => breadcrumbLabel(decodeURIComponent(segment)))];
  }, [location.pathname]);

  const firstName = profileName?.firstName || "Admin";
  const lastInitial = (profileName?.lastName?.slice(0, 1) || "").toUpperCase();
  const adminName = `${firstName}${lastInitial ? ` ${lastInitial}.` : ""}`;
  const roleLabel = role ? role.replace("_", " ").toUpperCase() : "ADMIN";
  const avatarInitial = (firstName.slice(0, 1) || user?.email?.slice(0, 1) || "A").toUpperCase();
  const visibleNavGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          links: group.links.filter((link) => canAccessNavLink(link, role)),
        }))
        .filter((group) => group.links.length > 0),
    [role],
  );
  const compactNavLinks = useMemo(() => visibleNavGroups.flatMap((group) => group.links), [visibleNavGroups]);

  const onNotificationClick = async (notification: AdminNotification) => {
    setIsDropdownOpen(false);

    if (!notification.is_read) {
      try {
        await markAdminNotificationRead(notification.id);
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        // No-op
      }
    }

    navigate(notificationDestination(notification));
  };

  const onMarkAllRead = async () => {
    try {
      await markAllAdminNotificationsRead();
      setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
      setUnreadCount(0);
    } catch {
      // No-op
    }
  };

  const onSignOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div
      className="admin-layout-root min-h-screen bg-[#F5F0E8]"
      style={{
        overflowX: "hidden",
        maxWidth: "100vw",
      }}
    >
      <div className="fixed inset-x-0 top-0 z-[100] flex h-14 items-center justify-between bg-[#1A1A1A] px-5 md:hidden">
        <button
          type="button"
          onClick={openDrawer}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center"
        >
          <span className="flex flex-col gap-[5px]">
            <span className="block h-px w-[22px] bg-[#F5F0E8]" />
            <span className="block h-px w-[22px] bg-[#F5F0E8]" />
            <span className="block h-px w-[22px] bg-[#F5F0E8]" />
          </span>
        </button>

        <p className="font-body text-[11px] uppercase tracking-[0.2em] text-[#F5F0E8]">LUXURIANT</p>

        <div className="relative" ref={mobileDropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((open) => !open)}
            className="relative p-1 text-[#F5F0E8] transition-colors hover:text-[#C4A882]"
            aria-label="Notifications"
          >
            <Bell size={20} strokeWidth={1.5} />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C0392B] px-[3px] font-body text-[9px] text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>

          {isDropdownOpen ? (
            <div className="absolute right-0 mt-3 w-[340px] max-h-[440px] max-w-[calc(100vw-24px)] overflow-y-auto border border-[#d4ccc2] bg-[#F5F0E8] shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between border-b border-[#d4ccc2] px-5 py-4">
                <p className="font-display text-[18px] italic text-[#1A1A1A]">Notifications</p>
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
                >
                  Mark all read
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="px-5 py-8 text-center font-body text-[12px] text-[#777777]">No notifications yet.</div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void onNotificationClick(notification)}
                    className={`w-full border-b border-[#d4ccc2] px-5 py-4 text-left transition-colors hover:bg-[rgba(196,168,130,0.05)] ${
                      notification.is_read ? "border-l-2 border-l-transparent" : "border-l-2 border-l-[#C4A882]"
                    }`}
                  >
                    <p className="font-body text-[12px] text-[#1A1A1A]">{notification.title}</p>
                    <p className="mt-0.5 font-body text-[11px] font-light text-[#555555]">
                      {notification.description || "Tap to view details."}
                    </p>
                    <p className="mt-1 font-body text-[10px] text-[#777777]">{formatRelativeDate(notification.created_at)}</p>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[200] bg-[rgba(0,0,0,0.5)] transition-opacity duration-300 md:hidden ${
          drawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeDrawer}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-[300] flex h-screen w-[280px] transform flex-col overflow-y-auto bg-[#1A1A1A] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.77,0,0.175,1)] md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 pb-5 pt-6">
          <p className="font-display text-[20px] italic text-[#F5F0E8]">LUXURIANT</p>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close menu"
            className="text-[20px] text-[#666666] transition-colors hover:text-[#F5F0E8]"
          >
            &times;
          </button>
        </div>

        <div className="border-b border-[#2a2a2a] px-5 py-4">
          <p className="font-body text-[12px] text-[#888888]">{adminName}</p>
          <p className="mt-1 font-body text-[9px] uppercase tracking-[0.1em] text-[#C4A882]">{roleLabel}</p>
        </div>

        <nav className="flex-1 py-2">
          {visibleNavGroups.map((group) => (
            <div key={`mobile-drawer-${group.label}`}>
              <p className="px-5 pb-2 pt-5 font-body text-[9px] uppercase tracking-[0.2em] text-[#444444]">{group.label}</p>
              {group.links.map((link) => (
                <NavLink
                  key={`mobile-drawer-link-${link.to}`}
                  to={link.to}
                  end={link.to === "/admin"}
                  onClick={closeDrawer}
                  className={({ isActive }) =>
                    `block border-l-2 px-5 py-[14px] font-body text-[11px] uppercase tracking-[0.1em] transition-all duration-200 ${
                      isActive
                        ? "border-l-[#C4A882] bg-[rgba(255,255,255,0.03)] text-[#F5F0E8]"
                        : "border-l-transparent text-[#666666] hover:text-[#F5F0E8]"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-[#2a2a2a] p-5">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="mb-3 block font-body text-[10px] uppercase tracking-[0.12em] text-[#555555] transition-colors hover:text-[#888888]"
          >
            View Store &rarr;
          </a>
          <button
            type="button"
            onClick={() => {
              closeDrawer();
              void onSignOut();
            }}
            className="font-body text-[10px] uppercase tracking-[0.12em] text-[#555555] transition-colors hover:text-[#C0392B]"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col bg-[#1A1A1A] lg:flex">
        <div className="border-b border-[#2a2a2a] px-6 pb-4">
          <Link to="/" className="block pt-8 font-display text-[22px] italic text-[#F5F0E8]">
            Luxuriant
          </Link>
          <p className="mt-4 font-body text-[10px] uppercase tracking-[0.15em] text-[#555555]">Admin Panel</p>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {visibleNavGroups.map((group) => (
            <div key={group.label}>
              <p className="px-6 pt-6 pb-2 font-body text-[9px] uppercase tracking-[0.2em] text-[#444444]">{group.label}</p>
              {group.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/admin"}
                  className={({ isActive }) =>
                    `block border-l-2 px-6 py-3 font-body text-[11px] uppercase tracking-[0.1em] transition-all duration-200 ${
                      isActive
                        ? "border-[#C4A882] bg-[rgba(255,255,255,0.03)] text-[#F5F0E8]"
                        : "border-transparent text-[#666666] hover:text-[#F5F0E8]"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-[#2a2a2a] p-6">
          <p className="font-body text-[12px] text-[#888888]">{adminName}</p>
          <p className="mt-1 font-body text-[9px] uppercase tracking-[0.1em] text-[#C4A882]">{roleLabel}</p>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="mt-5 block font-body text-[10px] uppercase tracking-[0.12em] text-[#555555] transition-colors hover:text-[#888888]"
          >
            View Store &rarr;
          </a>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-4 font-body text-[10px] uppercase tracking-[0.12em] text-[#555555] transition-colors hover:text-[#C0392B]"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <div className="min-h-screen pt-14 md:pt-0 lg:ml-[240px]">
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-[#d4ccc2] bg-[#F5F0E8] px-6 md:flex lg:px-[60px]">
          <div className="flex flex-wrap items-center gap-2 font-body text-[11px] text-[#555555]">
            {breadcrumb.map((item, index) => (
              <span key={`${item}-${index}`} className="flex items-center gap-2">
                {index > 0 ? <span className="text-[#d4ccc2]">/</span> : null}
                <span>{item}</span>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={desktopDropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((open) => !open)}
                className="relative p-1 text-[#1A1A1A] transition-colors hover:text-[#C4A882]"
                aria-label="Notifications"
              >
                <Bell size={22} strokeWidth={1.5} />
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C0392B] px-[3px] font-body text-[9px] text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>

              {isDropdownOpen ? (
                <div className="absolute right-0 mt-3 w-[340px] max-h-[440px] overflow-y-auto border border-[#d4ccc2] bg-[#F5F0E8] shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                  <div className="flex items-center justify-between border-b border-[#d4ccc2] px-5 py-4">
                    <p className="font-display text-[18px] italic text-[#1A1A1A]">Notifications</p>
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
                    >
                      Mark all read
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="px-5 py-8 text-center font-body text-[12px] text-[#777777]">No notifications yet.</div>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => void onNotificationClick(notification)}
                        className={`w-full border-b border-[#d4ccc2] px-5 py-4 text-left transition-colors hover:bg-[rgba(196,168,130,0.05)] ${
                          notification.is_read ? "border-l-2 border-l-transparent" : "border-l-2 border-l-[#C4A882]"
                        }`}
                      >
                        <p className="font-body text-[12px] text-[#1A1A1A]">{notification.title}</p>
                        <p className="mt-0.5 font-body text-[11px] font-light text-[#555555]">
                          {notification.description || "Tap to view details."}
                        </p>
                        <p className="mt-1 font-body text-[10px] text-[#777777]">{formatRelativeDate(notification.created_at)}</p>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] font-body text-[12px] text-[#F5F0E8]">
              {avatarInitial}
            </div>
          </div>
        </header>

        <div className="hidden border-b border-[#d4ccc2] md:block lg:hidden">
          <div className="admin-filter-scroll flex items-center gap-3 overflow-x-auto px-6 py-3">
            {compactNavLinks.map((link) => (
              <NavLink
                key={`compact-${link.to}`}
                to={link.to}
                end={link.to === "/admin"}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b pb-1 font-body text-[10px] uppercase tracking-[0.1em] ${
                    isActive ? "border-[#1A1A1A] text-[#1A1A1A]" : "border-transparent text-[#555555]"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={onSignOut}
              className="whitespace-nowrap border-b border-transparent pb-1 font-body text-[10px] uppercase tracking-[0.1em] text-[#555555] hover:text-[#C0392B]"
            >
              Sign Out
            </button>
          </div>

          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="mb-3 ml-6 inline-block font-body text-[10px] uppercase tracking-[0.1em] text-[#555555] transition-colors hover:text-[#888888]"
          >
            View Store &rarr;
          </a>
        </div>

        <div className="admin-content-area">
          <Outlet />
        </div>
      </div>

      <div className="pointer-events-none fixed top-6 right-6 z-50 space-y-2">
        {toasts.map((toastItem) => (
          <div
            key={toastItem.id}
            className="w-[320px] max-w-[calc(100vw-3rem)] border-l-[3px] border-[#C4A882] bg-[#1A1A1A] px-5 py-[14px] text-[#F5F0E8] shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          >
            <p className="font-body text-[12px]">{toastItem.title}</p>
            {toastItem.description ? <p className="mt-1 font-body text-[11px] text-[#c6c0b7]">{toastItem.description}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminLayout;

