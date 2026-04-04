import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";

const STORY_PARAGRAPHS = [
  "E&S Closet was born from friendship, faith, ambition, and a shared dream between two young women, Enam and Sara, who met as students at Kumasi Technical University.",
  "Like many students, their journey was not always easy. Between lectures, assignments, deadlines, and the everyday challenges of student life, they still carried something beautiful inside them, a deep love for fashion and a strong desire to create something of their own. For Enam and Sara, clothing was never just about what people wear. It was about confidence. It was about identity. It was about giving people the chance to feel seen, beautiful, and sure of themselves.",
  "What started as simple conversations between two friends slowly became something much bigger. In quiet moments after class, during long days on campus, and through seasons of sacrifice and determination, the vision for E&S Closet began to take shape. They dreamed of building a brand that would reflect elegance, style, and self-expression while also telling a story of courage, growth, and purpose.",
  "E&S Closet is more than a fashion brand. It is the result of two students who refused to let their circumstances limit their vision. It is a reminder that even in the middle of busy school days and uncertain beginnings, something meaningful can still be built. Every piece we offer is part of that journey, a journey of hard work, resilience, and believing that small beginnings can lead to beautiful things.",
  "At E&S Closet, we want every customer to feel confident, stylish, and empowered. We believe fashion should not only make you look good, but also make you feel like the best version of yourself.",
  "This brand is our story, our passion, and our dream brought to life.",
];

const About = () => {
  const { storefrontConfig } = useStorefrontConfig();

  return (
    <div className="bg-[#F9F9F9] font-manrope text-[#1A1C1C]">
      <header className="relative overflow-hidden border-b border-[#dde2e6] bg-gradient-to-br from-[#ffffff] via-[#f5f7f8] to-[#f9f9f9]">
        <div className="absolute -left-24 top-10 h-56 w-56 rounded-full bg-[#e9ecef] blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-56 w-56 rounded-full bg-[#f8d6e4] blur-3xl" />
        <div className="relative mx-auto max-w-screen-2xl px-4 pb-14 pt-16 md:px-8 md:pb-20 md:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">About E&amp;S Closet</p>
          <h1 className="mt-3 font-notoSerif text-5xl font-bold leading-[0.95] text-[#1A1C1C] md:text-7xl">
            Our <span className="italic text-[#D81B60]">Story</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#5E5E5E] md:text-lg">
            Built from campus hustle, deep friendship, and a belief that fashion should make people feel seen, confident,
            and empowered.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-12 md:px-8 md:py-16">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          <article className="rounded-[8px] border border-[#e3bdc7] bg-white p-6 shadow-[0_14px_30px_rgba(26,28,28,0.05)] md:p-8 lg:col-span-8">
            <h2 className="font-notoSerif text-3xl font-bold text-[#1A1C1C] md:text-4xl">From Friendship to Brand</h2>
            <div className="mt-6 space-y-6 text-[15px] leading-[1.95] text-[#4e4e4e] md:text-base">
              {STORY_PARAGRAPHS.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="mt-8 border-t border-[#e1e5e8] pt-6 font-notoSerif text-xl font-semibold italic text-[#B0004A]">
              Founded by Enam and Sara. Built with heart. Inspired by purpose.
            </p>
          </article>

          <aside className="space-y-6 lg:col-span-4">
            <div className="rounded-[8px] border border-[#e3bdc7] bg-[#f5f7f8] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B0004A]">Brand Promise</p>
              <h3 className="mt-2 font-notoSerif text-2xl font-bold text-[#1A1C1C]">Confidence in Every Piece</h3>
              <p className="mt-4 text-sm leading-relaxed text-[#5E5E5E]">
                Every collection is selected to help you feel stylish, assured, and fully yourself every time you get
                dressed.
              </p>
            </div>

            <div className="rounded-[8px] border border-[#e3bdc7] bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B0004A]">Rooted In</p>
              <p className="mt-3 text-sm text-[#5E5E5E]">Kumasi Technical University</p>
              <div className="my-4 h-px w-full bg-[#e1e5e8]" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B0004A]">Built For</p>
              <p className="mt-3 text-sm text-[#5E5E5E]">Bold women and men who value elegance, identity, and expression.</p>
              <div className="my-4 h-px w-full bg-[#e1e5e8]" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B0004A]">Driven By</p>
              <p className="mt-3 text-sm text-[#5E5E5E]">Faith, resilience, and the courage to start small and dream big.</p>
            </div>

            <div className="rounded-[8px] border border-[#e3bdc7] bg-[#1A1C1C] p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f5a3c2]">A Note from {storefrontConfig.storeName}</p>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                Thank you for being part of our journey. Every order supports a dream that began in lecture halls and grew through perseverance.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
};

export default About;
