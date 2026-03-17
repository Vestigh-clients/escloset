import { Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import { storeConfig } from "@/config/store.config";
import { getWhatsAppContactLink } from "@/lib/contact";

interface FooterSocialLink {
  label: string;
  href: string;
}

const Footer = () => {
  const socialLinks: FooterSocialLink[] = [
    { label: "Instagram", href: storeConfig.socials.instagram },
    { label: "Facebook", href: storeConfig.socials.facebook },
    { label: "Twitter", href: storeConfig.socials.twitter },
    { label: "TikTok", href: storeConfig.socials.tiktok },
  ].filter((entry) => Boolean(entry.href.trim()));

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <h3 className="mb-2 font-display text-2xl font-bold tracking-wider">{storeConfig.storeName}</h3>
            <p className="mb-3 font-body text-xs italic text-primary-foreground/60">{storeConfig.storeTagline}</p>
            <p className="font-body text-sm leading-relaxed text-primary-foreground/70">
              Luxury fashion essentials, curated for your store.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider">Shop</h4>
            <div className="flex flex-col gap-2">
              <Link to="/category/hair-care" className="font-body text-sm text-primary-foreground/70 transition-colors hover:text-accent">
                Hair Care
              </Link>
              <Link
                to="/category/mens-fashion"
                className="font-body text-sm text-primary-foreground/70 transition-colors hover:text-accent"
              >
                Men's Fashion
              </Link>
              <Link
                to="/category/womens-fashion"
                className="font-body text-sm text-primary-foreground/70 transition-colors hover:text-accent"
              >
                Women's Fashion
              </Link>
              <Link to="/category/bags" className="font-body text-sm text-primary-foreground/70 transition-colors hover:text-accent">
                Bags
              </Link>
              <Link to="/category/shoes" className="font-body text-sm text-primary-foreground/70 transition-colors hover:text-accent">
                Shoes
              </Link>
            </div>
          </div>

          <div>
            <h4 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider">Company</h4>
            <div className="flex flex-col gap-2">
              <Link to="/about" className="font-body text-sm text-primary-foreground/70 transition-colors hover:text-accent">
                About
              </Link>
              <Link to="/contact" className="font-body text-sm text-primary-foreground/70 transition-colors hover:text-accent">
                Contact
              </Link>
            </div>
          </div>

          <div>
            <h4 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider">Connect</h4>
            <div className="flex flex-col gap-3">
              {storeConfig.contact.whatsapp ? (
                <a
                  href={getWhatsAppContactLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm text-primary-foreground/70 transition-colors hover:text-accent"
                >
                  WhatsApp: {storeConfig.contact.whatsapp}
                </a>
              ) : null}
              {storeConfig.contact.email ? (
                <a
                  href={`mailto:${storeConfig.contact.email}`}
                  className="font-body text-sm text-primary-foreground/70 transition-colors hover:text-accent"
                >
                  Email: {storeConfig.contact.email}
                </a>
              ) : null}
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 font-body text-sm text-primary-foreground/70 transition-colors hover:text-accent"
                >
                  {social.label === "Instagram" ? <Instagram size={16} /> : null}
                  {social.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-primary-foreground/20 pt-8 text-center">
          <p className="font-body text-xs text-primary-foreground/50">
            © {new Date().getFullYear()} {storeConfig.storeName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
