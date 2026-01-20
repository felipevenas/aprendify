/**
 * Question Cache System
 * 
 * Implements persistent caching of ENEM questions using IndexedDB.
 * Avoids repeated API requests by storing questions locally.
 */

const DB_NAME = "enem_questions_cache";
const DB_VERSION = 1;
const STORE_NAME = "questions";
const METADATA_STORE = "metadata";

/**
 * Question data structure for cache
 */
export interface CachedQuestion {
  id: string;
  title: string;
  context: string | null;
  alternatives: Array<{ letter: string; text: string }>;
  alternatives_introduction: string | null;
  discipline: string;
  year: string;
  index: number;
  files: string[] | null;
  correct_alternative: string;
  cached_at: number;
}

/**
 * Cache metadata for each year
 */
interface CacheMetadata {
  year: string;
  questionCount: number;
  lastUpdated: number;
  complete: boolean;
}

/**
 * All available ENEM years (2009-2025)
 */
export const ENEM_YEARS = [
  "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016",
  "2015", "2014", "2013", "2012", "2011", "2010", "2009"
];

/**
 * All available ENEM years from API (2009-2023)
 */
export const API_YEARS = ENEM_YEARS.filter(y => parseInt(y) < 2024);

/**
 * Initialize IndexedDB database
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[QuestionCache] Failed to open database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create questions store with indexes
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("year", "year", { unique: false });
        store.createIndex("discipline", "discipline", { unique: false });
        store.createIndex("year_discipline", ["year", "discipline"], { unique: false });
      }

      // Create metadata store
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "year" });
      }

      console.log("[QuestionCache] Database initialized");
    };
  });
};

/**
 * Get cached questions by year and disciplines
 */
export const getCachedQuestions = async (
  year: string,
  disciplines: string[]
): Promise<CachedQuestion[]> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("year");
    const request = index.getAll(year);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const questions = request.result.filter((q: CachedQuestion) =>
          disciplines.includes(q.discipline)
        );
        console.log(`[QuestionCache] Found ${questions.length} cached questions for year ${year}`);
        resolve(questions);
      };

      request.onerror = () => {
        console.error("[QuestionCache] Failed to get cached questions:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("[QuestionCache] Error getting cached questions:", error);
    return [];
  }
};

/**
 * Get cached questions from multiple years
 */
export const getCachedQuestionsMultiYear = async (
  years: string[],
  disciplines: string[]
): Promise<CachedQuestion[]> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const questions = request.result.filter(
          (q: CachedQuestion) =>
            years.includes(q.year) && disciplines.includes(q.discipline)
        );
        console.log(`[QuestionCache] Found ${questions.length} cached questions for years ${years.join(",")}`);
        resolve(questions);
      };

      request.onerror = () => {
        console.error("[QuestionCache] Failed to get cached questions:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("[QuestionCache] Error getting cached questions:", error);
    return [];
  }
};

/**
 * Store questions in cache
 * @param questions - Questions to cache
 * @param year - Optional year to associate (for metadata update)
 * @param isComplete - Whether this represents all questions for the year
 */
export const cacheQuestions = async (
  questions: CachedQuestion[],
  year?: string,
  isComplete?: boolean
): Promise<void> => {
  if (questions.length === 0) return;

  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME, METADATA_STORE], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const metaStore = transaction.objectStore(METADATA_STORE);

    // Add timestamp to each question
    const now = Date.now();
    const questionsWithTimestamp = questions.map((q) => ({
      ...q,
      cached_at: now,
    }));

    // Store each question
    for (const question of questionsWithTimestamp) {
      store.put(question);
    }

    // Update metadata if year is provided
    if (year && isComplete) {
      metaStore.put({
        year,
        questionCount: questions.length,
        lastUpdated: now,
        complete: true,
      });
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`[QuestionCache] Cached ${questions.length} questions`);
        resolve();
      };

      transaction.onerror = () => {
        console.error("[QuestionCache] Failed to cache questions:", transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("[QuestionCache] Error caching questions:", error);
  }
};

/**
 * Update cache metadata for a year
 */
export const updateCacheMetadata = async (
  year: string,
  questionCount: number,
  complete: boolean
): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([METADATA_STORE], "readwrite");
    const store = transaction.objectStore(METADATA_STORE);

    const metadata: CacheMetadata = {
      year,
      questionCount,
      lastUpdated: Date.now(),
      complete,
    };

    store.put(metadata);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`[QuestionCache] Updated metadata for year ${year}`);
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("[QuestionCache] Error updating metadata:", error);
  }
};

/**
 * Check if a year is fully cached
 */
export const isYearCached = async (year: string): Promise<{ cached: boolean; count: number }> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([METADATA_STORE], "readonly");
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.get(year);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const metadata = request.result as CacheMetadata | undefined;
        if (metadata && metadata.complete) {
          resolve({ cached: true, count: metadata.questionCount });
        } else {
          resolve({ cached: false, count: 0 });
        }
      };

      request.onerror = () => {
        resolve({ cached: false, count: 0 });
      };
    });
  } catch (error) {
    return { cached: false, count: 0 };
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<{
  totalQuestions: number;
  yearsCached: string[];
  cachedYears: string[]; // Alias for compatibility
}> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME, METADATA_STORE], "readonly");
    
    // Count total questions
    const questionsStore = transaction.objectStore(STORE_NAME);
    const countRequest = questionsStore.count();
    
    // Get cached years
    const metadataStore = transaction.objectStore(METADATA_STORE);
    const metadataRequest = metadataStore.getAll();

    return new Promise((resolve) => {
      let totalQuestions = 0;
      let yearsCached: string[] = [];

      countRequest.onsuccess = () => {
        totalQuestions = countRequest.result;
      };

      metadataRequest.onsuccess = () => {
        yearsCached = (metadataRequest.result as CacheMetadata[])
          .filter((m) => m.complete)
          .map((m) => m.year);
      };

      transaction.oncomplete = () => {
        console.log(`[QuestionCache] Stats: ${totalQuestions} questions, years: ${yearsCached.join(",")}`);
        resolve({ 
          totalQuestions, 
          yearsCached,
          cachedYears: yearsCached // Alias
        });
      };

      transaction.onerror = () => {
        resolve({ totalQuestions: 0, yearsCached: [], cachedYears: [] });
      };
    });
  } catch (error) {
    return { totalQuestions: 0, yearsCached: [], cachedYears: [] };
  }
};

/**
 * Clear all cached data
 */
export const clearCache = async (): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME, METADATA_STORE], "readwrite");
    
    transaction.objectStore(STORE_NAME).clear();
    transaction.objectStore(METADATA_STORE).clear();

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log("[QuestionCache] Cache cleared");
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("[QuestionCache] Error clearing cache:", error);
  }
};

