import { Box } from "@mui/joy";
import type { ReactNode } from "react";
import "./ResearchCarousel.css";

/** One bounded, keyboard-scrollable gallery treatment for all research sections. */
export default function ResearchCarousel({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  return (
    <Box className="research-carousel" role="region" aria-label={ariaLabel} tabIndex={0}>
      {children}
    </Box>
  );
}
