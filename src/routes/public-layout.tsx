import { Outlet, useLoaderData } from "react-router";
import { AppChrome, AppProviders } from "../App";
import { fetchSiteShellData, type SiteShellData } from "../lib/ssgData";

export const loader = async () => fetchSiteShellData();

export default function PublicLayout() {
  const data = useLoaderData() as SiteShellData;

  return (
    <AppProviders
      initialPublicSettings={data.publicSettings}
      initialStorefrontCategories={data.categories}
    >
      <AppChrome>
        <Outlet />
      </AppChrome>
    </AppProviders>
  );
}
