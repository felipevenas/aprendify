import { useEffect, useRef, useCallback } from "react";
import { 
  initDB, 
  isYearCached, 
  cacheQuestions, 
  API_YEARS,
  CachedQuestion,
  getCacheStats
} from "@/lib/questionCache";

// Preloader status
let isPreloading = false;
let preloadProgress = 0;

/**
 * Hook that preloads ENEM questions in background
 * Uses requestIdleCallback to avoid blocking the main thread
 * Respects API rate limits (1 request per second)
 */
export function useBackgroundPreloader() {
  const preloadRef = useRef(false);

  /**
   * Map API discipline name to local format
   */
  const mapDiscipline = (apiDiscipline: string): string => {
    const mapping: Record<string, string> = {
      "ciencias-humanas": "humanas",
      "ciencias-natureza": "natureza",
      "matematica": "matematica",
      "linguagens": "linguagens"
    };
    return mapping[apiDiscipline] || apiDiscipline;
  };

  /**
   * Fetch all questions for a year from API with rate limiting
   */
  const fetchYearQuestions = async (year: string): Promise<CachedQuestion[]> => {
    const API_PAGE_LIMIT = 50;
    const allQuestions: CachedQuestion[] = [];
    let offset = 0;
    let hasMore = true;
    let retries = 0;

    while (hasMore && retries < 5) {
      try {
        const url = `https://api.enem.dev/v1/exams/${year}/questions?limit=${API_PAGE_LIMIT}&offset=${offset}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("Retry-After") || "2000");
          console.log(`[Preloader] Rate limited, waiting ${retryAfter}ms`);
          await new Promise(r => setTimeout(r, retryAfter));
          retries++;
          continue;
        }

        if (!response.ok) {
          console.error(`[Preloader] Error fetching ${year}: ${response.status}`);
          break;
        }

        const data = await response.json();

        if (!data.questions || data.questions.length === 0) {
          hasMore = false;
          break;
        }

        // Map questions to cache format
        const mappedQuestions: CachedQuestion[] = data.questions.map((q: any, idx: number) => ({
          id: `api-${year}-${q.discipline}-${q.index || idx}`,
          year: String(q.year || year),
          discipline: mapDiscipline(q.discipline),
          title: q.title || "",
          context: q.context || null,
          alternatives: Array.isArray(q.alternatives) 
            ? q.alternatives.map((alt: any) => ({
                letter: alt.letter || "",
                text: alt.text || ""
              }))
            : [],
          alternatives_introduction: q.alternativesIntroduction || null,
          index: q.index || idx,
          files: Array.isArray(q.files) && q.files.length > 0 ? q.files : null,
          correct_alternative: q.correctAlternative || "",
          cached_at: Date.now()
        }));

        allQuestions.push(...mappedQuestions);

        if (data.questions.length < API_PAGE_LIMIT) {
          hasMore = false;
        } else {
          offset += API_PAGE_LIMIT;
          // Wait 1.1s to respect rate limit
          await new Promise(r => setTimeout(r, 1100));
        }

        retries = 0; // Reset retries on success

      } catch (error) {
        console.error(`[Preloader] Error fetching ${year}:`, error);
        retries++;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    return allQuestions;
  };

  /**
   * Start background preloading
   */
  const startPreloading = useCallback(async () => {
    if (isPreloading || preloadRef.current) return;
    
    isPreloading = true;
    preloadRef.current = true;
    console.log("[Preloader] Starting background preload");

    try {
      await initDB();

      // Check which years need to be cached
      const yearsToCache: string[] = [];
      for (const year of API_YEARS) {
        const cached = await isYearCached(year);
        if (!cached) {
          yearsToCache.push(year);
        }
      }

      if (yearsToCache.length === 0) {
        console.log("[Preloader] All years already cached");
        isPreloading = false;
        return;
      }

      console.log(`[Preloader] Years to cache: ${yearsToCache.join(", ")}`);

      // Cache one year at a time in background
      for (let i = 0; i < yearsToCache.length; i++) {
        const year = yearsToCache[i];
        preloadProgress = ((i + 1) / yearsToCache.length) * 100;
        
        console.log(`[Preloader] Caching ${year} (${i + 1}/${yearsToCache.length})`);
        
        // Use requestIdleCallback if available
        if ('requestIdleCallback' in window) {
          await new Promise<void>((resolve) => {
            (window as any).requestIdleCallback(async () => {
              const questions = await fetchYearQuestions(year);
              if (questions.length > 0) {
                await cacheQuestions(questions, year, true);
              }
              resolve();
            }, { timeout: 60000 });
          });
        } else {
          const questions = await fetchYearQuestions(year);
          if (questions.length > 0) {
            await cacheQuestions(questions, year, true);
          }
        }

        // Wait between years to avoid overwhelming the API
        await new Promise(r => setTimeout(r, 2000));
      }

      console.log("[Preloader] Background preload complete");
      
      // Log cache stats
      const stats = await getCacheStats();
      console.log(`[Preloader] Cache stats: ${stats.totalQuestions} questions, ${stats.cachedYears.length} years`);

    } catch (error) {
      console.error("[Preloader] Error during preload:", error);
    } finally {
      isPreloading = false;
    }
  }, []);

  // Start preloading on mount (with delay to not block initial render)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      startPreloading();
    }, 5000); // Wait 5 seconds after page load

    return () => clearTimeout(timeoutId);
  }, [startPreloading]);

  return {
    isPreloading,
    preloadProgress
  };
}

/**
 * Get preload status (can be called from anywhere)
 */
export function getPreloadStatus() {
  return {
    isPreloading,
    progress: preloadProgress
  };
}
