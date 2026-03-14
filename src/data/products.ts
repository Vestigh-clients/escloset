export type Category = "hair-care" | "mens-fashion" | "womens-fashion" | "bags" | "shoes";

export interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  sku: string | null;
  stock_quantity: number;
  is_available: boolean;
  category: Category;
  description: string;
  benefits: string[];
  images: string[];
  isBestSeller?: boolean;
  isFeatured?: boolean;
}

export const categoryLabels: Record<Category, string> = {
  "hair-care": "Hair Care",
  "mens-fashion": "Men's Fashion",
  "womens-fashion": "Women's Fashion",
  "bags": "Bags",
  "shoes": "Shoes",
};

export const categoryDescriptions: Record<Category, string> = {
  "hair-care": "Premium natural hair care products for healthy, beautiful hair.",
  "mens-fashion": "Sophisticated menswear for the modern gentleman.",
  "womens-fashion": "Elegant pieces crafted for the contemporary woman.",
  "bags": "Luxurious bags that make a statement.",
  "shoes": "Step into luxury with our curated footwear collection.",
};

export const products: Product[] = [
  // Hair Care
  {
    id: "hc-001",
    slug: "hydrating-hair-oil",
    name: "Hydrating Hair Oil",
    price: 4500,
    compare_at_price: 5200,
    sku: "LUX-HC-001",
    stock_quantity: 24,
    is_available: true,
    category: "hair-care",
    description: "A luxurious blend of argan, jojoba, and coconut oils that deeply nourishes and revitalizes your hair from root to tip.",
    benefits: ["Deep hydration", "Reduces frizz", "Adds brilliant shine", "Strengthens hair"],
    images: [],
    isBestSeller: true,
    isFeatured: true,
  },
  {
    id: "hc-002",
    slug: "silk-protein-shampoo",
    name: "Silk Protein Shampoo",
    price: 3800,
    compare_at_price: null,
    sku: "LUX-HC-002",
    stock_quantity: 18,
    is_available: true,
    category: "hair-care",
    description: "Gentle, sulfate-free shampoo infused with silk proteins for incredibly smooth and manageable hair.",
    benefits: ["Sulfate-free formula", "Silk protein enriched", "Color safe", "For all hair types"],
    images: [],
    isFeatured: true,
  },
  {
    id: "hc-003",
    slug: "deep-conditioning-mask",
    name: "Deep Conditioning Mask",
    price: 5200,
    compare_at_price: 6000,
    sku: "LUX-HC-003",
    stock_quantity: 15,
    is_available: true,
    category: "hair-care",
    description: "An intensive treatment mask that restores moisture and elasticity to damaged or dry hair.",
    benefits: ["Intensive repair", "72-hour moisture", "Keratin infused", "Heat protection"],
    images: [],
    isBestSeller: true,
  },
  {
    id: "hc-004",
    slug: "leave-in-conditioner-spray",
    name: "Leave-In Conditioner Spray",
    price: 3200,
    compare_at_price: null,
    sku: "LUX-HC-004",
    stock_quantity: 9,
    is_available: true,
    category: "hair-care",
    description: "Lightweight leave-in spray that detangles and protects hair throughout the day.",
    benefits: ["Easy detangling", "UV protection", "Lightweight formula", "All-day moisture"],
    images: [],
  },
  // Men's Fashion
  {
    id: "mf-001",
    slug: "classic-tailored-blazer",
    name: "Classic Tailored Blazer",
    price: 28000,
    compare_at_price: 32000,
    sku: "LUX-MF-001",
    stock_quantity: 12,
    is_available: true,
    category: "mens-fashion",
    description: "A timeless tailored blazer crafted from premium wool blend fabric. Perfect for formal occasions and elevated everyday wear.",
    benefits: ["Premium wool blend", "Tailored fit", "Fully lined", "Two-button closure"],
    images: [],
    isBestSeller: true,
    isFeatured: true,
  },
  {
    id: "mf-002",
    slug: "slim-fit-chinos",
    name: "Slim Fit Chinos",
    price: 12000,
    compare_at_price: null,
    sku: "LUX-MF-002",
    stock_quantity: 20,
    is_available: true,
    category: "mens-fashion",
    description: "Versatile slim-fit chinos made from stretch cotton for ultimate comfort and style.",
    benefits: ["Stretch cotton", "Slim fit", "Wrinkle resistant", "Multiple colors"],
    images: [],
  },
  {
    id: "mf-003",
    slug: "premium-cotton-shirt",
    name: "Premium Cotton Shirt",
    price: 9500,
    compare_at_price: 11000,
    sku: "LUX-MF-003",
    stock_quantity: 11,
    is_available: true,
    category: "mens-fashion",
    description: "Crisp Egyptian cotton dress shirt with a modern spread collar and tailored fit.",
    benefits: ["Egyptian cotton", "Easy iron", "Mother of pearl buttons", "Tailored fit"],
    images: [],
    isFeatured: true,
  },
  // Women's Fashion
  {
    id: "wf-001",
    slug: "silk-wrap-dress",
    name: "Silk Wrap Dress",
    price: 35000,
    compare_at_price: 39000,
    sku: "LUX-WF-001",
    stock_quantity: 8,
    is_available: true,
    category: "womens-fashion",
    description: "An elegant silk wrap dress that drapes beautifully, perfect for both day and evening occasions.",
    benefits: ["100% silk", "Flattering wrap style", "Adjustable fit", "Dry clean only"],
    images: [],
    isBestSeller: true,
    isFeatured: true,
  },
  {
    id: "wf-002",
    slug: "cashmere-cardigan",
    name: "Cashmere Cardigan",
    price: 22000,
    compare_at_price: null,
    sku: "LUX-WF-002",
    stock_quantity: 14,
    is_available: true,
    category: "womens-fashion",
    description: "Luxuriously soft cashmere cardigan for effortless layering and everyday elegance.",
    benefits: ["Pure cashmere", "Relaxed fit", "Ribbed trim", "Sustainably sourced"],
    images: [],
  },
  {
    id: "wf-003",
    slug: "high-waist-tailored-trousers",
    name: "High-Waist Tailored Trousers",
    price: 16000,
    compare_at_price: 19000,
    sku: "LUX-WF-003",
    stock_quantity: 16,
    is_available: true,
    category: "womens-fashion",
    description: "Sophisticated high-waist trousers with a wide leg silhouette for a polished look.",
    benefits: ["High waist", "Wide leg", "Crease-resistant", "Side pockets"],
    images: [],
    isFeatured: true,
  },
  // Bags
  {
    id: "bg-001",
    slug: "leather-tote-bag",
    name: "Leather Tote Bag",
    price: 42000,
    compare_at_price: 46000,
    sku: "LUX-BG-001",
    stock_quantity: 6,
    is_available: true,
    category: "bags",
    description: "A spacious leather tote crafted from full-grain Italian leather with gold-tone hardware.",
    benefits: ["Full-grain leather", "Gold hardware", "Interior pockets", "Dust bag included"],
    images: [],
    isBestSeller: true,
    isFeatured: true,
  },
  {
    id: "bg-002",
    slug: "crossbody-mini-bag",
    name: "Crossbody Mini Bag",
    price: 18000,
    compare_at_price: null,
    sku: "LUX-BG-002",
    stock_quantity: 10,
    is_available: true,
    category: "bags",
    description: "Compact crossbody bag perfect for essentials, featuring an adjustable chain strap.",
    benefits: ["Compact design", "Chain strap", "Card slots", "Magnetic closure"],
    images: [],
  },
  {
    id: "bg-003",
    slug: "structured-clutch",
    name: "Structured Clutch",
    price: 15000,
    compare_at_price: 17500,
    sku: "LUX-BG-003",
    stock_quantity: 7,
    is_available: true,
    category: "bags",
    description: "An elegant structured clutch for evening occasions with a detachable wrist strap.",
    benefits: ["Evening wear", "Satin lining", "Detachable strap", "Gold clasp"],
    images: [],
    isBestSeller: true,
  },
  // Shoes
  {
    id: "sh-001",
    slug: "classic-leather-loafers",
    name: "Classic Leather Loafers",
    price: 24000,
    compare_at_price: 27000,
    sku: "LUX-SH-001",
    stock_quantity: 13,
    is_available: true,
    category: "shoes",
    description: "Handcrafted leather loafers with a comfortable cushioned insole and elegant design.",
    benefits: ["Handcrafted", "Cushioned insole", "Leather sole", "Slip-on style"],
    images: [],
    isBestSeller: true,
    isFeatured: true,
  },
  {
    id: "sh-002",
    slug: "strappy-heeled-sandals",
    name: "Strappy Heeled Sandals",
    price: 19000,
    compare_at_price: null,
    sku: "LUX-SH-002",
    stock_quantity: 5,
    is_available: true,
    category: "shoes",
    description: "Elegant strappy sandals with a comfortable block heel, perfect for evening wear.",
    benefits: ["Block heel", "Ankle strap", "Padded footbed", "Versatile design"],
    images: [],
    isFeatured: true,
  },
  {
    id: "sh-003",
    slug: "suede-chelsea-boots",
    name: "Suede Chelsea Boots",
    price: 28000,
    compare_at_price: 31000,
    sku: "LUX-SH-003",
    stock_quantity: 4,
    is_available: true,
    category: "shoes",
    description: "Premium suede Chelsea boots with elastic side panels and a sleek silhouette.",
    benefits: ["Premium suede", "Elastic panels", "Stacked heel", "Pull tab"],
    images: [],
  },
];

export const getProductsByCategory = (category: Category) =>
  products.filter((p) => p.category === category);

export const getFeaturedProducts = () => products.filter((p) => p.isFeatured);

export const getBestSellers = () => products.filter((p) => p.isBestSeller);

export const getProductById = (id: string) => products.find((p) => p.id === id);

export const formatPrice = (price: number) =>
  `\u20A6${price.toLocaleString("en-NG")}`;

export const getWhatsAppContactLink = () => {
  const message = "Hello, I have a general enquiry about Luxuriant.";
  return `https://wa.me/233594817032?text=${encodeURIComponent(message)}`;
};
