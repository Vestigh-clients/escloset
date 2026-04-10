import { Link } from "react-router";
import type { ReactNode } from "react";
import StoreLogo from "@/components/StoreLogo";
import { contentConfig } from "@/config/content.config";
import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { cn } from "@/lib/utils";

interface AuthPageLayoutProps {
  children: ReactNode;
  contentClassName?: string;
  showPanelImage?: boolean;
}

const AuthPageLayout = ({ children, contentClassName, showPanelImage = false }: AuthPageLayoutProps) => {
  const { storefrontConfig } = useStorefrontConfig();

  if (!showPanelImage) {
    return (
      <div className="relative min-h-screen overflow-y-auto bg-[var(--color-secondary)] px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.06)] blur-3xl" />
          <div className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.05)] blur-3xl" />
        </div>

        <section className="relative mx-auto flex w-full max-w-[560px] items-start justify-center md:min-h-[calc(100vh-5rem)] md:items-center">
          <div className="w-full rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-5 py-7 shadow-[0_24px_60px_rgba(26,28,28,0.14)] sm:px-8 sm:py-10">
            <Link to="/" className="mb-8 block text-center font-display text-[30px] italic text-[var(--color-primary)]">
              <StoreLogo className="mx-auto h-11 w-auto" textClassName="text-[30px] text-[var(--color-primary)]" />
            </Link>

            <div className={cn("mx-auto w-full max-w-[420px]", contentClassName)}>{children}</div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-secondary)]">
      <aside className="fixed inset-y-0 left-0 hidden w-1/2 overflow-hidden md:block">
        <img
          src={contentConfig.auth.panelImageUrl}
          alt={`${storefrontConfig.storeName} ${contentConfig.auth.panelImageAlt.toLowerCase()}`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--color-navbar-solid-foreground-rgb),0.3),rgba(var(--color-navbar-solid-foreground-rgb),0.5))]" />

        <div className="absolute bottom-10 left-10">
          <StoreLogo className="h-12 w-auto" textClassName="text-[32px] text-white" />
          <p className="mt-2 font-body text-[12px] text-[rgba(var(--color-secondary-rgb),0.7)]">{storefrontConfig.storeTagline}</p>
        </div>
      </aside>

      <section className={cn("min-h-screen overflow-y-auto", showPanelImage ? "md:ml-[50%]" : "")}>
        <div className={cn("mx-auto flex min-h-screen w-full max-w-[400px] flex-col justify-center px-6 py-10 md:px-10 md:py-[60px]", contentClassName)}>
          <Link
            to="/"
            className={cn(
              "mb-10 text-center font-display text-[30px] italic text-[var(--color-primary)]",
              showPanelImage ? "md:hidden" : "",
            )}
          >
            <StoreLogo className="mx-auto h-11 w-auto" textClassName="text-[30px] text-[var(--color-primary)]" />
          </Link>

          {children}
        </div>
      </section>
    </div>
  );
};

export default AuthPageLayout;
