import About from "../pages/About";
import { storeConfig } from "../config/store.config";
import { buildCanonicalUrl, toAbsoluteUrl } from "../lib/seo";

export const links = () => [{ rel: "canonical", href: buildCanonicalUrl("/about") }];

export const meta = () => {
  const title = `About - ${storeConfig.storeName}`;
  const description = "Learn the story behind E&S Closet, a fashion brand built from friendship, purpose, and style.";
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

export default function AboutRoute() {
  return <About />;
}
