import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";
import { storeConfig } from "./config/store.config";
import "./index.css";

export const links = () => [{ rel: "icon", href: storeConfig.faviconUrl }];

export const meta = () => [
  { title: storeConfig.storeName },
  { name: "description", content: storeConfig.storeTagline },
  { property: "og:type", content: "website" },
  { property: "og:title", content: storeConfig.storeName },
  { property: "og:description", content: storeConfig.storeTagline },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isRouteError = isRouteErrorResponse(error);
  const title = isRouteError && error.status === 404 ? "Page not found" : "Something went wrong";
  const message = isRouteError ? error.statusText || title : error instanceof Error ? error.message : title;

  return (
    <main className="mx-auto max-w-screen-md px-4 py-20 font-manrope text-on-surface">
      <h1 className="font-notoSerif text-4xl font-bold">{title}</h1>
      <p className="mt-4 text-on-surface-variant">{message}</p>
    </main>
  );
}
