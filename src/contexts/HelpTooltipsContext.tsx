import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

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
  startTour: () => void;
  endTour: () => void;
  nextTooltip: () => void;
  prevTooltip: () => void;
  hasSeenTour: boolean;
  markTourAsSeen: () => void;
}

const HelpTooltipsContext = createContext<HelpTooltipsContextType | undefined>(undefined);

const TOUR_SEEN_KEY = "aprendify_tour_seen";

export const HelpTooltipsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showTooltips, setShowTooltips] = useState(false);
  const [currentTooltipIndex, setCurrentTooltipIndex] = useState(0);
  const [tooltips, setTooltips] = useState<TooltipInfo[]>([]);
  const [hasSeenTour, setHasSeenTour] = useState(true);

  // Check if user has seen the tour
  useEffect(() => {
    const seen = localStorage.getItem(TOUR_SEEN_KEY);
    setHasSeenTour(seen === "true");
  }, []);

  const startTour = useCallback(() => {
    setCurrentTooltipIndex(0);
    setShowTooltips(true);
  }, []);

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
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    setHasSeenTour(true);
  }, []);

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
        markTourAsSeen,
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
