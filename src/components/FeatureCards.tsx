import { Headphones, FileText, ChevronRight, ChevronDown } from "lucide-react";

export const FeatureCards = () => {
  return (
    <section className="px-4 py-2 md:px-6 md:py-4 md:-mt-4">
      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-2 gap-6 md:gap-12">
          {/* Podcast Newsie Woosie */}
          <div className="text-center py-3 px-2 md:py-6 md:px-4">
            <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-2 md:mb-4">
              <Headphones className="w-5 h-5 md:w-8 md:h-8 text-primary-foreground" />
            </div>
            <h3 className="text-base md:text-xl font-semibold mb-1 md:mb-2">Podcast<br />Newsie Woosie</h3>
            <p className="text-muted-foreground text-sm md:text-base">
              Select the news sources/ newsletters/ substacks you would like to hear from. We'll create a podcast that summarizes the top 3 stories from each source so you can listen on the go!
            </p>
          </div>
          
          {/* Quick Read Newsie Woosie */}
          <div className="text-center py-3 px-2 md:py-6 md:px-4">
            <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-2 md:mb-4">
              <FileText className="w-5 h-5 md:w-8 md:h-8 text-primary-foreground" />
            </div>
            <h3 className="text-base md:text-xl font-semibold mb-1 md:mb-2">Quick Read<br />Newsie Woosie</h3>
            <p className="text-muted-foreground text-sm md:text-base">
              Dont have time to listen and want a quick bulletin summary instead? Our Quick read will give you the headline, context and takeaway of the top 3 stories from the news sources you selected.
            </p>
          </div>
        </div>

        {/* How to use */}
        <div className="mt-6 md:mt-10 text-center">
          <h4 className="text-lg md:text-xl font-semibold mb-4 md:mb-6">How to use Newsie Woosie</h4>
          <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground w-full">
            <span className="bg-secondary px-2 md:px-4 py-1.5 rounded-full text-center min-w-0 flex flex-col items-center justify-center w-full md:w-auto">Select your<br />news sources</span>
            <ChevronRight className="hidden md:block w-3 h-3 md:w-4 md:h-4 flex-shrink-0 text-muted-foreground/60 self-center" />
            <ChevronDown className="md:hidden w-3 h-3 flex-shrink-0 text-muted-foreground/60" />
            <span className="bg-secondary px-2 md:px-2.5 py-1.5 rounded-full flex flex-col items-center justify-center text-center min-w-0 w-full md:w-auto">
              <span>Press Play podcast</span>
              <span className="text-[10px] italic text-muted-foreground/80">(give it a min)</span>
            </span>
            <ChevronRight className="hidden md:block w-3 h-3 md:w-4 md:h-4 flex-shrink-0 text-muted-foreground/60 self-center" />
            <ChevronDown className="md:hidden w-3 h-3 flex-shrink-0 text-muted-foreground/60" />
            <span className="bg-secondary px-2 md:px-3 py-1.5 rounded-full flex flex-col items-center justify-center text-center min-w-0 w-full md:w-auto">
              <span>Press Quick Read</span>
              <span className="text-[10px] italic text-muted-foreground/80">(scroll below for news summary)</span>
            </span>
            <ChevronRight className="hidden md:block w-3 h-3 md:w-4 md:h-4 flex-shrink-0 text-muted-foreground/60 self-center" />
            <ChevronDown className="md:hidden w-3 h-3 flex-shrink-0 text-muted-foreground/60" />
            <span className="bg-secondary px-4 md:px-9 py-2 rounded-full flex flex-col items-center justify-center text-center w-full md:w-auto">
              <span className="whitespace-nowrap">Enter your email</span>
              <span className="text-[10px] italic text-muted-foreground/80">
                (for one time or daily <br className="hidden md:inline" /> podcast & summary <br className="hidden md:inline" /> delivered to your email)
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};