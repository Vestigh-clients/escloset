import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  layout("routes/public-layout.tsx", [
    index("routes/home.tsx"),
    route("shop", "routes/shop.tsx"),
    route("shop/:slug", "routes/product.tsx"),
    route("about", "routes/about.tsx"),
    route("contact", "routes/contact.tsx"),
  ]),
  layout("routes/spa-layout.tsx", [route("*", "routes/spa-fallback.tsx")]),
] satisfies RouteConfig;
