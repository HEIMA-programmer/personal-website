import { Box, Button, Divider, Grid, Link, Stack, Typography } from "@mui/joy";
import RoomPreview from "../RoomPreview/RoomPreview";
import LinesBackgroundSvg from "@/assets/linesBackground.svg?react";
import GitHubIcon from "@mui/icons-material/GitHub";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import IntroSection from "../IntroSection/IntroSection";
import ResearchTags from "../IntroSection/ResearchTags";
import ProjectsSection from "../ProjectsSection/ProjectsSection";
import SkillsSection from "../SkillsSection/SkillsSection";
import ExperienceSection from "../ExperienceSection/ExperienceSection";
import NewsSection from "../NewsSection/NewsSection";

interface Props {
  roomReady: boolean;
  roomEnabled: boolean;
  setRoomEnabled: (v: boolean) => void;
}

export default function LandingPage({
  roomReady,
  roomEnabled,
  setRoomEnabled,
}: Props) {
  return (
    <Box
      width="100%"
      height="max-content"
      display="flex"
      justifyContent="center"
      overflow="hidden"
      sx={{ backgroundColor: "background.body" }}
    >
      <Box width="92%" maxWidth={1280} marginTop={{ xs: 4, md: "5vw" }}>
        <Grid container spacing={4}>
          <Grid xs={12} md={7} position="relative" sx={{ minWidth: 0 }}>
            <LinesBackgroundSvg
              style={{
                position: "absolute",
                transform: "rotate(-20deg)",
                width: 800,
                left: -300,
                height: "auto",
              }}
            />
            <IntroSection />
            <ResearchTags />
            <Divider sx={{ marginTop: 5 }} />
            <Typography level="h4" marginTop={5}>
              Quick connect:
            </Typography>
            <Stack direction="row" spacing={2} marginTop={2} flexWrap="wrap" useFlexGap>
              <Button
                component="a"
                href="https://github.com/HEIMA-programmer"
                target="_blank"
                rel="noopener noreferrer"
                startDecorator={<GitHubIcon />}
                variant="soft"
                sx={{ flexShrink: 0 }}
              >
                GitHub
              </Button>
              <Button
                component="a"
                href="mailto:yann3434274@gmail.com"
                startDecorator={<EmailRoundedIcon />}
                variant="soft"
                sx={{ maxWidth: "100%", overflowWrap: "anywhere" }}
              >
                yann3434274@gmail.com
              </Button>
            </Stack>
          </Grid>
          <Grid xs={12} md={5} display="flex" sx={{ minWidth: 0 }}>
            <RoomPreview
              roomReady={roomReady}
              roomEnabled={roomEnabled}
              setRoomEnabled={setRoomEnabled}
            />
          </Grid>
          <Grid xs={12} position="relative">
            <Box margin={10} />
            <LinesBackgroundSvg
              style={{
                position: "absolute",
                transform: "rotate(20deg) scaleX(-1)",
                width: 800,
                right: -300,
                height: "auto",
              }}
            />
            <ProjectsSection />
          </Grid>
          <Grid xs={12} position="relative">
            <LinesBackgroundSvg
              style={{
                marginTop: 50,
                position: "absolute",
                transform: "rotate(10deg) scaleY(-1)",
                width: 800,
                left: -300,
                height: "auto",
              }}
            />
            <SkillsSection />
          </Grid>
        </Grid>
        <Box margin={10} />
        <NewsSection />
        <Box margin={10} />
        <ExperienceSection />
        <Box component="footer" sx={{ mt: 12, mb: 4 }}>
          <Typography level="body-xs" textColor="text.tertiary">
            Cat model: <Link href="https://sketchfab.com/3d-models/tuxedo-cat-animated-20-783fcb78b55b4394a212c2b6392e1113" target="_blank" rel="noopener noreferrer" color="neutral">DreamNoms</Link>
            {" · "}<Link href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" color="neutral">CC BY 4.0</Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
