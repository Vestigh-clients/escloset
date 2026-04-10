import ProductPage from "../pages/ProductPage";
import { storeConfig } from "../config/store.config";
import {
  buildCanonicalUrl,
  buildProductJsonLd,
  getProductDescription,
  serializeJsonLd,
  toAbsoluteUrl,
} from "../lib/seo";
import { fetchProductPageData, type ProductPageData } from "../lib/ssgData";
import { getPrimaryImage } from "../types/product";

export const loader = async ({ params }: { params: { slug?: string } }) => fetchProductPageData(params.slug);

export const meta = ({ data }: { data?: ProductPageData }) => {
  if (!data?.product) {
    return [{ title: `Product - ${storeConfig.storeName}` }];
  }

  const { product } = data;
  const title = `${product.name} - ${storeConfig.storeName}`;
  const description = getProductDescription(product);
  const canonical = buildCanonicalUrl(`/shop/${product.slug}`);
  const image = toAbsoluteUrl(getPrimaryImage(product) || storeConfig.faviconUrl);

  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "product" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonical },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: image },
    { tagName: "link", rel: "canonical", href: canonical },
  ];
};

export default function ProductRoute({ loaderData }: { loaderData: ProductPageData }) {
  const jsonLd = buildProductJsonLd(loaderData.product);

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      ) : null}
      <ProductPage
        initialProduct={loaderData.product}
        initialRelatedProducts={loaderData.relatedProducts}
      />
    </>
  );
}
