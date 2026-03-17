import { storeConfig } from "@/config/store.config";

export const getWhatsAppContactLink = () => {
  const phone = storeConfig.contact.whatsapp.replace(/[^\d]/g, "");
  const message = `Hello, I have a general enquiry about ${storeConfig.storeName}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};
