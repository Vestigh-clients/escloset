import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, Twitter } from "lucide-react";
import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { buildWhatsAppContactLink } from "@/lib/contact";

interface ContactChannel {
  label: string;
  value: string;
  href: string;
  description: string;
  icon: "whatsapp" | "phone" | "email" | "address";
}

interface SocialChannel {
  label: string;
  href: string;
  value: string;
}

const toDisplayHandle = (value: string): string => {
  if (!value) return "";
  if (value.startsWith("http")) {
    try {
      const url = new URL(value);
      return url.pathname.replace(/^\/+/, "") || url.hostname;
    } catch {
      return value;
    }
  }
  return value;
};

const iconForChannel = (icon: ContactChannel["icon"]) => {
  if (icon === "whatsapp") return <MessageCircle size={20} />;
  if (icon === "phone") return <Phone size={20} />;
  if (icon === "email") return <Mail size={20} />;
  return <MapPin size={20} />;
};

const Contact = () => {
  const { storefrontConfig } = useStorefrontConfig();

  const fullAddress = [storefrontConfig.contact.address, storefrontConfig.contact.city, storefrontConfig.contact.country]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");

  const contactChannels: ContactChannel[] = [
    storefrontConfig.contact.whatsapp.trim()
      ? {
          label: "WhatsApp",
          value: storefrontConfig.contact.whatsapp.trim(),
          href: buildWhatsAppContactLink(storefrontConfig.storeName, storefrontConfig.contact.whatsapp),
          description: "Fast support for order and product enquiries.",
          icon: "whatsapp",
        }
      : null,
    storefrontConfig.contact.phone.trim()
      ? {
          label: "Phone",
          value: storefrontConfig.contact.phone.trim(),
          href: `tel:${storefrontConfig.contact.phone.trim()}`,
          description: "Speak directly with our support team.",
          icon: "phone",
        }
      : null,
    storefrontConfig.contact.email.trim()
      ? {
          label: "Email",
          value: storefrontConfig.contact.email.trim(),
          href: `mailto:${storefrontConfig.contact.email.trim()}`,
          description: "Best for detailed enquiries and collaborations.",
          icon: "email",
        }
      : null,
    fullAddress
      ? {
          label: "Location",
          value: fullAddress,
          href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`,
          description: "Visit us or locate our showroom on the map.",
          icon: "address",
        }
      : null,
  ].filter((entry): entry is ContactChannel => Boolean(entry));

  const socialChannels: SocialChannel[] = [
    {
      label: "Instagram",
      href: storefrontConfig.socials.instagram.trim(),
      value: toDisplayHandle(storefrontConfig.socials.instagram.trim()),
    },
    {
      label: "Facebook",
      href: storefrontConfig.socials.facebook.trim(),
      value: toDisplayHandle(storefrontConfig.socials.facebook.trim()),
    },
    {
      label: "Twitter",
      href: storefrontConfig.socials.twitter.trim(),
      value: toDisplayHandle(storefrontConfig.socials.twitter.trim()),
    },
    {
      label: "TikTok",
      href: storefrontConfig.socials.tiktok.trim(),
      value: toDisplayHandle(storefrontConfig.socials.tiktok.trim()),
    },
  ].filter((entry) => Boolean(entry.href));

  const hasAnyDirectChannel = contactChannels.length > 0;

  return (
    <div className="bg-[#F9F9F9] font-manrope text-[#1A1C1C]">
      <header className="relative overflow-hidden border-b border-[#dde2e6] bg-gradient-to-br from-[#ffffff] via-[#f5f7f8] to-[#f9f9f9]">
        <div className="absolute -left-20 top-16 h-52 w-52 rounded-full bg-[#e9ecef] blur-3xl" />
        <div className="absolute -right-20 bottom-2 h-56 w-56 rounded-full bg-[#f7d0df] blur-3xl" />
        <div className="relative mx-auto max-w-screen-2xl px-4 pb-14 pt-16 md:px-8 md:pb-20 md:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">Contact Us</p>
          <h1 className="mt-3 font-notoSerif text-5xl font-bold leading-[0.95] text-[#1A1C1C] md:text-7xl">
            Let&apos;s <span className="italic text-[#D81B60]">Talk</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#5E5E5E] md:text-lg">
            Questions about sizing, delivery, orders, or collaborations? Reach out through any of our channels and we&apos;ll help quickly.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-12 md:px-8 md:py-16">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-8">
            {hasAnyDirectChannel ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {contactChannels.map((channel) => (
                  <a
                    key={channel.label}
                    href={channel.href}
                    target={channel.icon === "address" ? "_blank" : undefined}
                    rel={channel.icon === "address" ? "noopener noreferrer" : undefined}
                    className="group rounded-[8px] border border-[#e3bdc7] bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#D81B60] hover:shadow-[0_16px_28px_rgba(26,28,28,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dfe3e6] bg-[#f5f7f8] text-[#B0004A] transition-colors group-hover:border-[#D81B60] group-hover:text-[#D81B60]">
                        {iconForChannel(channel.icon)}
                      </div>
                      <span className="rounded-full border border-[#e1e5e8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B0004A]">
                        {channel.label}
                      </span>
                    </div>
                    <p className="mt-4 font-notoSerif text-lg font-bold text-[#1A1C1C]">{channel.value}</p>
                    <p className="mt-2 text-sm leading-relaxed text-[#5E5E5E]">{channel.description}</p>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-[8px] border border-dashed border-[#e3bdc7] bg-white p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B0004A]">Contact Info Coming Soon</p>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#5E5E5E]">
                  Our direct support channels are being updated. Please check back shortly or reach us through social media in the meantime.
                </p>
              </div>
            )}

            <div className="mt-6 rounded-[8px] border border-[#e3bdc7] bg-[#1A1C1C] p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f5a3c2]">Support Hours</p>
              <h2 className="mt-2 font-notoSerif text-3xl font-bold">We Reply Fast</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                Monday to Saturday, 9:00 AM to 7:00 PM (GMT). We usually respond on WhatsApp and email within the same day.
              </p>
            </div>
          </div>

          <aside className="space-y-6 lg:col-span-4">
            <div className="rounded-[8px] border border-[#e3bdc7] bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B0004A]">Need Immediate Help?</p>
              <h3 className="mt-2 font-notoSerif text-2xl font-bold text-[#1A1C1C]">Quick Routes</h3>
              <div className="mt-4 space-y-3">
                {storefrontConfig.contact.whatsapp.trim() ? (
                  <a
                    href={buildWhatsAppContactLink(storefrontConfig.storeName, storefrontConfig.contact.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-md border border-[#e1e5e8] px-4 py-3 text-sm text-[#1A1C1C] transition-colors hover:border-[#D81B60] hover:text-[#B0004A]"
                  >
                    <span>Chat on WhatsApp</span>
                    <MessageCircle size={16} />
                  </a>
                ) : null}
                {storefrontConfig.contact.email.trim() ? (
                  <a
                    href={`mailto:${storefrontConfig.contact.email.trim()}`}
                    className="flex items-center justify-between rounded-md border border-[#e1e5e8] px-4 py-3 text-sm text-[#1A1C1C] transition-colors hover:border-[#D81B60] hover:text-[#B0004A]"
                  >
                    <span>Send an Email</span>
                    <Mail size={16} />
                  </a>
                ) : null}
                <a
                  href="/shop"
                  className="flex items-center justify-between rounded-md border border-[#e1e5e8] px-4 py-3 text-sm text-[#1A1C1C] transition-colors hover:border-[#D81B60] hover:text-[#B0004A]"
                >
                  <span>Continue Shopping</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </a>
              </div>
            </div>

            <div className="rounded-[8px] border border-[#e3bdc7] bg-[#f5f7f8] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B0004A]">Follow Us</p>
              {socialChannels.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {socialChannels.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-md border border-[#e1e5e8] bg-white px-4 py-3 text-sm text-[#1A1C1C] transition-colors hover:border-[#D81B60] hover:text-[#B0004A]"
                    >
                      <span className="flex items-center gap-2">
                        {social.label === "Instagram" ? <Instagram size={15} /> : null}
                        {social.label === "Facebook" ? <Facebook size={15} /> : null}
                        {social.label === "Twitter" ? <Twitter size={15} /> : null}
                        {social.label === "TikTok" ? <span className="material-symbols-outlined text-[15px]">music_note</span> : null}
                        {social.label}
                      </span>
                      <span className="max-w-[130px] truncate text-xs text-[#6A6A6A]">{social.value || "View"}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-[#5E5E5E]">
                  Social links are currently being refreshed. Check again soon for our latest updates.
                </p>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
};

export default Contact;
