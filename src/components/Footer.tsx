import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { contentConfig } from "@/config/content.config";
import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { buildWhatsAppContactLink } from "@/lib/contact";

type FooterLink = {
  label: string;
  href: string;
};

const isAbsoluteUrl = (href: string) => /^https?:\/\//i.test(href);
const isSpecialProtocol = (href: string) => href.startsWith("mailto:") || href.startsWith("tel:");

const Footer = () => {
  const { storefrontConfig, storefrontCategories } = useStorefrontConfig();
  const navigate = useNavigate();
  const [newsletterEmail, setNewsletterEmail] = useState("");

  const quickLinks = useMemo<FooterLink[]>(() => {
    return storefrontCategories.slice(0, 6).map((category) => ({
      label: category.name.trim() || "Category",
      href: `/shop?category=${encodeURIComponent(category.slug)}`,
    }));
  }, [storefrontCategories]);

  const companyLinks = useMemo<FooterLink[]>(() => {
    const fromConfig = contentConfig.footer.companyLinks
      .map((link) => ({ label: link.label.trim(), href: link.href.trim() }))
      .filter((link) => Boolean(link.label) && Boolean(link.href));

    const supportLinks: FooterLink[] = [];

    if (storefrontConfig.contact.whatsapp.trim()) {
      supportLinks.push({
        label: "WhatsApp Support",
        href: buildWhatsAppContactLink(storefrontConfig.storeName, storefrontConfig.contact.whatsapp),
      });
    }

    if (storefrontConfig.contact.email.trim()) {
      supportLinks.push({
        label: "Email Us",
        href: `mailto:${storefrontConfig.contact.email.trim()}`,
      });
    }

    if (storefrontConfig.contact.phone.trim()) {
      supportLinks.push({
        label: "Call Us",
        href: `tel:${storefrontConfig.contact.phone.trim()}`,
      });
    }

    return [...fromConfig, ...supportLinks];
  }, [storefrontConfig.contact.email, storefrontConfig.contact.phone, storefrontConfig.contact.whatsapp, storefrontConfig.storeName]);

  const socialLinks = useMemo<FooterLink[]>(() => {
    const entries = [
      { label: "Instagram", href: storefrontConfig.socials.instagram.trim(), icon: "photo_camera" },
      { label: "Facebook", href: storefrontConfig.socials.facebook.trim(), icon: "thumb_up" },
      { label: "Twitter", href: storefrontConfig.socials.twitter.trim(), icon: "alternate_email" },
      { label: "TikTok", href: storefrontConfig.socials.tiktok.trim(), icon: "music_note" },
    ].filter((item) => Boolean(item.href));

    const seen = new Set<string>();
    return entries.filter((item) => {
      if (seen.has(item.href)) {
        return false;
      }
      seen.add(item.href);
      return true;
    });
  }, [storefrontConfig.socials.facebook, storefrontConfig.socials.instagram, storefrontConfig.socials.tiktok, storefrontConfig.socials.twitter]);

  const renderLink = (link: FooterLink, className: string) => {
    if (isAbsoluteUrl(link.href) || isSpecialProtocol(link.href)) {
      const opensNewTab = isAbsoluteUrl(link.href);

      return (
        <a
          href={link.href}
          className={className}
          target={opensNewTab ? "_blank" : undefined}
          rel={opensNewTab ? "noopener noreferrer" : undefined}
        >
          {link.label}
        </a>
      );
    }

    return (
      <Link to={link.href.startsWith("/") ? link.href : `/${link.href}`} className={className}>
        {link.label}
      </Link>
    );
  };

  const handleNewsletterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = newsletterEmail.trim();
    if (!normalizedEmail) {
      return;
    }

    const supportEmail = storefrontConfig.contact.email.trim();
    if (!supportEmail) {
      navigate("/contact");
      return;
    }

    const subject = encodeURIComponent(`${storefrontConfig.storeName} newsletter signup`);
    const body = encodeURIComponent(`Please add this email to the newsletter list:\n\n${normalizedEmail}`);
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
    setNewsletterEmail("");
  };

  return (
    <footer className="w-full bg-[#F3F3F4]">
      <div className="grid w-full grid-cols-1 gap-12 px-6 py-16 md:grid-cols-4 md:px-12">
        <div className="col-span-1">
          <div className="mb-6 font-notoSerif text-lg font-bold text-[#D81B60]">{storefrontConfig.storeName}</div>
          <p className="max-w-xs font-manrope text-xs font-light leading-relaxed text-[#5E5E5E]">{contentConfig.footer.description}</p>
        </div>

        <div>
          <h5 className="mb-6 font-manrope text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">Quick Links</h5>
          <ul className="space-y-4">
            {quickLinks.map((link) => (
              <li key={`${link.label}-${link.href}`}>
                {renderLink(link, "font-manrope text-xs text-[#5E5E5E] transition-colors hover:text-[#D81B60]")}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5 className="mb-6 font-manrope text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">Company</h5>
          <ul className="space-y-4">
            {companyLinks.map((link) => (
              <li key={`${link.label}-${link.href}`}>
                {renderLink(link, "font-manrope text-xs text-[#5E5E5E] transition-colors hover:text-[#D81B60]")}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5 className="mb-6 font-manrope text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">Newsletter</h5>
          <p className="mb-4 font-manrope text-xs font-light text-[#5E5E5E]">Join our inner circle for exclusive drops.</p>
          <form onSubmit={handleNewsletterSubmit} className="flex items-end gap-3">
            <input
              type="email"
              value={newsletterEmail}
              onChange={(event) => setNewsletterEmail(event.target.value)}
              required
              placeholder="Email Address"
              className="w-full border-b border-[rgba(227,189,199,0.15)] bg-transparent pb-2 font-manrope text-xs text-[#1A1C1C] placeholder:text-[#8f6e78] focus:border-[#D81B60] focus:border-b-2 focus:outline-none"
            />
            <button
              type="submit"
              className="bg-[#D81B60] px-4 py-2 font-manrope text-xs font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-[#B0004A]"
            >
              JOIN
            </button>
          </form>
        </div>
      </div>

      <div className="px-6 pb-8 md:px-12">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="font-manrope text-xs text-[#5E5E5E]">
            &copy; {new Date().getFullYear()} {storefrontConfig.storeName}. All rights reserved.
          </p>
          {socialLinks.length > 0 ? (
            <div className="flex gap-6">
              {socialLinks.map((social) => (
                <a
                  key={`${social.label}-${social.href}`}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="inline-flex text-[#5E5E5E] transition-colors hover:text-[#D81B60]"
                >
                  <span className="material-symbols-outlined">
                    {social.label === "Instagram"
                      ? "photo_camera"
                      : social.label === "Facebook"
                        ? "thumb_up"
                        : social.label === "Twitter"
                          ? "alternate_email"
                          : "music_note"}
                  </span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
