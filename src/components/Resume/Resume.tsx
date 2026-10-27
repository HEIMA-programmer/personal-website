import { Box, Button, Stack, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

// Preserve bookmarked routes without linking to the template author's CV.
export default function Resume() {
  const navigate = useNavigate();
  return (
    <Box minHeight="100dvh" display="grid" sx={{ placeItems: "center", bgcolor: "background.body" }}>
      <Stack spacing={2} alignItems="center">
        <Typography level="h2">Resume</Typography>
        <Typography>No resume has been shared yet.</Typography>
        <Button startDecorator={<ArrowBackRoundedIcon />} onClick={() => navigate(import.meta.env.VITE_ROUTE_ROOM)}>Back to room</Button>
      </Stack>
    </Box>
  );
}
