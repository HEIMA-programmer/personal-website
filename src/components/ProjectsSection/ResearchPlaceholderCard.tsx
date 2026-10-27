import {
  AspectRatio,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/joy";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import BiotechOutlinedIcon from "@mui/icons-material/BiotechOutlined";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

interface Props {
  kind: "publication" | "tool";
}

export default function ResearchPlaceholderCard({ kind }: Props) {
  const publication = kind === "publication";

  return (
    <Card
      orientation="vertical"
      size="sm"
      variant="soft"
      sx={{ width: "85vw", maxWidth: 400 }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography level="h4">
          {publication ? "Future publications" : "Future research tools"}
        </Typography>
        <Chip size="sm" variant="outlined">Coming later</Chip>
      </Stack>
      <Typography level="body-md" sx={{ minHeight: "3em" }}>
        {publication
          ? "A space for my research papers, with links to the publication and its source code."
          : "A space for the research tools I build, with links to the tool and its source code."}
      </Typography>
      <AspectRatio ratio={8 / 5}>
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={2}
          sx={{ color: "text.tertiary" }}
        >
          {publication
            ? <ArticleOutlinedIcon sx={{ fontSize: 64 }} />
            : <BiotechOutlinedIcon sx={{ fontSize: 64 }} />}
          <Typography level="body-sm">
            {publication ? "No publications yet" : "No tools released yet"}
          </Typography>
        </Stack>
      </AspectRatio>
      <CardContent>
        <Typography level="body-sm" my={1}>
          Links will appear when {publication ? "a paper is published" : "a tool is released"}.
        </Typography>
        <Stack direction="row" justifyContent="space-between">
          <Button disabled variant="plain" startDecorator={<CodeRoundedIcon />}>
            Source code
          </Button>
          <Button disabled startDecorator={<OpenInNewRoundedIcon />}>
            {publication ? "DOI / Paper" : "Open tool"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
