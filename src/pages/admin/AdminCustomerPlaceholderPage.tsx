import { Link, useParams } from "react-router";

const AdminCustomerPlaceholderPage = () => {
  const { id } = useParams();

  return (
    <div className="admin-page">
      <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Customer</p>
      <h1 className="admin-page-title mt-2 font-display text-[32px] italic text-[var(--color-primary)]">Customer {id}</h1>
      <p className="mt-3 font-body text-[12px] text-[var(--color-muted)]">Customer detail management can be added in the next pass.</p>
      <Link
        to="/admin/orders"
        className="mt-5 inline-block font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)] hover:text-[var(--color-primary)]"
      >
        Back to Orders
      </Link>
    </div>
  );
};

export default AdminCustomerPlaceholderPage;


