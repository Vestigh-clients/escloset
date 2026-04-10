import Contact from "../pages/Contact";
import { storeConfig } from "../config/store.config";
import { buildCanonicalUrl, toAbsoluteUrl } from "../lib/seo";

export const links = () => [{ rel: "canonical", href: buildCanonicalUrl("/contact") }];

export const meta = () => {
  const title = `Contact - ${storeConfig.storeName}`;
  const description = "Contact E&S Closet for sizing, delivery, order support, and collaborations.";
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

export default function ContactRoute() {
  return <Contact />;
}
