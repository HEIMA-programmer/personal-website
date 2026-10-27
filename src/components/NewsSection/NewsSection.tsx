import { useEffect, useMemo, useState } from "react";
import { Alert, AspectRatio, Box, Button, Card, CardContent, Chip, CircularProgress, DialogContent, DialogTitle, FormControl, FormLabel, IconButton, Input, Link, Modal, ModalClose, ModalDialog, Option, Select, Stack, Tooltip, Typography } from "@mui/joy";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import BiotechOutlinedIcon from "@mui/icons-material/BiotechOutlined";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ZoomInRoundedIcon from "@mui/icons-material/ZoomInRounded";
import ResearchCarousel from "../ResearchCarousel/ResearchCarousel";
import FigureLightbox, { type Figure } from "./FigureLightbox";
import "./NewsSection.css";

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

function PaperVisual({ paper, expanded = false, onEnlarge }: { paper: Paper; expanded?: boolean; onEnlarge?: () => void }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [paper.figure?.url]);
  const figure = paper.figure && !failed ? paper.figure : null;
  return <Box>
    <Box component={figure && onEnlarge ? "button" : "div"} onClick={figure ? onEnlarge : undefined} aria-label={figure && onEnlarge ? `Enlarge ${figure.label}` : undefined} sx={{ display: "block", width: "100%", p: 0, border: 0, bgcolor: "transparent", position: "relative", cursor: figure && onEnlarge ? "zoom-in" : "default", borderRadius: "sm", "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500", outlineOffset: 2 } }}>
    <AspectRatio ratio={expanded ? "16 / 9" : "16 / 7"} sx={{ borderRadius: "sm", overflow: "hidden", bgcolor: "background.level1" }}>
      {figure ? <img src={figure.url} alt={`${figure.label}: ${figure.caption || paper.title}`} loading="lazy" decoding="async" onError={() => setFailed(true)} style={{ objectFit: "contain", background: "#fff", padding: expanded ? 12 : 8, boxSizing: "border-box" }} /> :
        <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ background: "linear-gradient(135deg, var(--joy-palette-primary-softBg), var(--joy-palette-success-softBg))" }}>
          <BiotechOutlinedIcon sx={{ fontSize: expanded ? 58 : 30, color: "primary.softColor" }} />
          <Typography level="title-sm" textColor="primary.softColor">{paper.categories[0] || "Computational immunology"}</Typography>
          <Typography level="body-xs" textColor="text.secondary">Article figure not available</Typography>
        </Stack>}
    </AspectRatio>
    {figure && onEnlarge && <Box aria-hidden="true" sx={{ position: "absolute", right: 6, bottom: 6, display: "grid", placeItems: "center", borderRadius: "sm", bgcolor: "rgba(15,30,45,.78)", color: "#fff", p: 0.5 }}><ZoomInRoundedIcon sx={{ fontSize: 18 }} /></Box>}
    </Box>
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
  const [periodPreset, setPeriodPreset] = useState("week");
  const [moreFilters, setMoreFilters] = useState(false);
  const [pagination, setPagination] = useState({ query: "", page: 0 });
  const [loading, setLoading] = useState(true);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [error, setError] = useState("");
  const [collectionError, setCollectionError] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [selectedFigure, setSelectedFigure] = useState<Figure | null>(null);

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
  const queryKey = JSON.stringify([mode, start, end, collectionDate, topic, publicationType, source, sort]);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = pagination.query === queryKey ? Math.min(pagination.page, pageCount - 1) : 0;
  const pageStart = page * PAGE_SIZE;
  const pagePapers = results.slice(pageStart, pageStart + PAGE_SIZE);
  const changePage = (next: number) => setPagination({ query: queryKey, page: Math.max(0, Math.min(next, pageCount - 1)) });
  const extraFilterCount = Number(source !== "all") + Number(publicationType !== "all") + Number(sort !== "relevance");
  const editionDates = collection?.papers.map(paper => paper.date).sort() || [];
  const dateMeaning = mode === "dates"
    ? "By each paper's publication or bioRxiv posting/revision date (UTC), as currently indexed. Saved editions use the date this site collected the papers instead."
    : `Saved on this site on ${displayDate(collectionDate || catalog?.updatedThrough || "2026-10-27")}. The papers may be older${editionDates.length ? `: this edition's publication dates run from ${displayDate(editionDates[0])} to ${displayDate(editionDates[editionDates.length - 1])}` : ""}. Original editions are preserved.`;
  const singleDay = periodPreset === "day" || periodPreset === "latest";
  const choosePeriod = (value: string) => {
    if (!catalog) return;
    setPeriodPreset(value);
    if (value === "day") { const date = end || catalog.updatedThrough; setStart(date); setEnd(date); }
    if (value === "latest") { setStart(catalog.updatedThrough); setEnd(catalog.updatedThrough); }
    if (value === "week") { setStart([catalog.coverageStart, daysBefore(catalog.updatedThrough, 6)].sort().pop() || catalog.coverageStart); setEnd(catalog.updatedThrough); }
    if (value === "all") { setStart(catalog.coverageStart); setEnd(catalog.updatedThrough); }
  };

  return <Box component="section" id="news" position="relative" aria-labelledby="news-title">
    <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between" flexWrap="wrap" useFlexGap mb={2}>
      <Stack direction="row" alignItems="baseline" spacing={2}>
        <Typography id="news-title" level="h2">News 🧬</Typography>
        <Typography level="body-sm" sx={{ display: { xs: "none", sm: "block" } }}>Computational immunology</Typography>
      </Stack>
      {catalog && <Typography level="body-xs">Updated <Typography component="span" textColor="success.softColor">{displayDate(catalog.updatedThrough)}</Typography></Typography>}
    </Stack>
    {catalog && <>
      <Box className="news-primary-controls">
        <Select size="sm" className="news-browse-mode" aria-label="Browse by publication date or daily collection" value={mode}
          startDecorator={mode === "dates" ? <CalendarMonthRoundedIcon /> : <ArticleOutlinedIcon />}
          renderValue={option => option?.value === "collections" ? "Saved editions" : "Published"}
          onChange={(_, value) => { if (value) setMode(value); }}>
          <Option value="dates">Published / posted date</Option><Option value="collections">Saved editions · collection date</Option>
        </Select>
        {mode === "dates" ? <>
          <Select size="sm" className="news-period-preset" aria-label="Publication date period" value={periodPreset} onChange={(_, value) => { if (value) choosePeriod(value); }}>
            <Option value="latest">Latest day</Option><Option value="week">Last 7 days</Option><Option value="day">Single day</Option><Option value="range">Date range</Option><Option value="all">All dates</Option>
          </Select>
          <Box className="news-date-inputs">
            <Input size="sm" type="date" value={start} slotProps={{ input: { id: "news-date-start", "aria-label": singleDay ? "Publication date" : "Published from", min: catalog.coverageStart, max: catalog.updatedThrough } }} onChange={event => { setStart(event.target.value); if (singleDay) { setEnd(event.target.value); setPeriodPreset("day"); } else setPeriodPreset("range"); }} />
            {!singleDay && <><Typography level="body-sm" aria-hidden="true">–</Typography><Input size="sm" type="date" value={end} slotProps={{ input: { id: "news-date-end", "aria-label": "Published through", min: catalog.coverageStart, max: catalog.updatedThrough } }} onChange={event => { setEnd(event.target.value); setPeriodPreset("range"); }} /></>}
          </Box>
        </> : <Select size="sm" className="news-collection-date" aria-label="Edition saved on, UTC" title="The date this site saved the edition, not the papers' publication date." value={collectionDate || null} onChange={(_, value) => { if (value) setCollectionDate(value); }}>
          {index?.editions.map(item => <Option key={item.date} value={item.date}>{displayDate(item.date)} · {item.count} papers</Option>)}
        </Select>}
        <Select size="sm" className="news-topic" aria-label="Research topic" value={topic} onChange={(_, value) => setTopic(value || "all")}>
          <Option value="all">All topics</Option>{topicNames.map(name => <Option key={name} value={name}>{name}</Option>)}
        </Select>
        <Button size="sm" variant={moreFilters || extraFilterCount ? "soft" : "plain"} color="neutral" startDecorator={<TuneRoundedIcon />} aria-expanded={moreFilters} aria-controls="news-more-filters" onClick={() => setMoreFilters(value => !value)} sx={{ flexShrink: 0 }}>
          More filters{extraFilterCount > 0 ? ` (${extraFilterCount})` : ""}
        </Button>
      </Box>
      {moreFilters && <Stack id="news-more-filters" direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="flex-end" sx={{ p: 1.5, mt: 1, borderRadius: "sm", bgcolor: "background.level1" }}>
        <FormControl sx={{ flex: "1 1 150px" }}><FormLabel id="news-type-label">Article type</FormLabel><Select size="sm" aria-labelledby="news-type-label" value={publicationType} onChange={(_, value) => setPublicationType(value || "all")}><Option value="all">All types</Option><Option value="Journal article">Journal articles</Option><Option value="Preprint">Preprints</Option></Select></FormControl>
        <FormControl sx={{ flex: "1 1 150px" }}><FormLabel id="news-source-label">Source</FormLabel><Select size="sm" aria-labelledby="news-source-label" value={source} onChange={(_, value) => setSource(value || "all")}><Option value="all">All sources</Option><Option value="bioRxiv">bioRxiv</Option><Option value="Europe PMC">Europe PMC / PubMed</Option></Select></FormControl>
        <FormControl sx={{ flex: "1 1 170px" }}><FormLabel id="news-sort-label">Sort by</FormLabel><Select size="sm" aria-labelledby="news-sort-label" value={sort} onChange={(_, value) => setSort(value || "relevance")}><Option value="relevance">Research relevance</Option><Option value="newest">Newest first</Option></Select></FormControl>
        <Button size="sm" variant="plain" color="neutral" onClick={resetFilters}>Reset filters</Button>
      </Stack>}
    </>}
    <Box aria-busy={busy}>
      {busy && <Stack direction="row" spacing={1} alignItems="center" py={3}><CircularProgress size="sm" /><Typography>Loading research papers…</Typography></Stack>}
      {currentError && <Alert color="warning">{currentError}</Alert>}
      {invalidRange && !loading && <Alert color="warning">Choose a date range between {catalog?.coverageStart} and {catalog?.updatedThrough}, with the start on or before the end.</Alert>}
      {!busy && !currentError && !invalidRange && <>
        {selectedSourceStatus?.some(item => item.status !== "ok") && <Alert color="warning" sx={{ mb: 2 }}>Some sources were unavailable during the latest collection. Existing records remain available.</Alert>}
        <Box className="news-results-toolbar">
          <Stack direction="row" spacing={0.25} alignItems="center">
            <Typography level="body-sm" aria-live="polite" aria-atomic="true"><Typography component="span" fontWeight="lg" textColor="primary.softColor">{results.length}</Typography> {mode === "dates" ? "published" : "saved"}{results.length > 0 ? ` · ${pageStart + 1}–${pageStart + pagePapers.length}` : ""}</Typography>
            <Tooltip title={dateMeaning} placement="top-start" sx={{ maxWidth: 360 }}><IconButton size="sm" variant="plain" color="neutral" aria-label={dateMeaning} sx={{ minWidth: 24, minHeight: 24 }}><InfoOutlinedIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
          </Stack>
          <Stack component="nav" aria-label="Research paper pages" direction="row" spacing={0.5} alignItems="center">
            <IconButton size="sm" variant="plain" color="neutral" aria-label="Previous page of papers" disabled={page === 0 || !results.length} onClick={() => changePage(page - 1)}><ChevronLeftRoundedIcon /></IconButton>
            <Select size="sm" variant="plain" aria-label="Research papers page" value={page} disabled={!results.length} onChange={(_, value) => { if (value !== null) changePage(value); }} renderValue={() => `${page + 1} / ${pageCount}`} sx={{ minWidth: 82 }} slotProps={{ listbox: { sx: { maxHeight: 240 } } }}>
              {Array.from({ length: pageCount }, (_, number) => <Option key={number} value={number}>Page {number + 1}</Option>)}
            </Select>
            <IconButton size="sm" variant="plain" color="neutral" aria-label="Next page of papers" disabled={page >= pageCount - 1 || !results.length} onClick={() => changePage(page + 1)}><ChevronRightRoundedIcon /></IconButton>
          </Stack>
        </Box>
        {results.length ? <ResearchCarousel key={`${queryKey}:${page}`} ariaLabel={`Research papers, page ${page + 1} of ${pageCount}`}>
          {pagePapers.map(paper => <Card key={paper.id} component="article" variant="soft" size="sm" sx={{ width: "min(320px, calc(100vw - 60px))", flexShrink: 0 }}>
            <PaperVisual paper={paper} onEnlarge={() => setSelectedFigure(paper.figure || null)} />
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} mt={0.5}>
              <Chip size="sm" variant="outlined" color={paper.publicationType === "Preprint" ? "warning" : "success"} title={paper.publicationType === "Preprint" ? "Preprints have not been peer reviewed." : undefined}>{paper.publicationType}</Chip>
              <Chip size="sm" variant="plain" color="primary">{paper.source}</Chip>
            </Stack>
            <Typography component="h3" level="title-lg" sx={{ fontSize: "1.05rem", lineHeight: 1.4, overflowWrap: "anywhere" }}>{paper.title}</Typography>
            <Typography level="body-xs" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{paper.authors || "Authors at source"}</Typography>
            <Typography level="body-xs" textColor="primary.softColor">{paper.venue} · {displayDate(paper.date)}</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {paper.categories.slice(0, 2).map(category => <Chip key={category} size="sm" color={topicColor(category)} variant="soft">{category}</Chip>)}
              {paper.categories.length > 2 && <Chip size="sm" variant="plain">+{paper.categories.length - 2}</Chip>}
            </Stack>
            <CardContent>
              <Stack direction="row" spacing={1} justifyContent="space-between" mt="auto"><Button variant="plain" size="sm" component="a" href={paper.url} target="_blank" rel="noopener noreferrer" startDecorator={<OpenInNewRoundedIcon />}>Article</Button><Button size="sm" startDecorator={<VisibilityRoundedIcon />} onClick={() => setSelectedPaper(paper)}>Details</Button></Stack>
            </CardContent>
          </Card>)}
        </ResearchCarousel> : <Card variant="soft"><Typography>No matching papers in this date range. Try another date or broaden the filters.</Typography></Card>}
      </>}
    </Box>
    {selectedPaper && <Modal open onClose={() => setSelectedPaper(null)}>
      <ModalDialog sx={{ width: "90vw", maxWidth: 800, maxHeight: "88vh" }} aria-labelledby="paper-title">
        <ModalClose aria-label="Close paper details" />
        <DialogTitle id="paper-title" sx={{ pr: 4 }}>{selectedPaper.title}</DialogTitle><DialogContent>
          <Typography level="body-sm">{selectedPaper.authors}</Typography>
          <Typography level="body-sm" textColor="primary.softColor" my={1}>{selectedPaper.publicationType} · {selectedPaper.venue} · {selectedPaper.dateLabel} {displayDate(selectedPaper.date)}{selectedPaper.version ? ` · v${selectedPaper.version}` : ""}</Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap my={1}>{selectedPaper.categories.map(category => <Chip key={category} size="sm" color={topicColor(category)}>{category}</Chip>)}</Stack>
          {selectedPaper.figure && <Box my={2}><PaperVisual paper={selectedPaper} expanded onEnlarge={() => setSelectedFigure(selectedPaper.figure || null)} /><Typography level="body-sm" mt={1}>{selectedPaper.figure.caption}</Typography><Link href={selectedPaper.figure.licenseUrl} target="_blank" rel="noopener noreferrer" level="body-xs">Figure licence: {selectedPaper.figure.license}</Link></Box>}
          <Typography level="title-md" mt={2} mb={1}>Abstract</Typography><Typography sx={{ whiteSpace: "pre-line" }}>{selectedPaper.abstract || "The source did not provide an abstract. Open the article to learn more."}</Typography>
          {selectedPaper.doi && <Typography level="body-sm" mt={2} sx={{ overflowWrap: "anywhere" }}>DOI: {selectedPaper.doi}</Typography>}
          <Typography level="body-xs" mt={2}>Metadata supplied by {selectedPaper.source}. Topic labels and relevance order are automatic. Article figures, where available, retain their original attribution.</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mt={3}><Button component="a" href={selectedPaper.url} target="_blank" rel="noopener noreferrer" startDecorator={<OpenInNewRoundedIcon />}>Read at source</Button>{selectedPaper.publishedDoi && <Button variant="soft" component="a" href={`https://doi.org/${selectedPaper.publishedDoi}`} target="_blank" rel="noopener noreferrer">Published version</Button>}</Stack>
        </DialogContent>
      </ModalDialog>
    </Modal>}
    <FigureLightbox figure={selectedFigure} onClose={() => setSelectedFigure(null)} />
  </Box>;
}
