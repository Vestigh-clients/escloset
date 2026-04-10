import Index from "../pages/Index";
import { storeConfig } from "../config/store.config";
import { buildCanonicalUrl, toAbsoluteUrl } from "../lib/seo";
import { fetchHomePageData, type HomePageData } from "../lib/ssgData";

export const loader = async () => fetchHomePageData();

export const links = () => [{ rel: "canonical", href: buildCanonicalUrl("/") }];

export const meta = () => {
  const title = `${storeConfig.storeName} - Fashion in Ghana`;
  const description = "Shop stylish, carefully selected clothing from E&S Closet.";
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

export default function HomeRoute({ loaderData }: { loaderData: HomePageData }) {
  return (
    <Index
      initialNewArrivals={loaderData.newArrivals}
      initialBestSellers={loaderData.bestSellers}
      initialCategories={loaderData.categories}
    />
  );
}
