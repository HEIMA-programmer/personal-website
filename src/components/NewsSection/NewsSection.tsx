import { useEffect, useMemo, useState } from "react";
import { Alert, AspectRatio, Box, Button, Card, CardContent, Chip, CircularProgress, DialogContent, DialogTitle, FormControl, FormLabel, Input, Link, Modal, ModalClose, ModalDialog, Option, Select, Stack, Typography } from "@mui/joy";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import BiotechOutlinedIcon from "@mui/icons-material/BiotechOutlined";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import ResearchCarousel from "../ResearchCarousel/ResearchCarousel";

interface Figure { url: string; label: string; caption: string; sourceUrl: string; license: string; licenseUrl: string; credit: string }
interface Paper {
  id: string; title: string; authors: string; abstract: string; date: string; dateLabel: string; doi: string; url: string;
  source: string; venue: string; publicationType: string; version: string; publishedDoi: string; categories: string[];
  relevanceScore?: number; figure?: Figure | null; openAccess?: boolean;
}
interface NewsIndex { latest: string | null; editions: { date: string; count: number; status: string }[] }
interface Collection { date: string; status: string; searchWindow: { start: string; end: string }; sources: { name: string; status: string }[]; papers: Paper[] }
interface Catalog { coverageStart: string; updatedThrough: string; generatedAt: string; status: string; sources: { name: string; status: string }[]; papers: Paper[] }
const PAGE_SIZE = 12;
const topicColors = ["primary", "success", "warning", "danger", "neutral"] as const;
const topicNames = ["Repertoire & clonal dynamics", "Single-cell immunology", "Antigen & receptor prediction", "Immunotherapy", "Systems immunology"];
function topicColor(topic: string) { return topicColors[Math.max(0, topicNames.indexOf(topic))]; }
async function fetchNews<T>(filename: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}news/${filename}`, { signal });
  if (!response.ok) throw new Error("The research archive could not be loaded. Please try again later.");
  return response.json() as Promise<T>;
}
function displayDate(date: string) { return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }); }
function daysBefore(date: string, days: number) { const parsed = new Date(`${date}T12:00:00Z`); parsed.setUTCDate(parsed.getUTCDate() - days); return parsed.toISOString().slice(0, 10); }

function PaperVisual({ paper, expanded = false }: { paper: Paper; expanded?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [paper.figure?.url]);
  const figure = paper.figure && !failed ? paper.figure : null;
  return <Box>
    <AspectRatio ratio={expanded ? "16 / 9" : "16 / 10"} sx={{ borderRadius: "sm", overflow: "hidden", bgcolor: "background.level1" }}>
      {figure ? <img src={figure.url} alt={`${figure.label}: ${figure.caption || paper.title}`} loading="lazy" decoding="async" onError={() => setFailed(true)} style={{ objectFit: "contain", background: "#fff", padding: expanded ? 12 : 8, boxSizing: "border-box" }} /> :
        <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ background: "linear-gradient(135deg, var(--joy-palette-primary-softBg), var(--joy-palette-success-softBg))" }}>
          <BiotechOutlinedIcon sx={{ fontSize: expanded ? 58 : 44, color: "primary.softColor" }} />
          <Typography level="title-sm" textColor="primary.softColor">{paper.categories[0] || "Computational immunology"}</Typography>
          <Typography level="body-xs" textColor="text.secondary">Article figure not available</Typography>
        </Stack>}
    </AspectRatio>
    {figure && <Typography level="body-xs" mt={0.7} sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>
      <Link href={figure.sourceUrl} target="_blank" rel="noopener noreferrer" color="neutral">{figure.label} · {figure.license}</Link>
      {expanded && <> · {figure.credit}</>}
    </Typography>}
  </Box>;
}

export default function NewsSection() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [index, setIndex] = useState<NewsIndex | null>(null);
  const [mode, setMode] = useState("dates");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [collectionDate, setCollectionDate] = useState("");
  const [collection, setCollection] = useState<Collection | null>(null);
  const [topic, setTopic] = useState("all");
  const [publicationType, setPublicationType] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("relevance");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [error, setError] = useState("");
  const [collectionError, setCollectionError] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchNews<Catalog>("catalog.json", controller.signal), fetchNews<NewsIndex>("index.json", controller.signal)])
      .then(([data, history]) => {
        if (!Array.isArray(data.papers) || !Array.isArray(history.editions)) throw new Error("The research archive is temporarily unavailable.");
        setCatalog(data); setIndex(history); setCollectionDate(history.latest || "");
        setEnd(data.updatedThrough); setStart([data.coverageStart, daysBefore(data.updatedThrough, 6)].sort().pop() || data.coverageStart);
      }).catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (mode !== "collections" || !collectionDate) return;
    const controller = new AbortController(); setCollectionLoading(true); setCollectionError(""); setCollection(null);
    fetchNews<Collection>(`${collectionDate}.json`, controller.signal)
      .then(data => { if (!Array.isArray(data.papers)) throw new Error("This collection is temporarily unavailable."); setCollection(data); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setCollectionError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setCollectionLoading(false); });
    return () => controller.abort();
  }, [mode, collectionDate]);
  useEffect(() => setVisibleCount(PAGE_SIZE), [start, end, topic, publicationType, source, sort, mode, collectionDate]);

  const invalidRange = mode === "dates" && (!start || !end || start > end || !!catalog && (start < catalog.coverageStart || end > catalog.updatedThrough));
  const catalogFigures = useMemo(() => new Map(catalog?.papers.filter(paper => paper.figure).map(paper => [paper.id, paper.figure])), [catalog]);
  const results = useMemo(() => {
    const current = mode === "collections" ? collection?.papers || [] : catalog?.papers || [];
    if (invalidRange) return [];
    return current.filter(paper => (mode === "collections" || (paper.date >= start && paper.date <= end))
      && (topic === "all" || paper.categories.includes(topic)) && (source === "all" || paper.source === source)
      && (publicationType === "all" || paper.publicationType === publicationType))
      .map(paper => ({ ...paper, figure: paper.figure || catalogFigures.get(paper.id) }))
      .sort((a, b) => sort === "relevance" ? (b.relevanceScore || 0) - (a.relevanceScore || 0) || b.date.localeCompare(a.date) : b.date.localeCompare(a.date) || (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }, [catalog, catalogFigures, collection, mode, start, end, topic, source, publicationType, sort, invalidRange]);
  const selectedSourceStatus = mode === "collections" ? collection?.sources : catalog?.sources;
  const busy = loading || (mode === "collections" && collectionLoading);
  const currentError = error || (mode === "collections" ? collectionError : "");
  const resetFilters = () => { setTopic("all"); setSource("all"); setPublicationType("all"); setSort("relevance"); };

  return <Box component="section" id="news" position="relative">
    <Stack direction="row" spacing={2} alignItems="baseline" justifyContent="space-between" flexWrap="wrap" useFlexGap mb={2}>
      <Typography level="h2">News 🧬</Typography>
      {catalog && <Typography level="body-sm">Updated <Typography component="span" textColor="success.softColor" fontWeight="lg">{displayDate(catalog.updatedThrough)}</Typography></Typography>}
    </Stack>
    <Typography level="body-md" mb={1}>Explore <Typography component="span" textColor="primary.softColor" fontWeight="lg">computational immunology</Typography> from bioRxiv and Europe PMC / PubMed.</Typography>
    <Typography level="body-sm" mb={3}>Browse publication dates from October 1, 2026, or revisit an actual daily collection. Automatic topic matching helps discovery; it does not judge scientific quality.</Typography>
    {catalog && <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "md", p: { xs: 1.5, sm: 2 }, mb: 3, bgcolor: "background.surface" }}>
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} mb={2}>
        <Button size="sm" variant={mode === "dates" ? "soft" : "plain"} color={mode === "dates" ? "primary" : "neutral"} startDecorator={<CalendarMonthRoundedIcon />} onClick={() => setMode("dates")}>Publication dates</Button>
        <Button size="sm" variant={mode === "collections" ? "soft" : "plain"} color={mode === "collections" ? "primary" : "neutral"} startDecorator={<ArticleOutlinedIcon />} onClick={() => setMode("collections")}>Daily collections</Button>
      </Stack>
      {mode === "dates" ? <>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} alignItems="flex-end" mb={2}>
          <FormControl sx={{ flex: "1 1 145px", maxWidth: { sm: 190 } }}><FormLabel htmlFor="news-date-start">From</FormLabel><Input type="date" value={start} slotProps={{ input: { id: "news-date-start", min: catalog.coverageStart, max: catalog.updatedThrough } }} onChange={event => setStart(event.target.value)} /></FormControl>
          <FormControl sx={{ flex: "1 1 145px", maxWidth: { sm: 190 } }}><FormLabel htmlFor="news-date-end">Through</FormLabel><Input type="date" value={end} slotProps={{ input: { id: "news-date-end", min: catalog.coverageStart, max: catalog.updatedThrough } }} onChange={event => setEnd(event.target.value)} /></FormControl>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <Button size="sm" variant="plain" onClick={() => { setStart(catalog.updatedThrough); setEnd(catalog.updatedThrough); }}>Latest day</Button>
            <Button size="sm" variant="plain" onClick={() => { setStart([catalog.coverageStart, daysBefore(catalog.updatedThrough, 6)].sort().pop() || catalog.coverageStart); setEnd(catalog.updatedThrough); }}>7 days</Button>
            <Button size="sm" variant="plain" onClick={() => { setStart(catalog.coverageStart); setEnd(catalog.updatedThrough); }}>All dates</Button>
          </Stack>
        </Stack>
        <Typography level="body-xs" mb={2}>Choose the same start and end date for one day. Dates refer to publication or preprint posting / revision, including records collected retrospectively.</Typography>
      </> : <FormControl sx={{ maxWidth: 320, mb: 2 }}><FormLabel id="news-collection-label">Collected on (UTC)</FormLabel><Select aria-labelledby="news-collection-label" value={collectionDate || null} onChange={(_, value) => { if (value) setCollectionDate(value); }}>{index?.editions.map(item => <Option key={item.date} value={item.date}>{displayDate(item.date)} · {item.count} papers</Option>)}</Select><Typography level="body-xs" mt={1}>Saved collections start on October 27, 2026. Earlier publication dates are available in the date browser.</Typography></FormControl>}
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="flex-end">
        <FormControl sx={{ flex: "2 1 210px" }}><FormLabel id="news-topic-label">Topic</FormLabel><Select aria-labelledby="news-topic-label" value={topic} onChange={(_, value) => setTopic(value || "all")}><Option value="all">All topics</Option>{topicNames.map(name => <Option key={name} value={name}>{name}</Option>)}</Select></FormControl>
        <FormControl sx={{ flex: "1 1 145px" }}><FormLabel id="news-type-label">Article type</FormLabel><Select aria-labelledby="news-type-label" value={publicationType} onChange={(_, value) => setPublicationType(value || "all")}><Option value="all">All types</Option><Option value="Journal article">Journal articles</Option><Option value="Preprint">Preprints</Option></Select></FormControl>
        <FormControl sx={{ flex: "1 1 145px" }}><FormLabel id="news-source-label">Source</FormLabel><Select aria-labelledby="news-source-label" value={source} onChange={(_, value) => setSource(value || "all")}><Option value="all">All sources</Option><Option value="bioRxiv">bioRxiv</Option><Option value="Europe PMC">Europe PMC</Option></Select></FormControl>
        <FormControl sx={{ flex: "1 1 145px" }}><FormLabel id="news-sort-label">Sort by</FormLabel><Select aria-labelledby="news-sort-label" value={sort} onChange={(_, value) => setSort(value || "newest")}><Option value="newest">Newest first</Option><Option value="relevance">Research relevance</Option></Select></FormControl>
        <Button size="sm" variant="plain" color="neutral" onClick={resetFilters}>Reset filters</Button>
      </Stack>
    </Box>}
    <Box aria-live="polite" aria-busy={busy}>
      {busy && <Stack direction="row" spacing={1} alignItems="center" py={3}><CircularProgress size="sm" /><Typography>Loading research papers…</Typography></Stack>}
      {currentError && <Alert color="warning">{currentError}</Alert>}
      {invalidRange && !loading && <Alert color="warning">Choose a date range between {catalog?.coverageStart} and {catalog?.updatedThrough}, with the start on or before the end.</Alert>}
      {!busy && !currentError && !invalidRange && <>
        {selectedSourceStatus?.some(item => item.status !== "ok") && <Alert color="warning" sx={{ mb: 2 }}>Some sources were unavailable during the latest collection. Existing records remain available.</Alert>}
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1} mb={2}>
          <Typography level="body-sm"><Typography component="span" fontWeight="lg" textColor="primary.softColor">{results.length}</Typography> matching papers · showing {Math.min(results.length, visibleCount)}{catalog ? ` · ${catalog.papers.length} in the index` : ""}</Typography>
          <Typography level="body-xs">Preprints have not been peer reviewed.</Typography>
        </Stack>
        {results.length ? <ResearchCarousel ariaLabel="Research paper cards">
          {results.slice(0, visibleCount).map(paper => <Card key={paper.id} component="article" variant="soft" size="sm" sx={{ width: "min(320px, calc(100vw - 60px))", flexShrink: 0 }}>
            <PaperVisual paper={paper} />
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} mt={0.5}>
              <Chip size="sm" variant="outlined" color={paper.publicationType === "Preprint" ? "warning" : "success"}>{paper.publicationType}</Chip>
              <Chip size="sm" variant="plain" color="primary">{paper.source}</Chip>
            </Stack>
            <Typography level="title-lg" sx={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "4.5em" }}>{paper.title}</Typography>
            <Typography level="body-xs" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{paper.authors || "Authors at source"}</Typography>
            <Typography level="body-xs" textColor="primary.softColor" sx={{ minHeight: "2.8em" }}>{paper.venue} · {displayDate(paper.date)}</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {paper.categories.slice(0, 2).map(category => <Chip key={category} size="sm" color={topicColor(category)} variant="soft">{category}</Chip>)}
              {paper.categories.length > 2 && <Chip size="sm" variant="plain">+{paper.categories.length - 2}</Chip>}
            </Stack>
            <CardContent>
              <Typography level="body-sm" sx={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", mb: 2 }}>{paper.abstract || "Read the full details at the source."}</Typography>
              <Stack direction="row" spacing={1} justifyContent="space-between" mt="auto"><Button variant="plain" size="sm" component="a" href={paper.url} target="_blank" rel="noopener noreferrer" startDecorator={<OpenInNewRoundedIcon />}>Article</Button><Button size="sm" startDecorator={<VisibilityRoundedIcon />} onClick={() => setSelectedPaper(paper)}>Details</Button></Stack>
            </CardContent>
          </Card>)}
        </ResearchCarousel> : <Card variant="soft"><Typography>No matching papers in this date range. Try another date or broaden the filters.</Typography></Card>}
        {results.length > visibleCount && <Box textAlign="center" mt={2}><Button variant="soft" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>Show next {Math.min(PAGE_SIZE, results.length - visibleCount)} papers</Button></Box>}
      </>}
    </Box>
    <Modal open={!!selectedPaper} onClose={() => setSelectedPaper(null)}>
      <ModalDialog sx={{ width: "90vw", maxWidth: 800, maxHeight: "88vh" }} aria-labelledby="paper-title">
        <ModalClose aria-label="Close paper details" />
        {selectedPaper && <><DialogTitle id="paper-title" sx={{ pr: 4 }}>{selectedPaper.title}</DialogTitle><DialogContent>
          <Typography level="body-sm">{selectedPaper.authors}</Typography>
          <Typography level="body-sm" textColor="primary.softColor" my={1}>{selectedPaper.publicationType} · {selectedPaper.venue} · {selectedPaper.dateLabel} {displayDate(selectedPaper.date)}{selectedPaper.version ? ` · v${selectedPaper.version}` : ""}</Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap my={1}>{selectedPaper.categories.map(category => <Chip key={category} size="sm" color={topicColor(category)}>{category}</Chip>)}</Stack>
          {selectedPaper.figure && <Box my={2}><PaperVisual paper={selectedPaper} expanded /><Typography level="body-sm" mt={1}>{selectedPaper.figure.caption}</Typography><Link href={selectedPaper.figure.licenseUrl} target="_blank" rel="noopener noreferrer" level="body-xs">Figure licence: {selectedPaper.figure.license}</Link></Box>}
          <Typography level="title-md" mt={2} mb={1}>Abstract</Typography><Typography sx={{ whiteSpace: "pre-line" }}>{selectedPaper.abstract || "The source did not provide an abstract. Open the article to learn more."}</Typography>
          {selectedPaper.doi && <Typography level="body-sm" mt={2} sx={{ overflowWrap: "anywhere" }}>DOI: {selectedPaper.doi}</Typography>}
          <Typography level="body-xs" mt={2}>Metadata supplied by {selectedPaper.source}. Topic labels and relevance order are automatic. Article figures, where available, retain their original attribution.</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mt={3}><Button component="a" href={selectedPaper.url} target="_blank" rel="noopener noreferrer" startDecorator={<OpenInNewRoundedIcon />}>Read at source</Button>{selectedPaper.publishedDoi && <Button variant="soft" component="a" href={`https://doi.org/${selectedPaper.publishedDoi}`} target="_blank" rel="noopener noreferrer">Published version</Button>}</Stack>
        </DialogContent></>}
      </ModalDialog>
    </Modal>
  </Box>;
}
