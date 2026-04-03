import authPanelImage from "@/assets/hero-bg.jpg";

export interface HomeHeroSlideConfig {
  id: string;
  imageUrl: string;
  imageAlt: string;
  label: string;
  heading: string;
  subtext: string;
  cta: {
    text: string;
    href: string;
    tone: "outline" | "primary" | "accent";
  };
}

export interface ContentConfig {
  home: {
    heroSlides: HomeHeroSlideConfig[];
    collectionsEyebrow: string;
    collectionsTitle: string;
    collectionsDescription: string;
    categoryCardCtaLabel: string;
  };
  footer: {
    description: string;
    shopLinks: Array<{ label: string; href: string }>;
    companyLinks: Array<{ label: string; href: string }>;
  };
  auth: {
    panelImageUrl: string;
    panelImageAlt: string;
  };
  about: {
    body: string;
    intro: string;
    stats: Array<{ value: string; label: string }>;
  };
}

export const contentConfig: ContentConfig = {
  home: {
    heroSlides: [
      {
        id: "hair-care",
        imageUrl: "/images/hero-haircare.jpg",
        imageAlt: "Hair care collection",
        label: "HAIR CARE COLLECTION",
        heading: "Rituals for your most luxurious self.",
        subtext: "Premium formulas for healthy, beautiful hair.",
        cta: {
          text: "Shop Hair Care",
          href: "/shop",
          tone: "outline",
        },
      },
      {
        id: "mens-fashion",
        imageUrl: "/images/hero-men.jpg",
        imageAlt: "Men's fashion collection",
        label: "MEN'S COLLECTION",
        heading: "Dressed with intention. Built to last.",
        subtext: "Elevated essentials for the modern wardrobe.",
        cta: {
          text: "Shop Men",
          href: "/shop",
          tone: "primary",
        },
      },
      {
        id: "womens-fashion",
        imageUrl: "/images/hero-women.jpg",
        imageAlt: "Women's fashion collection",
        label: "WOMEN'S COLLECTION",
        heading: "Worn with intention. Made to last.",
        subtext: "Timeless pieces for the discerning woman.",
        cta: {
          text: "Explore Women",
          href: "/shop",
          tone: "outline",
        },
      },
      {
        id: "bags",
        imageUrl: "/images/hero-bags.jpg",
        imageAlt: "Bag collection",
        label: "BAG COLLECTION",
        heading: "Carry something worth noticing.",
        subtext: "Handcrafted leather and refined silhouettes.",
        cta: {
          text: "Shop Bags",
          href: "/shop",
          tone: "accent",
        },
      },
      {
        id: "shoes",
        imageUrl: "/images/hero-shoes.jpg",
        imageAlt: "Footwear collection",
        label: "FOOTWEAR COLLECTION",
        heading: "Stand in something worth remembering.",
        subtext: "Every step, considered.",
        cta: {
          text: "Shop Shoes",
          href: "/shop",
          tone: "primary",
        },
      },
    ],
    collectionsEyebrow: "Our Collections",
    collectionsTitle: "Shop by Category",
    collectionsDescription: "Considered categories for wardrobe staples, elevated accessories, and restorative hair care.",
    categoryCardCtaLabel: "Shop Now ->",
  },
  footer: {
    description: "Luxury fashion essentials, curated for your store.",
    shopLinks: [
      { label: "Hair Care", href: "/shop" },
      { label: "Men's Fashion", href: "/shop" },
      { label: "Women's Fashion", href: "/shop" },
      { label: "Bags", href: "/shop" },
      { label: "Shoes", href: "/shop" },
    ],
    companyLinks: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  auth: {
    panelImageUrl: authPanelImage,
    panelImageAlt: "Brand visual",
  },
  about: {
    body: "",
    intro: "is designed for modern stores that want polished branding and a seamless customer journey.",
    stats: [
      { value: "500+", label: "Happy Customers" },
      { value: "50+", label: "Premium Products" },
      { value: "36", label: "Regions Served" },
    ],
  },
};
