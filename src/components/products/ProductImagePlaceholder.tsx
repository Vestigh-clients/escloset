import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImagePlaceholderProps {
  className?: string;
}

const ProductImagePlaceholder = ({ className }: ProductImagePlaceholderProps) => {
  return (
    <div className={cn("flex items-center justify-center bg-[#e8e2d9]", className)}>
      <ImageIcon size={32} strokeWidth={1.25} className="text-[#d4ccc2]" />
    </div>
  );
};

export default ProductImagePlaceholder;
