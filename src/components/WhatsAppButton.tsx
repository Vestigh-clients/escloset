import { MessageCircle } from "lucide-react";
import { getWhatsAppContactLink } from "@/lib/contact";

const WhatsAppButton = () => {
  return (
    <a
      href={getWhatsAppContactLink()}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success)] text-card shadow-lg transition-transform duration-200 hover:scale-110"
      aria-label="Contact us on WhatsApp"
    >
      <MessageCircle size={28} fill="currentColor" />
    </a>
  );
};

export default WhatsAppButton;

