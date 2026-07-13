import { Sparkles } from "lucide-react";
import armadilloMascot from "@/assets/armadillo-mascot.png";

export const HeroSection = () => {
  return (
    <section className="relative px-4 pt-16 pb-4 md:px-6 md:pt-28 md:pb-8">
      <div className="max-w-3xl mx-auto">
        {/* Mascot Image */}
        <div className="flex justify-center mb-4 md:mb-8 md:justify-start md:-ml-0 md:absolute md:left-8 md:-top-2 lg:left-16">
          <img 
            src={armadilloMascot} 
            alt="Armadillo reading newspaper" 
            className="w-28 h-28 md:w-56 md:h-56 object-contain"
          />
        </div>
        
        {/* Content - Centered */}
        <div className="text-center md:pt-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background/60 backdrop-blur-sm mb-3 md:mb-6 md:px-4 md:py-2">
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
            <span className="text-xs md:text-sm font-medium">AI-Powered News Podcast</span>
          </div>
          
          {/* Headline */}
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-3 md:mb-6">
            Get a Newsie Woosie!
          </h1>
          
          {/* Description */}
          <p className="text-muted-foreground text-base md:text-xl max-w-2xl leading-relaxed mx-4 sm:mx-6 md:mx-auto text-center">
            The News feels too big to digest on most days doesn't it? What you need is news that you care about, from sources you like, summarized in a digestable way.
            <br className="block md:hidden" /> A Newsie Woosie if you will!
          </p>
        </div>
      </div>
    </section>
  );
};