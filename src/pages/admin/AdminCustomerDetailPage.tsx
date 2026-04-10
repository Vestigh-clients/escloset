import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  assignCustomerRole,
  fetchAdminCustomerAddresses,
  fetchAdminCustomerDetail,
  fetchAdminCustomerOrders,
  updateAdminCustomerNote,
  updateAdminCustomerStatus,
  type AdminCustomerAddressRow,
  type AdminCustomerDetail,
  type AdminCustomerOrderRow,
} from "@/services/adminManagementService";
import { formatCurrency, formatDateLong, formatDateShort } from "@/lib/adminFormatting";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type CustomerRole = Database["public"]["Enums"]["customer_role"];
type DetailTab = "orders" | "addresses" | "notes";

const tabs: Array<{ key: DetailTab; label: string }> = [
  { key: "orders", label: "Orders" },
  { key: "addresses", label: "Addresses" },
  { key: "notes", label: "Notes" },
];

const statusBadgeClass: Record<string, string> = {
  pending: "border border-[var(--color-border)] text-[var(--color-muted)]",
  confirmed: "border border-[var(--color-primary)] text-[var(--color-primary)]",
  processing: "border border-[var(--color-accent)] text-[var(--color-accent)]",
  shipped: "bg-[var(--color-accent)] text-[var(--color-secondary)]",
  delivered: "bg-[var(--color-primary)] text-[var(--color-secondary)]",
  cancelled: "border border-[var(--color-danger)] text-[var(--color-danger)]",
};

const roleBadgeClass: Record<CustomerRole, string> = {
  customer: "border border-[var(--color-border)] text-[var(--color-muted)]",
  admin: "border border-[var(--color-primary)] text-[var(--color-primary)]",
  super_admin: "border border-[var(--color-accent)] text-[var(--color-accent)]",
};

const titleCase = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const AdminCustomerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [orders, setOrders] = useState<AdminCustomerOrderRow[]>([]);
  const [addresses, setAddresses] = useState<AdminCustomerAddressRow[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>("orders");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [noteText, setNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [selectedRole, setSelectedRole] = useState<CustomerRole>("customer");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleSaved, setRoleSaved] = useState(false);

  const load = async () => {
    if (!id) {
      setDetail(null);
      setOrders([]);
      setAddresses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [detailData, orderData, addressData] = await Promise.all([
        fetchAdminCustomerDetail(id),
        fetchAdminCustomerOrders(id),
        fetchAdminCustomerAddresses(id),
      ]);

      setDetail(detailData);
      setOrders(orderData);
      setAddresses(addressData);
      setNoteText(detailData.customer.notes ?? "");
      setSelectedRole(detailData.roleRecord?.role ?? "customer");
    } catch {
      setDetail(null);
      setOrders([]);
      setAddresses([]);
      setLoadError("Unable to load customer details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!noteSaved) return;
    const timeout = window.setTimeout(() => setNoteSaved(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [noteSaved]);

  useEffect(() => {
    if (!roleSaved) return;
    const timeout = window.setTimeout(() => setRoleSaved(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [roleSaved]);

  const currentRole = detail?.roleRecord?.role ?? "customer";
  const isAccountActive = detail?.customer.is_active ?? true;

  const stats = useMemo(() => {
    const totalOrders = detail?.customer.total_orders ?? orders.length;
    const totalSpent = detail?.customer.total_spent ?? 0;
    const average = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const lastOrderDate = orders[0]?.created_at ?? null;
    return {
      totalOrders,
      totalSpent,
      average,
      lastOrderDate,
    };
  }, [detail?.customer.total_orders, detail?.customer.total_spent, orders]);

  const saveNote = async () => {
    if (!detail) return;
    setIsSavingNote(true);
    try {
      await updateAdminCustomerNote(detail.customer.id, noteText.trim());
      setDetail((current) =>
        current
          ? {
              ...current,
              customer: {
                ...current.customer,
                notes: noteText.trim(),
              },
            }
          : current,
      );
      setNoteSaved(true);
    } finally {
      setIsSavingNote(false);
    }
  };

  const updateStatus = async (nextIsActive: boolean) => {
    if (!detail) return;
    setIsUpdatingStatus(true);
    try {
      await updateAdminCustomerStatus(detail.customer.id, nextIsActive);
      setDetail((current) =>
        current
          ? {
              ...current,
              customer: {
                ...current.customer,
                is_active: nextIsActive,
              },
            }
          : current,
      );
      setShowDeactivateConfirm(false);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const updateRole = async () => {
    if (!detail) return;
    setIsUpdatingRole(true);
    try {
      await assignCustomerRole(detail.customer.id, selectedRole, {
        source: "admin.customer_detail",
      });
      await load();
      setRoleSaved(true);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  if (isLoading) {
    return <div className="admin-page font-body text-[12px] text-[var(--color-muted)]">Loading customer...</div>;
  }

  if (!detail || loadError) {
    return (
      <div className="admin-page">
        <p className="font-body text-[12px] text-[var(--color-danger)]">{loadError || "Customer not found."}</p>
      </div>
    );
  }

  const customer = detail.customer;
  const fullName = `${customer.first_name} ${customer.last_name}`.trim();
  const avatarInitial = (customer.first_name.slice(0, 1) || customer.email.slice(0, 1) || "C").toUpperCase();

  return (
    <div className="admin-page">
      <div className="customer-detail-layout grid gap-10 lg:grid-cols-[65%_35%]">
        <div className="customer-detail-left">
          <header>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)] font-body text-[24px] text-[var(--color-secondary)]">
                {customer.avatar_url ? (
                  <img src={customer.avatar_url} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  avatarInitial
                )}
              </div>
              <div className="ml-[20px]">
                <h1 className="admin-page-title font-display text-[32px] italic text-[var(--color-primary)]">{fullName}</h1>
                <p className="mt-1 font-body text-[12px] text-[var(--color-muted-soft)]">{customer.email}</p>
                <p className="font-body text-[12px] text-[var(--color-muted-soft)]">{customer.phone || "-"}</p>
                <p className="mt-1 font-body text-[11px] text-[var(--color-muted-soft)]">Member since {formatDateShort(customer.created_at)}</p>
              </div>
            </div>
          </header>

          <div className="my-8 border-b border-[var(--color-border)]" />

          <section className="admin-stats-grid grid gap-6 grid-cols-2 xl:grid-cols-4">
            <div className="border-b-2 border-[var(--color-accent)] pb-5">
              <p className="font-display text-[32px] leading-none text-[var(--color-primary)]">{stats.totalOrders.toLocaleString("en-GH")}</p>
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">Total Orders</p>
            </div>
            <div className="border-b-2 border-[var(--color-accent)] pb-5">
              <p className="font-display text-[32px] leading-none text-[var(--color-primary)]">{formatCurrency(stats.totalSpent)}</p>
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">Total Spent</p>
            </div>
            <div className="border-b-2 border-[var(--color-accent)] pb-5">
              <p className="font-display text-[32px] leading-none text-[var(--color-primary)]">{formatCurrency(stats.average)}</p>
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">Avg Order Value</p>
            </div>
            <div className="border-b-2 border-[var(--color-accent)] pb-5">
              <p className="font-display text-[32px] leading-none text-[var(--color-primary)]">{stats.lastOrderDate ? formatDateShort(stats.lastOrderDate) : "-"}</p>
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">Last Order Date</p>
            </div>
          </section>

          <section className="mt-10">
            <div className="customer-tabs flex flex-nowrap gap-6 overflow-x-auto border-b border-[var(--color-border)]">
              {tabs.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`whitespace-nowrap border-b-2 pb-2 font-body text-[11px] uppercase tracking-[0.1em] ${
                      isActive ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-[var(--color-muted-soft)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="pt-6">
              {activeTab === "orders" ? (
                <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-[760px] w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        {["Order #", "Items", "Total", "Status", "Date", "Action"].map((heading) => (
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
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                            This customer has no orders yet.
                          </td>
                        </tr>
                      ) : (
                        orders.map((order) => (
                          <tr
                            key={order.order_number}
                            onClick={() => navigate(`/admin/orders/${order.order_number}`)}
                            className="cursor-pointer border-b border-[var(--color-surface-strong)] transition-colors hover:bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.04)]"
                          >
                            <td className="px-2 py-4 pl-0 font-body text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent)]">{order.order_number}</td>
                            <td className="px-2 py-4 font-body text-[12px] text-[var(--color-primary)]">{order.items_count}</td>
                            <td className="px-2 py-4 font-body text-[12px] text-[var(--color-primary)]">{formatCurrency(order.total)}</td>
                            <td className="px-2 py-4">
                              <span
                                className={`inline-block rounded-[var(--border-radius)] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                                  statusBadgeClass[order.status] ?? "border border-[var(--color-border)] text-[var(--color-muted)]"
                                }`}
                              >
                                {titleCase(order.status)}
                              </span>
                            </td>
                            <td className="px-2 py-4 font-body text-[11px] text-[var(--color-muted-soft)]">{formatDateShort(order.created_at)}</td>
                            <td className="px-0 py-4 text-right">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(`/admin/orders/${order.order_number}`);
                                }}
                                className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)] transition-colors hover:text-[var(--color-primary)]"
                              >
                                View &rarr;
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-[var(--color-border)] md:hidden">
                  {orders.length === 0 ? (
                    <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">This customer has no orders yet.</p>
                  ) : (
                    orders.map((order) => (
                      <div key={`mobile-${order.order_number}`} className="admin-mobile-card" onClick={() => navigate(`/admin/orders/${order.order_number}`)}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent)]">{order.order_number}</p>
                          <span
                            className={`inline-block rounded-[var(--border-radius)] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                              statusBadgeClass[order.status] ?? "border border-[var(--color-border)] text-[var(--color-muted)]"
                            }`}
                          >
                            {titleCase(order.status)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="font-body text-[12px] text-[var(--color-primary)]">{order.items_count} items</p>
                          <p className="font-body text-[12px] text-[var(--color-primary)]">{formatCurrency(order.total)}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="font-body text-[10px] text-[var(--color-muted-soft)]">{formatDateShort(order.created_at)}</p>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/admin/orders/${order.order_number}`);
                            }}
                            className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)]"
                          >
                            View &rarr;
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                </>
              ) : null}

              {activeTab === "addresses" ? (
                <div className="grid gap-4">
                  {addresses.length === 0 ? (
                    <p className="font-body text-[12px] text-[var(--color-muted-soft)]">No addresses saved.</p>
                  ) : (
                    addresses.map((address) => (
                      <div key={address.id} className="border border-[var(--color-border)] px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-[var(--border-radius)] border border-[var(--color-border)] px-2 py-1 font-body text-[9px] uppercase tracking-[0.1em] text-[var(--color-muted)]">
                            {address.label || "Address"}
                          </span>
                          {address.is_default ? (
                            <span className="rounded-[var(--border-radius)] border border-[var(--color-accent)] px-2 py-1 font-body text-[9px] uppercase tracking-[0.1em] text-[var(--color-accent)]">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 font-body text-[12px] leading-[1.8] text-[var(--color-muted)]">
                          {address.recipient_name}
                          <br />
                          {address.address_line1}
                          {address.address_line2 ? `, ${address.address_line2}` : ""}
                          <br />
                          {address.city}, {address.state}
                          <br />
                          {address.country}
                          <br />
                          {address.recipient_phone || "-"}
                        </p>
                        <p className="mt-2 font-body text-[10px] text-[var(--color-muted-soft)]">Used on {address.usage_count} order(s)</p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {activeTab === "notes" ? (
                <div>
                  {customer.notes ? (
                    <p className="font-body text-[13px] italic leading-[1.8] text-[var(--color-muted)]">{customer.notes}</p>
                  ) : (
                    <p className="font-body text-[12px] text-[var(--color-muted-soft)]">No notes yet.</p>
                  )}

                  <textarea
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    className="mt-5 min-h-[120px] w-full resize-y border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
                    placeholder="Add internal note..."
                  />

                  <button
                    type="button"
                    onClick={() => void saveNote()}
                    disabled={isSavingNote}
                    className="mt-4 rounded-[var(--border-radius)] bg-[var(--color-primary)] px-6 py-2.5 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isSavingNote ? "Saving..." : "Save Note"}
                  </button>
                  {noteSaved ? <p className="mt-2 font-body text-[11px] text-[var(--color-accent)]">Note saved.</p> : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="customer-detail-right border-l border-[var(--color-border)] pl-0 lg:sticky lg:top-20 lg:h-fit lg:pl-10">
          <section>
            <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Account Status</p>
            <span
              className={`inline-block rounded-[var(--border-radius)] border px-4 py-2 font-body text-[11px] uppercase tracking-[0.12em] ${
                isAccountActive ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-[var(--color-danger)] text-[var(--color-danger)]"
              }`}
            >
              {isAccountActive ? "Active" : "Inactive"}
            </span>

            {isAccountActive ? (
              <div className="mt-4">
                {!showDeactivateConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeactivateConfirm(true)}
                    className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-danger)]"
                  >
                    Deactivate Account
                  </button>
                ) : (
                  <div>
                    <p className="mb-3 font-body text-[11px] text-[var(--color-muted)]">
                      Deactivating this account will prevent this customer from logging in.
                    </p>
                    <button
                      type="button"
                      onClick={() => void updateStatus(false)}
                      disabled={isUpdatingStatus}
                      className="w-full rounded-[var(--border-radius)] bg-[var(--color-danger)] px-4 py-3 font-body text-[10px] uppercase tracking-[0.1em] text-white disabled:opacity-65"
                    >
                      {isUpdatingStatus ? "Updating..." : "Confirm Deactivation"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeactivateConfirm(false)}
                      className="mt-2 font-body text-[10px] text-[var(--color-muted-soft)]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void updateStatus(true)}
                disabled={isUpdatingStatus}
                className="mt-4 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-success)] disabled:opacity-65"
              >
                {isUpdatingStatus ? "Updating..." : "Reactivate Account"}
              </button>
            )}
          </section>

          {role === "super_admin" ? (
            <>
              <div className="my-7 border-b border-[var(--color-border)]" />
              <section>
                <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Role</p>
                <span className={`inline-block rounded-[var(--border-radius)] px-3 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${roleBadgeClass[currentRole]}`}>
                  {titleCase(currentRole)}
                </span>

                <select
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value as CustomerRole)}
                  className="mt-4 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[12px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>

                <button
                  type="button"
                  onClick={() => void updateRole()}
                  disabled={isUpdatingRole || selectedRole === currentRole}
                  className="mt-4 w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-4 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {isUpdatingRole ? "Updating..." : "Update Role"}
                </button>
                {roleSaved ? <p className="mt-2 font-body text-[11px] text-[var(--color-accent)]">Role updated.</p> : null}
              </section>
            </>
          ) : null}

          <div className="my-7 border-b border-[var(--color-border)]" />
          <section>
            <p className="mb-2 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Timeline</p>
            <p className="font-body text-[11px] text-[var(--color-muted-soft)]">{formatDateLong(customer.created_at)}</p>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default AdminCustomerDetailPage;



