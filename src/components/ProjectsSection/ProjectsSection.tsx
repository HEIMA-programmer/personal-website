import { Typography } from "@mui/joy";
import ResearchPlaceholderCard from "./ResearchPlaceholderCard";
import ResearchCarousel from "../ResearchCarousel/ResearchCarousel";

export default function ProjectsSection() {
  return <section aria-labelledby="publications-title">
    <Typography id="publications-title" level="h2" mb={2}>Publications 📄</Typography>
    <ResearchCarousel ariaLabel="Publications">
      <ResearchPlaceholderCard kind="publication" />
    </ResearchCarousel>
  </section>;
}
