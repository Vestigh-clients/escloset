import { storeConfig } from "@/config/store.config";

const About = () => {
  const defaultAboutText = `${storeConfig.storeName} is built to deliver a premium fashion shopping experience with curated collections and reliable service.`;
  const aboutText = storeConfig.pages.aboutText.trim() || defaultAboutText;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-20">
      <h1 className="mb-8 text-center font-display text-4xl font-bold md:text-5xl">Our Story</h1>

      <div className="space-y-6 font-body leading-relaxed text-muted-foreground">
        <p>
          <span className="font-display font-semibold text-foreground">{storeConfig.storeName}</span> is designed for
          modern stores that want polished branding and a seamless customer journey.
        </p>
        <p>{aboutText}</p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 text-center md:grid-cols-3">
        <div className="rounded-2xl bg-secondary p-8">
          <h3 className="mb-2 font-display text-3xl font-bold text-accent">500+</h3>
          <p className="font-body text-sm text-muted-foreground">Happy Customers</p>
        </div>
        <div className="rounded-2xl bg-secondary p-8">
          <h3 className="mb-2 font-display text-3xl font-bold text-accent">50+</h3>
          <p className="font-body text-sm text-muted-foreground">Premium Products</p>
        </div>
        <div className="rounded-2xl bg-secondary p-8">
          <h3 className="mb-2 font-display text-3xl font-bold text-accent">36</h3>
          <p className="font-body text-sm text-muted-foreground">Regions Served</p>
        </div>
      </div>
    </div>
  );
};

export default About;
