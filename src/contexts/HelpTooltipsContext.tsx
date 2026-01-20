import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TooltipInfo {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector or element ID
}

interface HelpTooltipsContextType {
  showTooltips: boolean;
  setShowTooltips: (show: boolean) => void;
  currentTooltipIndex: number;
  setCurrentTooltipIndex: (index: number) => void;
  tooltips: TooltipInfo[];
  setTooltips: (tooltips: TooltipInfo[]) => void;
  startTour: (markAsSeen?: boolean) => void;
  endTour: () => void;
  nextTooltip: () => void;
  prevTooltip: () => void;
  hasSeenTour: boolean;
  hasSeenPageTour: (pageId: string) => boolean;
  markTourAsSeen: () => void;
  markPageTourAsSeen: (pageId: string) => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const HelpTooltipsContext = createContext<HelpTooltipsContextType | undefined>(undefined);

const TOUR_SEEN_KEY = "aprendify_tour_seen";
const PAGE_TOURS_KEY = "aprendify_page_tours_seen";

export const HelpTooltipsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showTooltips, setShowTooltips] = useState(false);
  const [currentTooltipIndex, setCurrentTooltipIndex] = useState(0);
  const [tooltips, setTooltips] = useState<TooltipInfo[]>([]);
  const [hasSeenTour, setHasSeenTour] = useState(true);
  const [seenPageTours, setSeenPageTours] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState<string>("dashboard");
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check if user has seen the dashboard tour (user-specific)
  useEffect(() => {
    if (!userId) return;

    const userTourKey = `${TOUR_SEEN_KEY}_${userId}`;
    const seen = localStorage.getItem(userTourKey);
    setHasSeenTour(seen === "true");

    // Load page tours
    const userPageToursKey = `${PAGE_TOURS_KEY}_${userId}`;
    const pageTours = localStorage.getItem(userPageToursKey);
    if (pageTours) {
      try {
        const parsed = JSON.parse(pageTours);
        setSeenPageTours(new Set(parsed));
      } catch {
        setSeenPageTours(new Set());
      }
    }
  }, [userId]);

  const startTour = useCallback((markAsSeen: boolean = false) => {
    setCurrentTooltipIndex(0);
    setShowTooltips(true);
    // Mark as seen immediately when auto-started for new users
    if (markAsSeen && userId) {
      const userTourKey = `${TOUR_SEEN_KEY}_${userId}`;
      localStorage.setItem(userTourKey, "true");
      setHasSeenTour(true);
    }
  }, [userId]);

  const endTour = useCallback(() => {
    setShowTooltips(false);
    setCurrentTooltipIndex(0);
  }, []);

  const nextTooltip = useCallback(() => {
    if (currentTooltipIndex < tooltips.length - 1) {
      setCurrentTooltipIndex((prev) => prev + 1);
    } else {
      endTour();
    }
  }, [currentTooltipIndex, tooltips.length, endTour]);

  const prevTooltip = useCallback(() => {
    if (currentTooltipIndex > 0) {
      setCurrentTooltipIndex((prev) => prev - 1);
    }
  }, [currentTooltipIndex]);

  const markTourAsSeen = useCallback(() => {
    if (!userId) return;
    const userTourKey = `${TOUR_SEEN_KEY}_${userId}`;
    localStorage.setItem(userTourKey, "true");
    setHasSeenTour(true);
  }, [userId]);

  const hasSeenPageTour = useCallback((pageId: string) => {
    return seenPageTours.has(pageId);
  }, [seenPageTours]);

  const markPageTourAsSeen = useCallback((pageId: string) => {
    if (!userId) return;
    const newSeen = new Set(seenPageTours);
    newSeen.add(pageId);
    setSeenPageTours(newSeen);
    
    const userPageToursKey = `${PAGE_TOURS_KEY}_${userId}`;
    localStorage.setItem(userPageToursKey, JSON.stringify(Array.from(newSeen)));
  }, [userId, seenPageTours]);

  return (
    <HelpTooltipsContext.Provider
      value={{
        showTooltips,
        setShowTooltips,
        currentTooltipIndex,
        setCurrentTooltipIndex,
        tooltips,
        setTooltips,
        startTour,
        endTour,
        nextTooltip,
        prevTooltip,
        hasSeenTour,
        hasSeenPageTour,
        markTourAsSeen,
        markPageTourAsSeen,
        currentPage,
        setCurrentPage,
      }}
    >
      {children}
    </HelpTooltipsContext.Provider>
  );
};

export const useHelpTooltips = () => {
  const context = useContext(HelpTooltipsContext);
  if (context === undefined) {
    throw new Error("useHelpTooltips must be used within a HelpTooltipsProvider");
  }
  return context;
};
