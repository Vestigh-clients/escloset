import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import heroImage from "@/assets/hero-bg.jpg";

interface AuthPageLayoutProps {
  children: ReactNode;
  contentClassName?: string;
}

const AuthPageLayout = ({ children, contentClassName }: AuthPageLayoutProps) => {
  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <aside className="fixed inset-y-0 left-0 hidden w-1/2 overflow-hidden md:block">
        <img src={heroImage} alt="Luxuriant brand visual" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.3),rgba(0,0,0,0.5))]" />

        <div className="absolute bottom-10 left-10">
          <p className="font-display text-[32px] italic text-white">LUXURIANT</p>
          <p className="mt-2 font-body text-[12px] text-[rgba(255,255,255,0.7)]">Carefully curated luxury for everyday rituals.</p>
        </div>
      </aside>

      <section className="min-h-screen overflow-y-auto md:ml-[50%]">
        <div className={cn("mx-auto flex min-h-screen w-full max-w-[400px] flex-col justify-center px-6 py-10 md:px-10 md:py-[60px]", contentClassName)}>
          <Link
            to="/"
            className="mb-10 text-center font-display text-[30px] italic text-[#1A1A1A] md:hidden"
          >
            LUXURIANT
          </Link>

          {children}
        </div>
      </section>
    </div>
  );
};

export default AuthPageLayout;

