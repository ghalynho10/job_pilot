import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/homepage/Hero";
import { Features } from "@/components/homepage/Features";
import { Testimonial } from "@/components/homepage/Testimonial";
import { BottomCta } from "@/components/homepage/BottomCta";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <Testimonial />
        <BottomCta />
      </main>
      <Footer />
    </>
  );
}
