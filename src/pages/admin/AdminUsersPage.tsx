import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import {
  demoteCustomerToRole,
  fetchAdminUsers,
  promoteCustomerRole,
  searchCustomerPromotionCandidates,
  type AdminUserListItem,
  type CustomerSearchResult,
} from "@/services/adminManagementService";
import { formatDateShort } from "@/lib/adminFormatting";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type ElevatedRole = Extract<Database["public"]["Enums"]["customer_role"], "admin" | "super_admin">;

const roleBadgeClass: Record<ElevatedRole, string> = {
  admin: "border border-[var(--color-primary)] text-[var(--color-primary)]",
  super_admin: "border border-[var(--color-accent)] text-[var(--color-accent)]",
};

const AdminUsersPage = () => {
  const { role, user } = useAuth();

  const [rows, setRows] = useState<AdminUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<ElevatedRole>("admin");
  const [isPromoting, setIsPromoting] = useState(false);

  const [demoteConfirmId, setDemoteConfirmId] = useState<string | null>(null);
  const [isDemoting, setIsDemoting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAdminUsers();
      setRows(data);
    } catch {
      setRows([]);
      setLoadError("Unable to load admin users.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === "super_admin") {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!isPanelOpen || selectedCustomer || searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const data = await searchCustomerPromotionCandidates(searchTerm);
        if (!isMounted) return;
        setSearchResults(data);
      } catch {
        if (!isMounted) return;
        setSearchResults([]);
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [isPanelOpen, searchTerm, selectedCustomer]);

  const openPanel = () => {
    setIsPanelOpen(true);
    setSearchInput("");
    setSearchTerm("");
    setSearchResults([]);
    setSelectedCustomer(null);
    setSelectedRole("admin");
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSearchInput("");
    setSearchTerm("");
    setSearchResults([]);
    setSelectedCustomer(null);
    setSelectedRole("admin");
  };

  const promote = async () => {
    if (!selectedCustomer || !user) {
      setMessage("Select a customer to promote.");
      return;
    }

    setIsPromoting(true);
    try {
      await promoteCustomerRole(selectedCustomer.id, selectedRole, {
        target_customer_id: selectedCustomer.id,
        target_email: selectedCustomer.email,
        new_role: selectedRole,
        assigned_by: user.id,
      });
      setMessage("User promoted.");
      await load();
      closePanel();
    } catch {
      setMessage("Unable to promote this customer.");
    } finally {
      setIsPromoting(false);
    }
  };

  const demote = async (row: AdminUserListItem) => {
    if (!user) return;
    setIsDemoting(true);
    try {
      await demoteCustomerToRole(row.customer_id, {
        target_customer_id: row.customer_id,
        target_email: row.customer.email,
        removed_role: row.role,
        removed_by: user.id,
      });
      setMessage("Admin access removed.");
      setDemoteConfirmId(null);
      await load();
    } catch {
      setMessage("Unable to demote this user.");
    } finally {
      setIsDemoting(false);
    }
  };

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          new Date(b.assigned_at ?? b.created_at).getTime() - new Date(a.assigned_at ?? a.created_at).getTime(),
      ),
    [rows],
  );

  if (role !== "super_admin") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title font-display text-[36px] italic text-[var(--color-primary)]">Admin Users</h1>
        <div className="admin-page-actions">
          <button
            type="button"
            onClick={openPanel}
            className="rounded-[var(--border-radius)] bg-[var(--color-primary)] px-7 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)]"
          >
            Promote Customer
          </button>
        </div>
      </div>

      <div className="mb-8 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.08)] px-5 py-4">
        <p className="font-body text-[12px] leading-[1.8] text-[var(--color-muted)]">
          Admin users can manage products, orders and customers. Super Admins have full access including this page, site settings and
          role management. Role changes are logged and cannot be undone without super admin access.
        </p>
      </div>

      {message ? <p className="mb-4 font-body text-[12px] text-[var(--color-accent)]">{message}</p> : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[980px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {["User", "Email", "Role", "Promoted By", "Date Promoted", "Actions"].map((heading) => (
                <th
                  key={heading}
                  className="px-2 py-3 text-left font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)] first:pl-0 last:pr-0"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                  Loading admin users...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={6} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-danger)]">
                  {loadError}
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                  No admin users found.
                </td>
              </tr>
            ) : (
              sortedRows.flatMap((row) => {
                const initials = (row.customer.first_name.slice(0, 1) || row.customer.email.slice(0, 1) || "A").toUpperCase();
                const dateValue = row.assigned_at || row.created_at;
                const canDemote = row.role === "admin" && row.customer_id !== user?.id;
                return [
                  <tr key={row.customer_id} className="border-b border-[var(--color-surface-strong)] hover:bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.04)]">
                    <td className="px-2 py-4 pl-0">
                      <div className="flex items-center gap-[10px]">
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)] font-body text-[12px] text-[var(--color-secondary)]">
                          {row.customer.avatar_url ? (
                            <img src={row.customer.avatar_url} alt={row.customer.first_name} className="h-full w-full object-cover" />
                          ) : (
                            initials
                          )}
                        </div>
                        <p className="font-body text-[12px] text-[var(--color-primary)]">{`${row.customer.first_name} ${row.customer.last_name}`.trim()}</p>
                      </div>
                    </td>
                    <td className="px-2 py-4 font-body text-[11px] text-[var(--color-muted-soft)]">{row.customer.email}</td>
                    <td className="px-2 py-4">
                      <span className={`inline-block rounded-[var(--border-radius)] px-3 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${roleBadgeClass[row.role]}`}>
                        {row.role === "super_admin" ? "Super Admin" : "Admin"}
                      </span>
                    </td>
                    <td className="px-2 py-4 font-body text-[11px] text-[var(--color-muted-soft)]">{row.promoted_by_name || "System"}</td>
                    <td className="px-2 py-4 font-body text-[11px] text-[var(--color-muted-soft)]">{formatDateShort(dateValue)}</td>
                    <td className="px-0 py-4">
                      {canDemote ? (
                        <button
                          type="button"
                          onClick={() => setDemoteConfirmId(row.customer_id)}
                          className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-danger)]"
                        >
                          Demote to Customer
                        </button>
                      ) : (
                        <span className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">-</span>
                      )}
                    </td>
                  </tr>,
                  demoteConfirmId === row.customer_id ? (
                    <tr key={`${row.customer_id}-confirm`} className="border-b border-[var(--color-border)] bg-[rgba(var(--color-secondary-rgb),0.24)]">
                      <td colSpan={6} className="px-4 py-4">
                        <p className="mb-3 font-body text-[11px] text-[var(--color-muted)]">
                          Demote {`${row.customer.first_name} ${row.customer.last_name}`.trim()} to customer? They will lose all admin access.
                        </p>
                        <button
                          type="button"
                          onClick={() => void demote(row)}
                          disabled={isDemoting}
                          className="w-full rounded-[var(--border-radius)] bg-[var(--color-danger)] px-4 py-3 font-body text-[10px] uppercase tracking-[0.1em] text-white disabled:opacity-65"
                        >
                          {isDemoting ? "Updating..." : "Confirm Demotion"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDemoteConfirmId(null)}
                          className="mt-2 font-body text-[10px] text-[var(--color-muted-soft)]"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ) : null,
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[var(--color-border)] md:hidden">
        {isLoading ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">Loading admin users...</p>
        ) : loadError ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-danger)]">{loadError}</p>
        ) : sortedRows.length === 0 ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">No admin users found.</p>
        ) : (
          sortedRows.map((row) => {
            const initials = (row.customer.first_name.slice(0, 1) || row.customer.email.slice(0, 1) || "A").toUpperCase();
            const dateValue = row.assigned_at || row.created_at;
            const canDemote = row.role === "admin" && row.customer_id !== user?.id;
            return (
              <div key={`mobile-${row.customer_id}`} className="admin-mobile-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-[10px]">
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)] font-body text-[12px] text-[var(--color-secondary)]">
                      {row.customer.avatar_url ? (
                        <img src={row.customer.avatar_url} alt={row.customer.first_name} className="h-full w-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <p className="truncate font-body text-[12px] text-[var(--color-primary)]">{`${row.customer.first_name} ${row.customer.last_name}`.trim()}</p>
                  </div>
                  <span className={`inline-block rounded-[var(--border-radius)] px-3 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${roleBadgeClass[row.role]}`}>
                    {row.role === "super_admin" ? "Super Admin" : "Admin"}
                  </span>
                </div>

                <p className="admin-mobile-ellipsis mt-2 font-body text-[11px] text-[var(--color-muted-soft)]">{row.customer.email}</p>
                <p className="mt-1 font-body text-[11px] text-[var(--color-muted-soft)]">
                  {row.promoted_by_name || "System"} · {formatDateShort(dateValue)}
                </p>

                <div className="mt-2 flex justify-end font-body text-[10px] uppercase tracking-[0.1em]">
                  {canDemote ? (
                    demoteConfirmId === row.customer_id ? (
                      <div className="flex gap-3">
                        <button type="button" onClick={() => void demote(row)} disabled={isDemoting} className="text-[var(--color-danger)]">
                          {isDemoting ? "Updating..." : "Confirm"}
                        </button>
                        <button type="button" onClick={() => setDemoteConfirmId(null)} className="text-[var(--color-muted)]">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDemoteConfirmId(row.customer_id)}
                        className="text-[var(--color-muted-soft)] hover:text-[var(--color-danger)]"
                      >
                        Demote to Customer
                      </button>
                    )
                  ) : (
                    <span className="text-[var(--color-muted-soft)]">-</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {isPanelOpen ? (
        <div className="mt-6 border border-[var(--color-border)] p-6">
          <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Promote Customer</p>

          <div className="grid gap-5">
            <div className="relative">
              <input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setSelectedCustomer(null);
                }}
                placeholder="Search customer by email..."
                className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
              />

              {!selectedCustomer && searchTerm.length >= 2 && searchResults.length > 0 ? (
                <div className="absolute z-10 mt-2 max-h-[220px] w-full overflow-y-auto border border-[var(--color-border)] bg-[var(--color-secondary)]">
                  {searchResults.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(candidate);
                        setSearchInput(candidate.email);
                      }}
                      className="block w-full border-b border-[var(--color-surface-strong)] px-4 py-3 text-left hover:bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.05)]"
                    >
                      <p className="font-body text-[12px] text-[var(--color-primary)]">{`${candidate.first_name} ${candidate.last_name}`.trim()}</p>
                      <p className="font-body text-[11px] text-[var(--color-muted)]">{candidate.email}</p>
                    </button>
                  ))}
                </div>
              ) : null}
              {isSearching ? <p className="mt-2 font-body text-[11px] text-[var(--color-muted-soft)]">Searching...</p> : null}
            </div>

            {selectedCustomer ? (
              <div className="flex items-center gap-3 border border-[var(--color-border)] p-4">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)] font-body text-[12px] text-[var(--color-secondary)]">
                  {selectedCustomer.avatar_url ? (
                    <img src={selectedCustomer.avatar_url} alt={selectedCustomer.first_name} className="h-full w-full object-cover" />
                  ) : (
                    (selectedCustomer.first_name.slice(0, 1) || selectedCustomer.email.slice(0, 1) || "C").toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-body text-[12px] text-[var(--color-primary)]">{`${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim()}</p>
                  <p className="font-body text-[11px] text-[var(--color-muted)]">{selectedCustomer.email}</p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedRole("admin")}
                className={`rounded-[var(--border-radius)] border px-6 py-6 text-left transition-colors duration-200 ${
                  selectedRole === "admin" ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"
                }`}
                style={{ backgroundColor: selectedRole === "admin" ? "rgba(var(--color-navbar-solid-foreground-rgb),0.08)" : "transparent" }}
              >
                <p className="font-display text-[18px] italic text-[var(--color-primary)]">Admin</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole("super_admin")}
                className={`rounded-[var(--border-radius)] border px-6 py-6 text-left transition-colors duration-200 ${
                  selectedRole === "super_admin" ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"
                }`}
                style={{ backgroundColor: selectedRole === "super_admin" ? "rgba(var(--color-navbar-solid-foreground-rgb),0.08)" : "transparent" }}
              >
                <p className="font-display text-[18px] italic text-[var(--color-primary)]">Super Admin</p>
              </button>
            </div>

            {selectedRole === "super_admin" ? (
              <div className="rounded-[var(--border-radius)] border border-[rgba(var(--color-danger-rgb),0.2)] bg-[rgba(var(--color-danger-rgb),0.06)] px-4 py-3">
                <p className="font-body text-[11px] leading-[1.8] text-[var(--color-danger)]">
                  Super Admin has full system access including the ability to manage other admins and site settings. Only assign this
                  role to trusted users.
                </p>
              </div>
            ) : null}

            <div>
              <button
                type="button"
                onClick={() => void promote()}
                disabled={!selectedCustomer || isPromoting}
                className="w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-4 py-4 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isPromoting ? "Promoting..." : "Promote User"}
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="mt-3 block w-full font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-primary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminUsersPage;



