import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  pending: "border border-[#d4ccc2] text-[#555555]",
  confirmed: "border border-[#1A1A1A] text-[#1A1A1A]",
  processing: "border border-[#C4A882] text-[#C4A882]",
  shipped: "bg-[#C4A882] text-[#1A1A1A]",
  delivered: "bg-[#1A1A1A] text-[#F5F0E8]",
  cancelled: "border border-[#C0392B] text-[#C0392B]",
};

const roleBadgeClass: Record<CustomerRole, string> = {
  customer: "border border-[#d4ccc2] text-[#555555]",
  admin: "border border-[#1A1A1A] text-[#1A1A1A]",
  super_admin: "border border-[#C4A882] text-[#C4A882]",
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
    return <div className="admin-page font-body text-[12px] text-[#555555]">Loading customer...</div>;
  }

  if (!detail || loadError) {
    return (
      <div className="admin-page">
        <p className="font-body text-[12px] text-[#C0392B]">{loadError || "Customer not found."}</p>
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
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#1A1A1A] font-body text-[24px] text-[#F5F0E8]">
                {customer.avatar_url ? (
                  <img src={customer.avatar_url} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  avatarInitial
                )}
              </div>
              <div className="ml-[20px]">
                <h1 className="admin-page-title font-display text-[32px] italic text-[#1A1A1A]">{fullName}</h1>
                <p className="mt-1 font-body text-[12px] text-[#777777]">{customer.email}</p>
                <p className="font-body text-[12px] text-[#777777]">{customer.phone || "-"}</p>
                <p className="mt-1 font-body text-[11px] text-[#777777]">Member since {formatDateShort(customer.created_at)}</p>
              </div>
            </div>
          </header>

          <div className="my-8 border-b border-[#d4ccc2]" />

          <section className="admin-stats-grid grid gap-6 grid-cols-2 xl:grid-cols-4">
            <div className="border-b-2 border-[#C4A882] pb-5">
              <p className="font-display text-[32px] leading-none text-[#1A1A1A]">{stats.totalOrders.toLocaleString("en-GH")}</p>
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-[#777777]">Total Orders</p>
            </div>
            <div className="border-b-2 border-[#C4A882] pb-5">
              <p className="font-display text-[32px] leading-none text-[#1A1A1A]">{formatCurrency(stats.totalSpent)}</p>
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-[#777777]">Total Spent</p>
            </div>
            <div className="border-b-2 border-[#C4A882] pb-5">
              <p className="font-display text-[32px] leading-none text-[#1A1A1A]">{formatCurrency(stats.average)}</p>
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-[#777777]">Avg Order Value</p>
            </div>
            <div className="border-b-2 border-[#C4A882] pb-5">
              <p className="font-display text-[32px] leading-none text-[#1A1A1A]">{stats.lastOrderDate ? formatDateShort(stats.lastOrderDate) : "-"}</p>
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-[#777777]">Last Order Date</p>
            </div>
          </section>

          <section className="mt-10">
            <div className="customer-tabs flex flex-nowrap gap-6 overflow-x-auto border-b border-[#d4ccc2]">
              {tabs.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`whitespace-nowrap border-b-2 pb-2 font-body text-[11px] uppercase tracking-[0.1em] ${
                      isActive ? "border-[#1A1A1A] text-[#1A1A1A]" : "border-transparent text-[#777777]"
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
                      <tr className="border-b border-[#d4ccc2]">
                        {["Order #", "Items", "Total", "Status", "Date", "Action"].map((heading) => (
                          <th
                            key={heading}
                            className="px-2 py-3 text-left font-body text-[10px] uppercase tracking-[0.12em] text-[#777777] first:pl-0 last:pr-0"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-0 py-8 text-center font-body text-[12px] text-[#777777]">
                            This customer has no orders yet.
                          </td>
                        </tr>
                      ) : (
                        orders.map((order) => (
                          <tr
                            key={order.order_number}
                            onClick={() => navigate(`/admin/orders/${order.order_number}`)}
                            className="cursor-pointer border-b border-[#e4dbd1] transition-colors hover:bg-[rgba(196,168,130,0.04)]"
                          >
                            <td className="px-2 py-4 pl-0 font-body text-[11px] uppercase tracking-[0.08em] text-[#C4A882]">{order.order_number}</td>
                            <td className="px-2 py-4 font-body text-[12px] text-[#1A1A1A]">{order.items_count}</td>
                            <td className="px-2 py-4 font-body text-[12px] text-[#1A1A1A]">{formatCurrency(order.total)}</td>
                            <td className="px-2 py-4">
                              <span
                                className={`inline-block rounded-[2px] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                                  statusBadgeClass[order.status] ?? "border border-[#d4ccc2] text-[#555555]"
                                }`}
                              >
                                {titleCase(order.status)}
                              </span>
                            </td>
                            <td className="px-2 py-4 font-body text-[11px] text-[#777777]">{formatDateShort(order.created_at)}</td>
                            <td className="px-0 py-4 text-right">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(`/admin/orders/${order.order_number}`);
                                }}
                                className="font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
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
                <div className="border-t border-[#d4ccc2] md:hidden">
                  {orders.length === 0 ? (
                    <p className="py-8 text-center font-body text-[12px] text-[#777777]">This customer has no orders yet.</p>
                  ) : (
                    orders.map((order) => (
                      <div key={`mobile-${order.order_number}`} className="admin-mobile-card" onClick={() => navigate(`/admin/orders/${order.order_number}`)}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[#C4A882]">{order.order_number}</p>
                          <span
                            className={`inline-block rounded-[2px] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                              statusBadgeClass[order.status] ?? "border border-[#d4ccc2] text-[#555555]"
                            }`}
                          >
                            {titleCase(order.status)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="font-body text-[12px] text-[#1A1A1A]">{order.items_count} items</p>
                          <p className="font-body text-[12px] text-[#1A1A1A]">{formatCurrency(order.total)}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="font-body text-[10px] text-[#777777]">{formatDateShort(order.created_at)}</p>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/admin/orders/${order.order_number}`);
                            }}
                            className="font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882]"
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
                    <p className="font-body text-[12px] text-[#777777]">No addresses saved.</p>
                  ) : (
                    addresses.map((address) => (
                      <div key={address.id} className="border border-[#d4ccc2] px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-[2px] border border-[#d4ccc2] px-2 py-1 font-body text-[9px] uppercase tracking-[0.1em] text-[#555555]">
                            {address.label || "Address"}
                          </span>
                          {address.is_default ? (
                            <span className="rounded-[2px] border border-[#C4A882] px-2 py-1 font-body text-[9px] uppercase tracking-[0.1em] text-[#C4A882]">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 font-body text-[12px] leading-[1.8] text-[#555555]">
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
                        <p className="mt-2 font-body text-[10px] text-[#777777]">Used on {address.usage_count} order(s)</p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {activeTab === "notes" ? (
                <div>
                  {customer.notes ? (
                    <p className="font-body text-[13px] italic leading-[1.8] text-[#555555]">{customer.notes}</p>
                  ) : (
                    <p className="font-body text-[12px] text-[#777777]">No notes yet.</p>
                  )}

                  <textarea
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    className="mt-5 min-h-[120px] w-full resize-y border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none placeholder:text-[#999999] focus:border-[#1A1A1A]"
                    placeholder="Add internal note..."
                  />

                  <button
                    type="button"
                    onClick={() => void saveNote()}
                    disabled={isSavingNote}
                    className="mt-4 rounded-[2px] bg-[#1A1A1A] px-6 py-2.5 font-body text-[10px] uppercase tracking-[0.1em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isSavingNote ? "Saving..." : "Save Note"}
                  </button>
                  {noteSaved ? <p className="mt-2 font-body text-[11px] text-[#C4A882]">Note saved.</p> : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="customer-detail-right border-l border-[#d4ccc2] pl-0 lg:sticky lg:top-20 lg:h-fit lg:pl-10">
          <section>
            <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Account Status</p>
            <span
              className={`inline-block rounded-[2px] border px-4 py-2 font-body text-[11px] uppercase tracking-[0.12em] ${
                isAccountActive ? "border-[#C4A882] text-[#C4A882]" : "border-[#C0392B] text-[#C0392B]"
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
                    className="font-body text-[10px] uppercase tracking-[0.1em] text-[#777777] transition-colors hover:text-[#C0392B]"
                  >
                    Deactivate Account
                  </button>
                ) : (
                  <div>
                    <p className="mb-3 font-body text-[11px] text-[#555555]">
                      Deactivating this account will prevent this customer from logging in.
                    </p>
                    <button
                      type="button"
                      onClick={() => void updateStatus(false)}
                      disabled={isUpdatingStatus}
                      className="w-full rounded-[2px] bg-[#C0392B] px-4 py-3 font-body text-[10px] uppercase tracking-[0.1em] text-white disabled:opacity-65"
                    >
                      {isUpdatingStatus ? "Updating..." : "Confirm Deactivation"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeactivateConfirm(false)}
                      className="mt-2 font-body text-[10px] text-[#777777]"
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
                className="mt-4 font-body text-[10px] uppercase tracking-[0.1em] text-[#777777] transition-colors hover:text-[#27AE60] disabled:opacity-65"
              >
                {isUpdatingStatus ? "Updating..." : "Reactivate Account"}
              </button>
            )}
          </section>

          {role === "super_admin" ? (
            <>
              <div className="my-7 border-b border-[#d4ccc2]" />
              <section>
                <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Role</p>
                <span className={`inline-block rounded-[2px] px-3 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${roleBadgeClass[currentRole]}`}>
                  {titleCase(currentRole)}
                </span>

                <select
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value as CustomerRole)}
                  className="mt-4 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[12px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                >
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>

                <button
                  type="button"
                  onClick={() => void updateRole()}
                  disabled={isUpdatingRole || selectedRole === currentRole}
                  className="mt-4 w-full rounded-[2px] bg-[#1A1A1A] px-4 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {isUpdatingRole ? "Updating..." : "Update Role"}
                </button>
                {roleSaved ? <p className="mt-2 font-body text-[11px] text-[#C4A882]">Role updated.</p> : null}
              </section>
            </>
          ) : null}

          <div className="my-7 border-b border-[#d4ccc2]" />
          <section>
            <p className="mb-2 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Timeline</p>
            <p className="font-body text-[11px] text-[#777777]">{formatDateLong(customer.created_at)}</p>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default AdminCustomerDetailPage;


