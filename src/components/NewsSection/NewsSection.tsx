import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  DialogContent, DialogTitle, FormControl, FormLabel, Modal, ModalClose,
  ModalDialog, Option, Select, Stack, Typography,
} from "@mui/joy";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

interface Paper {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  date: string;
  dateLabel: string;
  doi: string;
  url: string;
  source: string;
  venue: string;
  publicationType: string;
  version: string;
  publishedDoi: string;
  categories: string[];
}

interface NewsIndex {
  latest: string | null;
  editions: { date: string; count: number; status: string }[];
}

interface Edition {
  date: string;
  status: string;
  searchWindow: { start: string; end: string };
  sources: { name: string; status: string }[];
  papers: Paper[];
}

async function fetchNews<T>(filename: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}news/${filename}`, { signal });
  if (!response.ok) throw new Error("The research archive could not be loaded. Please try again later.");
  return response.json() as Promise<T>;
}

function displayDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export default function NewsSection() {
  const [index, setIndex] = useState<NewsIndex | null>(null);
  const [date, setDate] = useState("");
  const [edition, setEdition] = useState<Edition | null>(null);
  const [category, setCategory] = useState("All topics");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchNews<NewsIndex>("index.json", controller.signal)
      .then((data) => {
        if (!Array.isArray(data.editions)) throw new Error("The research archive is temporarily unavailable.");
        setIndex(data);
        setDate(data.latest || "");
        if (!data.latest) setLoading(false);
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) { setError(reason.message); setLoading(false); }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setEdition(null);
    setCategory("All topics");
    fetchNews<Edition>(`${date}.json`, controller.signal)
      .then((data) => {
        if (!Array.isArray(data.papers) || !Array.isArray(data.sources)) throw new Error("This edition is temporarily unavailable.");
        if (!controller.signal.aborted) setEdition(data);
      })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date]);

  const categories = [...new Set(edition?.papers.flatMap((paper) => paper.categories) || [])];
  const papers = edition?.papers.filter((paper) => category === "All topics" || paper.categories.includes(category)) || [];
  const latestIsToday = index?.latest === new Date().toISOString().slice(0, 10);

  return (
    <Box component="section" id="news" position="relative" mt={6}>
      <Typography level="h2" mb={2}>News 🧬</Typography>
      <Typography level="body-md" mb={1}>
        A daily reading list in computational immunology, from bioRxiv and Europe PMC / PubMed.
      </Typography>
      <Typography level="body-sm" mb={3}>
        Automatically selected by research relevance. Preprints have not been peer reviewed; inclusion is not a quality endorsement.
      </Typography>

      {index && index.editions.length > 0 && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3} alignItems={{ sm: "flex-end" }} flexWrap="wrap" useFlexGap>
          <FormControl sx={{ minWidth: 225 }}>
            <FormLabel id="news-edition-label">Browse daily editions (UTC)</FormLabel>
            <Select aria-labelledby="news-edition-label" value={date || null} onChange={(_, value) => { if (value) setDate(value); }}>
              {index.editions.map((item) => (
                <Option key={item.date} value={item.date}>
                  {displayDate(item.date)}{item.date === index.latest ? " · Latest" : ""} ({item.count})
                </Option>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 225 }}>
            <FormLabel id="news-topic-label">Research topic</FormLabel>
            <Select aria-labelledby="news-topic-label" value={category} onChange={(_, value) => setCategory(value || "All topics")} disabled={loading || !categories.length}>
              <Option value="All topics">All topics</Option>
              {categories.map((topic) => <Option key={topic} value={topic}>{topic}</Option>)}
            </Select>
          </FormControl>
          {date !== index.latest && <Button variant="plain" onClick={() => setDate(index.latest || "")}>Latest edition</Button>}
        </Stack>
      )}

      <Box aria-live="polite" aria-busy={loading}>
        {loading && <Stack direction="row" alignItems="center" spacing={1} py={3}><CircularProgress size="sm" /><Typography>Loading research papers…</Typography></Stack>}
        {error && <Alert color="warning">{error}</Alert>}
        {!loading && !error && !index?.editions.length && <Card variant="soft"><Typography>The first research edition is on its way. Daily editions will appear here.</Typography></Card>}
        {!loading && !error && edition && (
          <>
            <Typography level="body-sm" mb={2}>
              {displayDate(edition.date)} · {edition.papers.length} newly featured {edition.papers.length === 1 ? "paper" : "papers"}
              {" · "}Search window: {displayDate(edition.searchWindow.start)}–{displayDate(edition.searchWindow.end)}
              {!latestIsToday && date === index?.latest ? " · Latest available edition" : ""}
            </Typography>
            <Typography level="body-xs" mb={2}>The search window includes new postings, publications and newly indexed papers. Some publication dates may be earlier.</Typography>
            {edition.status === "partial" && <Alert color="warning" sx={{ mb: 2 }}>Some sources were unavailable for this edition: {edition.sources.filter((source) => source.status !== "ok").map((source) => source.name).join(", ")}. Earlier editions remain available.</Alert>}
            {papers.length === 0 ? (
              <Card variant="soft"><Typography>No new matching papers in this edition. Browse an earlier date to see previous selections.</Typography></Card>
            ) : (
              <Stack
                direction="row" spacing={{ xs: 1.5, sm: 3, lg: 5 }} overflow="auto" pb={2}
                sx={{ scrollSnapType: "x proximity", scrollBehavior: "smooth" }}
                aria-label="Research paper cards" tabIndex={0}
              >
                {papers.map((paper) => (
                  <Card key={paper.id} variant="soft" size="sm" component="article"
                    sx={{ width: { xs: "80vw", sm: 380 }, maxWidth: 400, flexShrink: 0, scrollSnapAlign: "start" }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="sm" variant="outlined" color={paper.publicationType === "Preprint" ? "warning" : "primary"}>{paper.publicationType}</Chip>
                      <Chip size="sm" variant="plain">{paper.source}</Chip>
                    </Stack>
                    <Typography level="h4" sx={{ minHeight: "4.5em" }}>{paper.title}</Typography>
                    <Typography level="body-sm" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{paper.authors || "Authors listed at source"}</Typography>
                    <Typography level="body-xs">{paper.venue} · {paper.dateLabel} {displayDate(paper.date)}</Typography>
                    <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} my={1}>
                      {paper.categories.map((topic) => <Chip key={topic} size="sm" variant="soft">{topic}</Chip>)}
                    </Stack>
                    <CardContent>
                      <Typography level="body-sm" sx={{ display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", mb: 2 }}>{paper.abstract || "Abstract available at the source."}</Typography>
                      <Stack direction="row" spacing={1} justifyContent="space-between" mt="auto">
                        <Button variant="plain" component="a" href={paper.url} target="_blank" rel="noopener noreferrer" startDecorator={<OpenInNewRoundedIcon />}>Article</Button>
                        <Button startDecorator={<VisibilityRoundedIcon />} onClick={() => setSelectedPaper(paper)}>Details</Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </>
        )}
      </Box>

      <Modal open={!!selectedPaper} onClose={() => setSelectedPaper(null)}>
        <ModalDialog sx={{ width: "90vw", maxWidth: 760, maxHeight: "85vh" }} aria-labelledby="paper-title">
          <ModalClose />
          {selectedPaper && <>
            <DialogTitle id="paper-title" sx={{ pr: 4 }}>{selectedPaper.title}</DialogTitle>
            <DialogContent>
              <Typography level="body-sm">{selectedPaper.authors}</Typography>
              <Typography level="body-sm" my={1}>{selectedPaper.publicationType} · {selectedPaper.venue} · {displayDate(selectedPaper.date)}{selectedPaper.version ? ` · v${selectedPaper.version}` : ""}</Typography>
              <Typography level="title-md" mt={2} mb={1}>Abstract</Typography>
              <Typography sx={{ whiteSpace: "pre-line" }}>{selectedPaper.abstract || "The source did not provide an abstract. Open the article to learn more."}</Typography>
              {selectedPaper.doi && <Typography level="body-sm" mt={2} sx={{ overflowWrap: "anywhere" }}>DOI: {selectedPaper.doi}</Typography>}
              <Typography level="body-xs" mt={2}>Metadata and abstract supplied by {selectedPaper.source}. Topic labels are assigned automatically.</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mt={3}>
                <Button component="a" href={selectedPaper.url} target="_blank" rel="noopener noreferrer" startDecorator={<OpenInNewRoundedIcon />}>Read at source</Button>
                {selectedPaper.publishedDoi && <Button variant="soft" component="a" href={`https://doi.org/${selectedPaper.publishedDoi}`} target="_blank" rel="noopener noreferrer">Published version</Button>}
              </Stack>
            </DialogContent>
          </>}
        </ModalDialog>
      </Modal>
    </Box>
  );
}
