import { Box, Button, Chip, Divider, Grid, Stack, Typography } from "@mui/joy";
import RoomPreview from "../RoomPreview/RoomPreview";
import LinesBackgroundSvg from "@/assets/linesBackground.svg?react";
import GitHubIcon from "@mui/icons-material/GitHub";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import IntroSection from "../IntroSection/IntroSection";
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
      <Box width="92%" maxWidth={1200} marginTop={{ xs: 4, md: "6vw" }}>
        <Grid container spacing={4}>
          <Grid xs={12} md={7} position="relative">
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
            <Stack
              direction="row"
              spacing={2}
              flexWrap="wrap"
              useFlexGap
              marginTop={2}
            >
              {["Computational Immunology", "TCR/BCR Repertoires", "Single-cell Analysis", "Clonal Dynamics", "Longitudinal Modelling"].map((tag) => (
                <Chip key={tag} color="primary" variant="outlined" size="lg">{tag}</Chip>
              ))}
            </Stack>
            <Divider sx={{ marginTop: 5 }} />
            <Typography level="h4" marginTop={5}>
              Quick connect:
            </Typography>
            <Stack direction="row" spacing={2} marginTop={2}>
              <Button
                component="a"
                href="https://github.com/HEIMA-programmer"
                target="_blank"
                rel="noopener noreferrer"
                startDecorator={<GitHubIcon />}
                variant="soft"
                sx={{ maxWidth: "50%" }}
              >
                GitHub
              </Button>
              <Button
                component="a"
                href="mailto:yann3434274@gmail.com"
                startDecorator={<EmailRoundedIcon />}
                variant="soft"
                sx={{ maxWidth: "50%", overflowWrap: "anywhere" }}
              >
                yann3434274@gmail.com
              </Button>
            </Stack>
          </Grid>
          <Grid xs={12} md={5} justifyContent="right">
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
        <Box margin={40} />
      </Box>
    </Box>
  );
}
