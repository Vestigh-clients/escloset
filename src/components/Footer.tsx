import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";
import { getWhatsAppContactLink } from "@/data/products";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <h3 className="font-display text-2xl font-bold tracking-wider mb-2">LUXURIANT</h3>
            <p className="font-body text-xs italic text-primary-foreground/60 mb-3">Satisfaction Our Hallmark</p>
            <p className="font-body text-sm text-primary-foreground/70 leading-relaxed">
              Luxury Fashion & Hair Care — Global and Nationwide Delivery.
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold mb-4 tracking-wider uppercase">Shop</h4>
            <div className="flex flex-col gap-2">
              <Link to="/category/hair-care" className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors">Hair Care</Link>
              <Link to="/category/mens-fashion" className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors">Men's Fashion</Link>
              <Link to="/category/womens-fashion" className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors">Women's Fashion</Link>
              <Link to="/category/bags" className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors">Bags</Link>
              <Link to="/category/shoes" className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors">Shoes</Link>
            </div>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold mb-4 tracking-wider uppercase">Company</h4>
            <div className="flex flex-col gap-2">
              <Link to="/about" className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors">About</Link>
              <Link to="/contact" className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors">Contact</Link>
            </div>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold mb-4 tracking-wider uppercase">Connect</h4>
            <div className="flex flex-col gap-3">
              <a href={getWhatsAppContactLink()} target="_blank" rel="noopener noreferrer" className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors">
                WhatsApp: 0594817032
              </a>
              <a href="https://instagram.com/torriefebri" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors flex items-center gap-2">
                <Instagram size={16} /> @Torrie Febri
              </a>
              <a href="https://tiktok.com/@torrie" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors">
                TikTok: @TORRIE
              </a>
              <a href="https://facebook.com/luxuriant" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors">
                Facebook: Luxuriant
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-12 pt-8 text-center">
          <p className="font-body text-xs text-primary-foreground/50">
            © {new Date().getFullYear()} Luxuriant. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
