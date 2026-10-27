import { IconButton } from "@mui/joy";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import { useSoundEffects } from "@/audio/interfaceSound";

export default function SoundEffectsControl() {
  const [enabled, setEnabled] = useSoundEffects();
  return <IconButton size="sm" variant="plain" color="neutral" aria-label={enabled ? "Mute sound effects" : "Enable sound effects"} aria-pressed={enabled} onClick={() => setEnabled(!enabled)}>
    {enabled ? <VolumeUpRoundedIcon /> : <VolumeOffRoundedIcon />}
  </IconButton>;
}
