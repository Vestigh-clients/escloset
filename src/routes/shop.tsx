import Shop from "../pages/Shop";
import { storeConfig } from "../config/store.config";
import { buildCanonicalUrl, toAbsoluteUrl } from "../lib/seo";
import { fetchShopPageData, type ShopPageData } from "../lib/ssgData";

export const loader = async () => fetchShopPageData();

export const links = () => [{ rel: "canonical", href: buildCanonicalUrl("/shop") }];

export const meta = () => {
  const title = `Shop - ${storeConfig.storeName}`;
  const description = "Browse new arrivals, best sellers, and curated fashion pieces from E&S Closet.";
  const image = toAbsoluteUrl(storeConfig.faviconUrl);

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: image },
  ];
};

export default function ShopRoute({ loaderData }: { loaderData: ShopPageData }) {
  return <Shop initialProducts={loaderData.products} initialCategories={loaderData.categories} />;
}
