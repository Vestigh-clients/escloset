import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { buildAuthModalSearch, buildPathWithSearch } from "@/lib/authModal";

type NavItem = {
  key: string;
  label: string;
  to: string;
  type: "category" | "page";
  categorySlug?: string;
};

const CATEGORY_NAV_LIMIT = 4;

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { storefrontConfig, storefrontCategories } = useStorefrontConfig();
  const { openCart, totalItems } = useCart();
  const { isAuthenticated, isAdmin } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (location.pathname !== "/shop") {
      return;
    }

    setSearchValue(searchParams.get("q") ?? "");
  }, [location.pathname, searchParams]);

  const normalizedCategories = useMemo(() => {
    return storefrontCategories
      .map((category) => ({
        label: category.name.trim() || "Category",
        slug: category.slug.trim().toLowerCase(),
      }))
      .filter((category) => category.slug.length > 0);
  }, [storefrontCategories]);

  const categoryItems = useMemo(() => {
    const ordered = normalizedCategories.slice(0, CATEGORY_NAV_LIMIT);

    return ordered.map<NavItem>((category) => ({
      key: category.slug,
      label: category.label,
      to: `/shop?category=${encodeURIComponent(category.slug)}`,
      type: "category",
      categorySlug: category.slug,
    }));
  }, [normalizedCategories]);

  const navItems = useMemo<NavItem[]>(
    () => [
      ...categoryItems,
      { key: "about", label: "About", to: "/about", type: "page" },
      { key: "contact", label: "Contact", to: "/contact", type: "page" },
    ],
    [categoryItems],
  );

  const activeCategory = (searchParams.get("category") ?? "").trim().toLowerCase();

  const isItemActive = (item: NavItem, index: number) => {
    if (item.type === "page") {
      return location.pathname === item.to;
    }

    if (location.pathname === "/" && index === 0) {
      return true;
    }

    return location.pathname === "/shop" && activeCategory === (item.categorySlug ?? "");
  };

  const getDesktopLinkClass = (item: NavItem, index: number) => {
    const active = isItemActive(item, index);
    return [
      "whitespace-nowrap font-notoSerif text-sm tracking-wide uppercase border-b-2 pb-1 transition-colors leading-none",
      active ? "border-[#D81B60] text-[#D81B60]" : "border-transparent text-on-surface-variant hover:text-[#D81B60]",
    ].join(" ");
  };

  const getMobileLinkClass = (item: NavItem, index: number) => {
    const active = isItemActive(item, index);
    return [
      "font-notoSerif text-sm tracking-wide uppercase transition-colors",
      active ? "text-[#D81B60]" : "text-on-surface-variant hover:text-[#D81B60]",
    ].join(" ");
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextParams = new URLSearchParams();
    const requestedCategory = (searchParams.get("category") ?? "").trim().toLowerCase();
    if (location.pathname === "/shop" && requestedCategory && categoryItems.some((item) => item.categorySlug === requestedCategory)) {
      nextParams.set("category", requestedCategory);
    }

    const normalizedSearch = searchValue.trim();
    if (normalizedSearch.length > 0) {
      nextParams.set("q", normalizedSearch);
    }

    const query = nextParams.toString();
    navigate(query ? `/shop?${query}` : "/shop");
  };

  const accountRoute = useMemo(() => {
    if (isAuthenticated) {
      return "/account";
    }

    const authSearch = buildAuthModalSearch(location.search, {
      mode: "login",
      redirect: "/account",
    });
    return buildPathWithSearch(location.pathname, authSearch, location.hash);
  }, [isAuthenticated, location.hash, location.pathname, location.search]);

  return (
    <header className="bg-surface/80 dark:bg-zinc-950/80 docked full-width sticky top-0 z-50 w-full shadow-sm backdrop-blur-xl dark:shadow-none">
      <nav className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-6 py-4 md:px-8">
        <div className="flex min-w-0 items-center gap-6 lg:gap-8">
          <Link to="/" className="shrink-0 whitespace-nowrap font-notoSerif text-2xl italic font-bold text-on-background dark:text-white">
            {storefrontConfig.storeName}
          </Link>

          <div className="hidden md:flex items-center gap-5 lg:gap-6">
            {navItems.map((item, index) => (
              <Link key={item.key} to={item.to} className={getDesktopLinkClass(item, index)}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:gap-6">
          <form
            onSubmit={handleSearchSubmit}
            className="hidden lg:flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-lg"
          >
            <button type="submit" aria-label="Search products">
              <span className="material-symbols-outlined text-sm text-on-surface-variant">search</span>
            </button>
            <input
              type="text"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search..."
              className="w-32 bg-transparent border-none text-xs placeholder:text-on-surface-variant focus:ring-0 focus:outline-none"
            />
          </form>

          <div className="flex items-center gap-3 sm:gap-4 text-[#D81B60] dark:text-[#e9ecef]">
            {isAdmin ? (
              <Link
                to="/admin"
                aria-label="Open admin panel"
                className="hidden md:inline-flex items-center border border-[#D81B60] px-3 py-1.5 font-manrope text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D81B60] transition-colors hover:bg-[#D81B60] hover:text-white"
              >
                Admin
              </Link>
            ) : null}

            <button
              type="button"
              onClick={openCart}
              aria-label="Open cart"
              className="relative inline-flex hover:opacity-80 transition-all duration-300 active:scale-95"
            >
              <span className="material-symbols-outlined">shopping_bag</span>
              {totalItems > 0 ? (
                <span className="absolute -right-2 -top-1.5 inline-flex min-w-[16px] justify-center rounded-full bg-[#B0004A] px-1.5 py-[1px] font-manrope text-[9px] font-semibold text-white">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              ) : null}
            </button>

            <Link to={accountRoute} aria-label="Open account" className="inline-flex hover:opacity-80 transition-all duration-300 active:scale-95">
              <span className="material-symbols-outlined">person</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((previous) => !previous)}
              aria-label="Toggle mobile menu"
              className="md:hidden"
            >
              <span className="material-symbols-outlined text-on-surface">menu</span>
            </button>
          </div>
        </div>
      </nav>

      {isMobileMenuOpen ? (
        <div className="md:hidden bg-surface-container-low px-4 pb-4 pt-1 sm:px-8">
          <form onSubmit={handleSearchSubmit} className="mb-4 flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-lg">
            <button type="submit" aria-label="Search products">
              <span className="material-symbols-outlined text-sm text-on-surface-variant">search</span>
            </button>
            <input
              type="text"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent border-none text-xs placeholder:text-on-surface-variant focus:ring-0 focus:outline-none"
            />
          </form>

          <div className="flex flex-col gap-3">
            {navItems.map((item, index) => (
              <Link key={`mobile-${item.key}`} to={item.to} className={getMobileLinkClass(item, index)}>
                {item.label}
              </Link>
            ))}
            {isAdmin ? (
              <Link to="/admin" className="font-notoSerif text-sm tracking-wide uppercase text-[#D81B60]">
                Admin
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Navbar;
