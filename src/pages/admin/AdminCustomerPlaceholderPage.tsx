import { Link, useParams } from "react-router-dom";

const AdminCustomerPlaceholderPage = () => {
  const { id } = useParams();

  return (
    <div className="bg-[#F5F0E8] px-6 py-10 lg:px-[60px] lg:py-12">
      <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Customer</p>
      <h1 className="mt-2 font-display text-[32px] italic text-[#1A1A1A]">Customer {id}</h1>
      <p className="mt-3 font-body text-[12px] text-[#888888]">Customer detail management can be added in the next pass.</p>
      <Link
        to="/admin/orders"
        className="mt-5 inline-block font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882] hover:text-[#1A1A1A]"
      >
        Back to Orders
      </Link>
    </div>
  );
};

export default AdminCustomerPlaceholderPage;
