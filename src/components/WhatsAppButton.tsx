import { MessageCircle } from "lucide-react";
import { getWhatsAppContactLink } from "@/lib/contact";

const WhatsAppButton = () => {
  return (
    <a
      href={getWhatsAppContactLink()}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[hsl(142,70%,45%)] text-card shadow-lg hover:scale-110 transition-transform duration-200"
      aria-label="Contact us on WhatsApp"
    >
      <MessageCircle size={28} fill="currentColor" />
    </a>
  );
};

export default WhatsAppButton;

