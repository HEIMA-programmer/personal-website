import { Chip, Stack } from "@mui/joy";
import BiotechRoundedIcon from "@mui/icons-material/BiotechRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import BubbleChartRoundedIcon from "@mui/icons-material/BubbleChartRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";

const tags = [
  { title: "Computational Immunology", Icon: BiotechRoundedIcon, accent: "blue" },
  { title: "TCR/BCR Repertoires", Icon: HubRoundedIcon, accent: "green" },
  { title: "Single-cell Analysis", Icon: BubbleChartRoundedIcon, accent: "violet" },
  { title: "Clonal Dynamics", Icon: TimelineRoundedIcon, accent: "amber" },
  { title: "Longitudinal Modelling", Icon: InsightsRoundedIcon, accent: "teal" },
];

export default function ResearchTags() {
  return <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap mt={2.5}>
    {tags.map(({ title, Icon, accent }) => (
      <Chip key={title} className="research-tag" data-accent={accent} size="lg" variant="outlined" startDecorator={<Icon sx={{ fontSize: 20 }} />}>
        {title}
      </Chip>
    ))}
  </Stack>;
}
