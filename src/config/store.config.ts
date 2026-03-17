import category_bags from "@/assets/category-bags.jpg";
import category_womens from "@/assets/category-womens.jpg";
import category_hair_care from "@/assets/category-haircare.jpg";
import category_shoes from "@/assets/category-shoes.jpg";
import category_men from "@/assets/category-mens.jpg";

export type BorderRadiusPreset = "sm" | "md" | "lg";
export type CurrencyPosition = "before" | "after";

export type CategoryConfig = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  enabled: boolean;
};

export type CategoryPageCopy = {
  heroDescription: string;
  editorialQuote: string;
  editorialDescription: string;
};

export type CategoryPageConfig = {
  bySlug: Record<string, Partial<CategoryPageCopy>>;
  defaults: CategoryPageCopy;
  uiText: {
    notFoundTitle: string;
    backToShopLabel: string;
    emptyCategoryMessage: string;
  };
};

export interface StoreConfig {
  storeName: string;
  storeTagline: string;
  logoUrl: string;
  faviconUrl: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    navbarSolidBackgroundColor: string;
    fontHeading: string;
    fontBody: string;
    borderRadius: BorderRadiusPreset;
  };
  contact: {
    email: string;
    phone: string;
    whatsapp: string;
    address: string;
    city: string;
    country: string;
  };
  socials: {
    instagram: string;
    facebook: string;
    twitter: string;
    tiktok: string;
  };
  currency: {
    code: string;
    symbol: string;
    position: CurrencyPosition;
  };
  features: {
    tryOn: boolean;
    guestCheckout: boolean;
    discountCodes: boolean;
    orderTracking: boolean;
    reviews: boolean;
    wishlist: boolean;
  };
  categories: CategoryConfig[];
  categoryPage: CategoryPageConfig;
  pages: {
    heroTitle: string;
    heroSubtitle: string;
    heroImageUrl: string;
    aboutText: string;
  };
  styleSyncs: {
    apiKey: string | undefined;
    apiUrl: string | undefined;
  };
}

export const storeConfig: StoreConfig = {
  storeName: "Vestigh Store",
  storeTagline: "Your store tagline",
  logoUrl: "assets/vicky_logo_white.png",
  faviconUrl: "/favicon.ico",
  theme: {
  primaryColor: "#243843",   // deep navy-teal used in the services panel
  secondaryColor: "#ffffff", // light grey background
  accentColor: "#4A5D66",    // muted steel blue derived from primary
  navbarSolidBackgroundColor: "#243843", // solid navbar background for non-hero pages
  fontHeading: "Playfair Display",
  fontBody: "Inter",
  borderRadius: "lg"         // rounded cards seen in the service grid
  },
  contact: {
    email: "hello@store.com",
    phone: "",
    whatsapp: "",
    address: "",
    city: "",
    country: "Ghana",
  },
  socials: {
    instagram: "",
    facebook: "",
    twitter: "",
    tiktok: "",
  },
  currency: {
    code: "GHS",
    symbol: "GH₵",
    position: "before",
  },
  features: {
    tryOn: true,
    guestCheckout: true,
    discountCodes: true,
    orderTracking: true,
    reviews: false,
    wishlist: false,
  },
  // Categories
  categories: [
    {
      name: "Hair Care",
      slug: "hair-care",
      description: "",
      imageUrl: category_hair_care,
      enabled: true,
    },
    {
      name: "Men's Fashion",
      slug: "mens-fashion",
      description: "",
      imageUrl: category_men,
      enabled: true,
    },
    {
      name: "Women's Fashion",
      slug: "womens-fashion",
      description: "",
      imageUrl: category_womens,
      enabled: true,
    },
    {
      name: "Shoes",
      slug: "shoes",
      description: "",
      imageUrl: category_shoes,
      enabled: true,
    },
    {
      name: "Bags",
      slug: "bags",
      description: "",
      imageUrl: category_bags,
      enabled: true,
    },
  ],
  categoryPage: {
    bySlug: {
      "hair-care": {
        heroDescription: "A focused edit of treatments and cleansers for healthy, luminous hair.",
        editorialQuote: "Yours hair deserves a ritual, not a routine.",
        editorialDescription: "Formulas selected for strength, softness, and long-term hair health.\nLuxury begins with consistency.",
      },
      "mens-fashion": {
        heroDescription: "Modern essentials for a precise and elevated wardrobe.",
        editorialQuote: "Built for the man who notices the details.",
        editorialDescription: "Tailored essentials shaped by clean lines and durable construction.\nA focused wardrobe for everyday confidence.",
      },
      "womens-fashion": {
        heroDescription: "Intentional pieces created for everyday elegance.",
        editorialQuote: "Worn with intention. Made to last.",
        editorialDescription: "Refined silhouettes designed to move between day and evening.\nQuiet confidence in every detail.",
      },
      bags: {
        heroDescription: "Distinctive bags designed for utility and style in equal measure.",
        editorialQuote: "The right bag changes everything.",
        editorialDescription: "Structured and soft forms curated for function and statement.\nCarry pieces that complete the look.",
      },
      shoes: {
        heroDescription: "Curated footwear designed for comfort, balance, and impact.",
        editorialQuote: "Stand in something worth remembering.",
        editorialDescription: "Footwear built for comfort, finish, and timeless wear.\nEvery step grounded in quality.",
      },
    },
    defaults: {
      heroDescription: "Explore this curated category from our latest collection.",
      editorialQuote: "Crafted with intention for your wardrobe.",
      editorialDescription: "Discover quality pieces designed for comfort, style, and lasting value.",
    },
    uiText: {
      notFoundTitle: "Category Not Found",
      backToShopLabel: "\u2190 Back to Shop",
      emptyCategoryMessage: "No products available in this category right now.",
    },
  },
  pages: {
    heroTitle: "Discover Your Style",
    heroSubtitle: "Shop the latest fashion",
    heroImageUrl: "/hero.jpg",
    aboutText: "",
  },
  styleSyncs: {
    apiKey: import.meta.env.VITE_STYLESYNC_API_KEY ?? import.meta.env.VITE_STYLESYNCS_API_KEY,
    apiUrl: import.meta.env.VITE_STYLESYNC_API_URL ?? import.meta.env.VITE_STYLESYNCS_BASE_URL,
  },
};

export const storeKeyPrefix = storeConfig.storeName
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");
