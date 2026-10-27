import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CATALOG_START = "2026-10-01";
export const NEWS_CATEGORIES = ["Repertoire & clonal dynamics", "Single-cell immunology", "Antigen & receptor prediction", "Immunotherapy", "Systems immunology"];
const IMMUNE = /\b(?:immun(?:e|ity|olog\w*|otherap\w*|ogen\w*|oinformatic\w*|oprofil\w*|ophenotyp\w*|osuppress\w*)|t[ -]?cells?|b[ -]?cells?|tcrs?|bcrs?|lymphocytes?|antibod\w*|antigens?|epitopes?|neoantigens?|mhc|hla|clonotyp\w*|neutrophils?|macrophages?|monocytes?|dendritic cells?|nk[ -]?cells?|natural killer cells?|pbmcs?|microgli\w*|mast cells?|cytokin\w*|interferon\w*)\b/i;
const RECEPTOR_FOCUS = /\b(?:tcrs?|bcrs?|clonotyp\w*|immune repertoire\w*|antigen specificity|epitope\w*|neoantigen\w*|mhc|hla)\b/i;
const COMPUTATIONAL = /\b(?:computational|bioinformatic\w*|algorithm\w*|machine learning|deep learning|neural network\w*|single[ -]cell|scrna[ -]?seq|sc[ -]?tcr[ -]?seq|repertoire\w*|clonotyp\w*|multi[ -]?omic\w*|spatial transcriptom\w*|statistical model\w*|mathematical model\w*|representation learning|in silico)\b/i;
const TOPICS = [
  /\b(?:repertoire\w*|clonotyp\w*|clonal|tcrs?|bcrs?|v\(d\)j)\b/i,
  /\b(?:single[ -]cell|scrna[ -]?seq|scatac[ -]?seq|spatial transcriptom\w*)\b/i,
  /\b(?:epitope\w*|neoantigen\w*|antigen specificity|antigen prediction|binding prediction|receptor prediction|mhc|hla)\b/i,
  /\b(?:immunotherap\w*|car[ -]?t|checkpoint|cancer vaccine\w*|tumou?r microenvironment)\b/i,
];

export function cleanText(value = "") {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Math.min(Number(number), 0x10ffff)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity])
    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
export function normalizeDoi(value = "") {
  const doi = String(value).trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : "";
}
export function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || "") && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
export function classifyPaper(paper) {
  const text = `${paper.title} ${paper.abstract}`;
  // A fusion gene or routine inflammation ratio alone does not establish an immune research focus.
  const focusText = value => String(value || "").replace(/\bBCR\s*(?:::|[-–])\s*ABL\d?\b/gi, "fusion gene")
    .replace(/\b(?:systemic immune[ -]inflammation index|(?:neutrophil|platelet|lymphocyte)[ -](?:to[ -])?(?:lymphocyte|monocyte) ratio)\b/gi, "clinical blood marker");
  const immuneTitle = focusText(paper.title);
  const immuneAbstract = focusText(paper.abstract);
  const immuneText = `${immuneTitle} ${immuneAbstract}`;
  const immuneSentences = immuneAbstract.split(/(?<=[.!?])\s+/).filter(sentence => IMMUNE.test(sentence));
  const immuneConcepts = new Set((immuneAbstract.match(new RegExp(IMMUNE.source, "gi")) || []).map(term => term.toLowerCase().replace(/[ -]/g, "").replace(/s$/, "")));
  // A passing background mention of "immune" in a general omics paper is insufficient.
  const immuneFocus = IMMUNE.test(immuneTitle) || RECEPTOR_FOCUS.test(immuneText) || immuneConcepts.size >= 2 || immuneSentences.length >= 2;
  if (!immuneFocus || !COMPUTATIONAL.test(text) || /\bretract(?:ed|ion)\b/i.test(paper.title)) return null;
  const categories = NEWS_CATEGORIES.filter((_, index) => TOPICS[index]?.test(immuneText));
  if (!categories.length) categories.push(NEWS_CATEGORIES[4]);
  const relevanceScore = 2 + (IMMUNE.test(immuneTitle) ? 3 : 0) + (COMPUTATIONAL.test(paper.title) ? 3 : 0)
    + (TOPICS[0].test(immuneText) ? 4 : 0) + (TOPICS[1].test(immuneText) ? 2 : 0)
    + (/\b(?:longitudinal|temporal|trajectory|trajectories|clonal dynamics)\b/i.test(text) ? 2 : 0);
  return { ...paper, categories, relevanceScore };
}
export function fromBioRxiv(item) {
  const doi = normalizeDoi(item.doi);
  return {
    id: doi ? `doi:${doi}` : `biorxiv:${item.title}`, title: cleanText(item.title), authors: cleanText(item.authors), abstract: cleanText(item.abstract),
    date: item.date, dateLabel: "Posted / revised", doi, url: doi ? `https://doi.org/${doi}` : "https://www.biorxiv.org/",
    source: "bioRxiv", venue: "bioRxiv", publicationType: "Preprint", version: String(item.version || "1"), license: item.license || "",
    publishedDoi: normalizeDoi(item.published), pmcid: "", openAccess: true,
    jatsUrl: /^https:\/\/www\.biorxiv\.org\/content\/[^\s]+\.source\.xml$/.test(item.jatsxml || "") ? item.jatsxml : "",
  };
}
export function fromEuropePmc(item) {
  const doi = normalizeDoi(item.doi);
  const preprint = item.source === "PPR" || item.pubTypeList?.pubType?.some((type) => /preprint/i.test(type));
  return {
    id: doi ? `doi:${doi}` : `epmc:${item.source}:${item.id}`, title: cleanText(item.title), authors: cleanText(item.authorString), abstract: cleanText(item.abstractText),
    date: item.firstPublicationDate, dateLabel: preprint ? "Posted" : "Published", doi,
    url: doi ? `https://doi.org/${doi}` : `https://europepmc.org/article/${encodeURIComponent(item.source)}/${encodeURIComponent(item.id)}`,
    source: "Europe PMC", venue: cleanText(item.journalInfo?.journal?.title || (preprint ? "Preprint" : "Europe PMC")),
    publicationType: preprint ? "Preprint" : "Journal article", version: "", license: item.license || "", publishedDoi: "",
    pmcid: /^PMC\d+$/.test(item.pmcid || "") ? item.pmcid : "", openAccess: item.isOpenAccess === "Y", inEuropePmc: item.inEPMC === "Y",
  };
}
export function mergePapers(papers, endDate, startDate = CATALOG_START) {
  const unique = new Map();
  for (const paper of papers) {
    if (!paper.title || !validDate(paper.date) || paper.date > endDate || paper.date < startDate) continue;
    const selected = classifyPaper(paper);
    if (!selected) continue;
    const previous = unique.get(selected.id);
    if (!previous) { unique.set(selected.id, selected); continue; }
    const newer = Number(selected.version || 0) > Number(previous.version || 0)
      || (Number(selected.version || 0) === Number(previous.version || 0) && selected.abstract.length >= previous.abstract.length);
    const preferred = newer ? selected : previous;
    unique.set(selected.id, { ...preferred, figure: preferred.figure || previous.figure || selected.figure || null, figureCheckedAt: preferred.figureCheckedAt || previous.figureCheckedAt || selected.figureCheckedAt || "", figurePolicyVersion: preferred.figurePolicyVersion || previous.figurePolicyVersion || selected.figurePolicyVersion, figureCheckStatus: preferred.figureCheckStatus || previous.figureCheckStatus || selected.figureCheckStatus, firstSeen: previous.firstSeen || selected.firstSeen, pmcid: preferred.pmcid || previous.pmcid || selected.pmcid || "", jatsUrl: preferred.jatsUrl || previous.jatsUrl || selected.jatsUrl || "" });
  }
  return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date) || b.relevanceScore - a.relevanceScore || a.id.localeCompare(b.id));
}
export function selectPapers(papers, seenIds, editionDate, limit = Infinity) {
  return mergePapers(papers, editionDate).filter(paper => !seenIds.has(paper.id))
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).slice(0, limit);
}
export function filterByDate(papers, start, end) {
  if (!validDate(start) || !validDate(end) || start > end) return [];
  return papers.filter(paper => paper.date >= start && paper.date <= end);
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(url, format = "json", attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "YanbinXuResearchNews/2.0 (https://github.com/HEIMA-programmer/personal-website)", Accept: format === "json" ? "application/json" : "application/xml" }, signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return format === "json" ? await response.json() : await response.text();
    } catch (error) { if (attempt === attempts - 1) throw error; await pause(1500 * (attempt + 1)); }
  }
}
export async function fetchBioRxiv(start, end) {
  const papers = [];
  for (const category of ["immunology", "bioinformatics"]) {
    let cursor = 0, total = Infinity;
    while (cursor < total) {
      if (cursor >= 6000) throw new Error(`bioRxiv ${category} exceeded the 6,000-record safety limit`);
      const data = await request(`https://api.biorxiv.org/details/biorxiv/${start}/${end}/${cursor}?category=${category}`);
      const message = data.messages?.[0];
      if (!Array.isArray(data.collection) || !["ok", "no papers found"].includes(message?.status)) throw new Error(`bioRxiv returned an invalid response (${message?.status || "missing status"})`);
      total = Number(message.total || 0); papers.push(...data.collection.map(fromBioRxiv));
      if (!data.collection.length) break;
      cursor += data.collection.length; if (cursor < total) await pause(350);
    }
  }
  return papers;
}
export async function fetchEuropePmc(start, end) {
  const query = `(FIRST_PDATE:[${start} TO ${end}] OR FIRST_IDATE:[${start} TO ${end}]) AND (SRC:MED OR SRC:PMC) AND (TITLE_ABS:"immune repertoire" OR TITLE_ABS:clonotype OR TITLE_ABS:TCR OR TITLE_ABS:BCR OR TITLE_ABS:"computational immunology" OR ((TITLE_ABS:immune OR TITLE_ABS:immunotherapy OR TITLE_ABS:antibody OR TITLE_ABS:antigen) AND (TITLE_ABS:"single cell" OR TITLE_ABS:"machine learning" OR TITLE_ABS:"deep learning" OR TITLE_ABS:computational OR TITLE_ABS:bioinformatics))) NOT PUB_TYPE:"Retracted Publication"`;
  let cursor = "*"; const papers = [];
  for (let page = 0; page < 60; page++) {
    const params = new URLSearchParams({ query, format: "json", resultType: "core", pageSize: "100", cursorMark: cursor, sort: "P_PDATE_D desc" });
    const data = await request(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`);
    if (!Array.isArray(data.resultList?.result) || typeof data.hitCount !== "number") throw new Error("Europe PMC returned an invalid response");
    papers.push(...data.resultList.result.map(fromEuropePmc));
    if (!data.resultList.result.length || papers.length >= data.hitCount || !data.nextCursorMark || cursor === data.nextCursorMark) return papers;
    cursor = data.nextCursorMark; await pause(350);
  }
  throw new Error("Europe PMC exceeded the 6,000-record safety limit");
}

export function figureLicense(permissions, { allowNonCommercial = true } = {}) {
  const url = permissions.match(/https?:\/\/creativecommons\.org\/(?:licenses\/(?:by|by-sa|by-nd|by-nc|by-nc-sa|by-nc-nd)|publicdomain\/zero)\/[\d.]+\//i)?.[0];
  let licenseUrl = url?.toLowerCase().replace(/^http:/, "https:");
  // Some publishers explicitly name CC BY 4.0 but omit its URL in JATS.
  if (!licenseUrl && /Creative Commons Attribution 4\.0 International Licen[cs]e/i.test(cleanText(permissions))) licenseUrl = "https://creativecommons.org/licenses/by/4.0/";
  if (!licenseUrl) return null;
  const code = licenseUrl.match(/\/licenses\/([^/]+)\//)?.[1] || "cc0";
  const nonCommercial = code.includes("-nc"), noDerivatives = code.includes("-nd");
  if (nonCommercial && !allowNonCommercial) return null;
  return { licenseUrl, license: code === "cc0" ? "CC0" : `CC ${code.toUpperCase()}`, nonCommercial, noDerivatives };
}

/** Exact source figures only: explicit licence, original image path, no third-party exceptions. */
export function extractFigures(xml, paper, options) {
  const articlePermissions = xml.match(/<permissions(?=[\s>])[^>]*>[\s\S]*?<\/permissions>/i)?.[0] || "";
  const license = figureLicense(articlePermissions, options);
  if (!license) return [];
  const articleDoi = normalizeDoi(xml.match(/<article-id\b[^>]*pub-id-type="doi"[^>]*>([^<]+)<\/article-id>/i)?.[1]);
  if (articleDoi && paper.doi && articleDoi !== normalizeDoi(paper.doi)) return [];
  // A word boundary alone also matches <fig-count>; require the actual element.
  const blocks = [...xml.matchAll(/<fig(?=[\s>])[^>]*>[\s\S]*?<\/fig>/gi)];
  const figures = [];
  for (const [figure] of blocks) {
    if (/<permissions\b|(?:reproduced|reprinted|adapted) (?:with|by|from)|used (?:with|by) permission|all rights reserved|courtesy of|not included in.{0,60}licen[cs]e|copyright\s+(?:19|20)\d\d|biorender/i.test(figure)) continue;
    const graphic = figure.match(/<graphic\b[^>]*content-type="image"[^>]*>[\s\S]*?<\/graphic>/i)?.[0] || figure.match(/<graphic\b[^>]*>[\s\S]*?<\/graphic>/i)?.[0] || "";
    const cdnPath = graphic.match(/<\?cloudpmc-path\s+(blobs\/[A-Za-z0-9_./-]+)\s*\?>/)?.[1]
      || graphic.match(/<\?image-cloudpmc-urn\s+urn:cdn:(blobs\/[A-Za-z0-9_./-]+)\s*\?>/)?.[1];
    if (!cdnPath || cdnPath.includes("..") || !/\.(?:webp|png|jpe?g)$/i.test(cdnPath)) continue;
    const label = cleanText(figure.match(/<label>([\s\S]*?)<\/label>/i)?.[1] || "Article figure");
    const caption = cleanText(figure.match(/<caption>([\s\S]*?)<\/caption>/i)?.[1] || "");
    const figureId = figure.match(/<fig\b[^>]*\bid="([A-Za-z0-9_.:-]+)"/)?.[1] || "";
    figures.push({ url: `https://cdn.ncbi.nlm.nih.gov/pmc/${cdnPath}`, label, caption, sourceUrl: `https://europepmc.org/articles/${paper.pmcid}${figureId ? `#${figureId}` : ""}`, ...license, credit: cleanText(articlePermissions.match(/<copyright-statement\b[^>]*>([\s\S]*?)<\/copyright-statement>/i)?.[1] || `${paper.authors} · ${paper.venue}`) });
  }
  return figures;
}
export function extractFigure(xml, paper, options) { return extractFigures(xml, paper, options)[0] || null; }
async function verifyFigureUrl(url) {
  const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15000) });
  return response.ok && /^image\/(?:webp|png|jpeg)(?:;|$)/i.test(response.headers.get("content-type") || "");
}
async function enrichFigures(papers, date, maxRequests, { force = false, allowNonCommercial = true } = {}) {
  // Apply a stricter reuse policy to cached images even when the source is offline.
  if (!allowNonCommercial) for (const paper of papers) {
    if (paper.figure?.nonCommercial || /-NC(?:-|$)/i.test(paper.figure?.license || "")) paper.figure = null;
  }
  const retryBefore = new Date(`${date}T00:00:00Z`); retryBefore.setUTCDate(retryBefore.getUTCDate() - 7);
  const candidates = papers.filter(paper => paper.pmcid && (force || !paper.figure) && (force || paper.figurePolicyVersion !== 2 || !paper.figureCheckedAt || paper.figureCheckedAt < retryBefore.toISOString().slice(0, 10)))
    .sort((a, b) => Number(!!a.figureCheckedAt) - Number(!!b.figureCheckedAt) || b.date.localeCompare(a.date)).slice(0, maxRequests);
  let figures = 0;
  // Small batches avoid hammering the official full-text service.
  for (let index = 0; index < candidates.length; index += 3) {
    await Promise.all(candidates.slice(index, index + 3).map(async paper => {
      try {
        const xml = await request(`https://www.ebi.ac.uk/europepmc/webservices/rest/${paper.pmcid}/fullTextXML`, "text", 1);
        const candidates = extractFigures(xml, paper, { allowNonCommercial });
        let figure = null;
        for (const candidate of candidates.slice(0, 3)) {
          if (await verifyFigureUrl(candidate.url)) { figure = { ...candidate, verifiedAt: new Date().toISOString() }; break; }
        }
        paper.figure = figure; paper.figureCheckedAt = date; paper.figurePolicyVersion = 2;
        paper.figureCheckStatus = figure ? "verified" : candidates.length ? "image-unavailable" : "no-reusable-figure";
        if (figure) figures++;
      } catch { paper.figureCheckStatus = "source-unavailable"; /* Do not erase a known image on a transient failure. */ }
    }));
    if (index + 3 < candidates.length) await pause(700);
  }
  console.log(`Figures: ${figures} licensed original article images verified from ${candidates.length} records; ${papers.filter(paper => paper.figure).length} papers now illustrated.`);
}
export async function refreshNewsFigures({ outputDirectory = path.resolve("public/news"), imageLimit = 300, allowNonCommercial = true } = {}) {
  const filename = path.join(outputDirectory, "catalog.json");
  const catalog = await readJson(filename);
  await enrichFigures(catalog.papers, new Date().toISOString().slice(0, 10), imageLimit, { force: true, allowNonCommercial });
  catalog.figuresUpdatedAt = new Date().toISOString();
  await writeJson(filename, catalog);
  return catalog;
}
async function readJson(filename) { return JSON.parse(await readFile(filename, "utf8")); }
async function writeJson(filename, value) {
  const temporary = `${filename}.tmp`; await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`); await rename(temporary, filename);
}
export async function rebuildIndex(outputDirectory) {
  const names = (await readdir(outputDirectory)).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().reverse();
  const editions = await Promise.all(names.map(async name => { const edition = await readJson(path.join(outputDirectory, name)); return { date: edition.date, count: edition.papers.length, status: edition.status }; }));
  await writeJson(path.join(outputDirectory, "index.json"), { version: 2, latest: editions[0]?.date || null, editions }); return editions;
}
export async function updateNews({ date = new Date().toISOString().slice(0, 10), outputDirectory = path.resolve("public/news"), fetchers, backfillFrom, imageLimit = fetchers ? 0 : 60, allowNonCommercial = true } = {}) {
  if (!validDate(date) || (backfillFrom && (!validDate(backfillFrom) || backfillFrom > date))) throw new Error("Dates must be valid YYYY-MM-DD dates in chronological order");
  await mkdir(outputDirectory, { recursive: true });
  const editions = await rebuildIndex(outputDirectory);
  let previousCatalog = null;
  try { previousCatalog = await readJson(path.join(outputDirectory, "catalog.json")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (previousCatalog && date < previousCatalog.updatedThrough) throw new Error("A backdated run cannot replace a newer catalog; use --backfill-from with the current date instead");
  if (editions.some(edition => edition.date === date) && previousCatalog?.updatedThrough === date && previousCatalog.status === "complete" && !backfillFrom) return { unchanged: true };
  const startDate = new Date(`${date}T00:00:00Z`); startDate.setUTCDate(startDate.getUTCDate() - 13);
  const rollingStart = startDate.toISOString().slice(0, 10);
  const resumeStart = previousCatalog ? [rollingStart, previousCatalog.updatedThrough].sort()[0] : CATALOG_START;
  const start = backfillFrom || (previousCatalog?.status === "partial" ? previousCatalog.searchWindow.start : [CATALOG_START, resumeStart].sort().at(-1));
  const coverageStart = previousCatalog ? [previousCatalog.coverageStart, start].sort()[0] : start;
  const providers = fetchers || [{ name: "bioRxiv", fetch: fetchBioRxiv }, { name: "Europe PMC", fetch: fetchEuropePmc }];
  const results = await Promise.allSettled(providers.map(async provider => { const records = await provider.fetch(start, date); console.log(`${provider.name}: fetched ${records.length} records.`); return records; }));
  const sources = results.map((result, index) => ({ name: providers[index].name, status: result.status === "fulfilled" ? "ok" : "unavailable", records: result.status === "fulfilled" ? result.value.length : 0, ...(result.status === "rejected" ? { error: String(result.reason?.message || result.reason) } : {}) }));
  if (!results.length || results.every(result => result.status === "rejected")) throw new Error(`All news sources failed; existing catalog and editions retained. ${sources.map(source => `${source.name}: ${source.error}`).join("; ")}`);
  const incoming = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const previouslyKnown = new Set(previousCatalog?.papers.map(paper => paper.id) || []);
  const papers = mergePapers([...(previousCatalog?.papers || []), ...incoming], date, coverageStart).map(paper => ({ ...paper, firstSeen: paper.firstSeen || date }));
  if (imageLimit > 0 || !allowNonCommercial) await enrichFigures(papers, date, imageLimit, { allowNonCommercial });
  const status = sources.every(source => source.status === "ok") ? "complete" : "partial";
  const catalog = { version: 2, coverageStart, updatedThrough: date, generatedAt: new Date().toISOString(), timezone: "UTC", status, searchWindow: { start, end: date }, sources, selection: "All retrieved papers with computational methods and a substantive immunology focus: immune terminology in the title, receptor-specific evidence, or multiple immune concepts or sentences in the abstract. Automatic topical relevance, not scientific-quality scoring. Dates are publication or preprint posting/revision dates, not historical website editions.", papers };
  await writeJson(path.join(outputDirectory, "catalog.json"), catalog);
  let edition = null;
  if (!editions.some(item => item.date === date)) {
    // A backfill is a retrospective publication index, never invented historical daily editions.
    const newPapers = previousCatalog ? papers.filter(paper => !previouslyKnown.has(paper.id)) : papers;
    const seenIds = new Set();
    for (const item of editions) for (const paper of (await readJson(path.join(outputDirectory, `${item.date}.json`))).papers) seenIds.add(paper.id);
    edition = { version: 2, date, generatedAt: new Date().toISOString(), timezone: "UTC", status, searchWindow: { start, end: date }, sources, selection: "All newly discovered matching records in this collection; no fixed paper-count quota.", papers: newPapers.filter(paper => !seenIds.has(paper.id)) };
    await writeJson(path.join(outputDirectory, `${date}.json`), edition);
  }
  await rebuildIndex(outputDirectory);
  console.log(`Catalog: ${papers.length} relevant papers from ${coverageStart} through ${date} (${status}); ${edition ? `${edition.papers.length} in today's collection` : "existing daily collection preserved"}.`);
  return edition || { catalog, unchanged: true };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); const valueOf = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const options = { outputDirectory: valueOf("--output"), allowNonCommercial: !args.includes("--commercial-figures-only"), ...(valueOf("--image-limit") ? { imageLimit: Number(valueOf("--image-limit")) } : {}) };
  const run = args.includes("--refresh-figures") ? refreshNewsFigures(options) : updateNews({ ...options, date: valueOf("--date"), backfillFrom: valueOf("--backfill-from") });
  run.catch(error => { console.error(error.message); process.exitCode = 1; });
}
