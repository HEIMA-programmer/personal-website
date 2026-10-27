import { Typography } from "@mui/joy";
import ResearchPlaceholderCard from "../ProjectsSection/ResearchPlaceholderCard";
import ResearchCarousel from "../ResearchCarousel/ResearchCarousel";

export default function SkillsSection() {
  return <section aria-labelledby="tools-title">
    <Typography id="tools-title" level="h2" mb={2} mt={15}>Tools 🛠️</Typography>
    <ResearchCarousel ariaLabel="Research tools">
      <ResearchPlaceholderCard kind="tool" />
    </ResearchCarousel>
  </section>;
}
