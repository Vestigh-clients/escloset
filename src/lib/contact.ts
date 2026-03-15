export const getWhatsAppContactLink = () => {
  const message = "Hello, I have a general enquiry about Luxuriant.";
  return `https://wa.me/233594817032?text=${encodeURIComponent(message)}`;
};
