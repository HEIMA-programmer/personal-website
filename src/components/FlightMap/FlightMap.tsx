import Box from "@mui/material/Box";
import SignSvg from "@/assets/exitSign.svg?react";
import { styled } from "@mui/material";
import { useNavigate } from "react-router-dom";

const ExitSign = styled(SignSvg)`
  transition: transform 0.2s ease-in-out;
  &:hover {
    transform: scale(1.2);
    cursor: pointer;
  }
`;

export default function FlightMap() {
  const navigate = useNavigate();
  // Mapbox public tokens are intentionally client-visible. Never accept sk.* keys.
  const token = import.meta.env.VITE_MAPBOX_TOKEN || "";
  const mapConfig = new URLSearchParams();
  if (token.startsWith("pk.")) {
    mapConfig.set("token", token);
    mapConfig.set("style", import.meta.env.VITE_MAPBOX_STYLE || "mapbox://styles/mapbox/light-v11");
  }

  return (
    <Box sx={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <ExitSign
        sx={{
          position: "absolute",
          bottom: 0,
          left: 50,
          height: 130,
          width: "auto",
          zIndex: 1,
        }}
        onClick={() => navigate(import.meta.env.VITE_ROUTE_ROOM)}
        role="button"
        aria-label="Back to room"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            navigate(import.meta.env.VITE_ROUTE_ROOM);
          }
        }}
      />
      <iframe
        src={`${import.meta.env.BASE_URL}travel-map/index.html#${mapConfig}`}
        style={{ display: "block", width: "100%", height: "100%", border: "none" }}
        title="Yanbin's travel map"
      />
    </Box>
  );
}
