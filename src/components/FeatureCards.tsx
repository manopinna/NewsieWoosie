import { Headphones, FileText } from "lucide-react";

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
            <h3 className="text-sm md:text-xl font-semibold mb-1 md:mb-2">Podcast Newsie Woosie</h3>
            <p className="text-muted-foreground text-xs md:text-base">
              Select the news sources/ newsletters/ substacks you would like to get top stories from. We will create a podcast that summarizes the top 3 stories from each source so you can listen on the go!
            </p>
          </div>
          
          {/* Quick Read Newsie Woosie */}
          <div className="text-center py-3 px-2 md:py-6 md:px-4">
            <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-2 md:mb-4">
              <FileText className="w-5 h-5 md:w-8 md:h-8 text-primary-foreground" />
            </div>
            <h3 className="text-sm md:text-xl font-semibold mb-1 md:mb-2">Quick Read Newsie Woosie</h3>
            <p className="text-muted-foreground text-xs md:text-base">
              Dont have time to listen and want a quick bulletin summary instead? Our Quick read will give you the headline, context and takeaway of the top 3 stories from the news sources you selected.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};