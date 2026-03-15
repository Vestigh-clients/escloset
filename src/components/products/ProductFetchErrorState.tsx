import { AlertCircle } from "lucide-react";

interface ProductFetchErrorStateProps {
  title?: string;
}

const ProductFetchErrorState = ({ title = "Could not load products." }: ProductFetchErrorStateProps) => {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
      <AlertCircle size={24} strokeWidth={1.25} className="text-[#777777]" />
      <p className="mt-4 font-display text-[22px] italic text-[#555555]">{title}</p>
      <p className="mt-2 font-body text-[12px] text-[#777777]">Please refresh the page to try again.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-5 font-body text-[11px] uppercase tracking-[0.14em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
      >
        Refresh
      </button>
    </div>
  );
};

export default ProductFetchErrorState;

