import { Box, Stack, Typography } from "@mui/joy";
import { useSnapCarousel } from "react-snap-carousel";
import ResearchPlaceholderCard from "../ProjectsSection/ResearchPlaceholderCard";

export default function SkillsSection() {
  const { scrollRef, snapPointIndexes } = useSnapCarousel();

  return (
    <>
      <Typography level="h2" marginBottom={3} marginTop={15}>
        Tools 🛠️
      </Typography>
      <Stack
        direction="row"
        ref={scrollRef}
        overflow="auto"
        width="120%"
        sx={{
          scrollSnapType: { xs: "x mandatory", sm: "none" },
          scrollBehavior: "smooth",
          transform: "translateX(-8.5%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
        spacing={{ xs: 1.5, sm: 3, lg: 5 }}
        paddingX="10%"
      >
        <Box sx={{ scrollSnapAlign: snapPointIndexes.has(0) ? "center" : "" }}>
          <ResearchPlaceholderCard kind="tool" />
        </Box>
      </Stack>
    </>
  );
}
