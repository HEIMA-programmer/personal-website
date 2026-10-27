import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const NEWS_CATEGORIES = [
  "Repertoire & clonal dynamics",
  "Single-cell immunology",
  "Antigen & receptor prediction",
  "Immunotherapy",
  "Systems immunology",
];

const IMMUNE = /\b(?:immun(?:e|ity|olog\w*|otherap\w*|ogen\w*|oinformatic\w*|oprofil\w*)|t[ -]?cells?|b[ -]?cells?|tcrs?|bcrs?|lymphocytes?|antibod\w*|antigens?|epitopes?|neoantigens?|mhc|hla|clonotyp\w*)\b/i;
const COMPUTATIONAL = /\b(?:computational|bioinformatic\w*|algorithm\w*|machine learning|deep learning|neural network\w*|single[ -]cell|scrna[ -]?seq|sc[ -]?tcr[ -]?seq|repertoire\w*|clonotyp\w*|multi[ -]?omic\w*|spatial transcriptom\w*|statistical model\w*|mathematical model\w*|representation learning|in silico)\b/i;
const TOPICS = [
  /\b(?:repertoire\w*|clonotyp\w*|clonal|tcrs?|bcrs?|v\(d\)j)\b/i,
  /\b(?:single[ -]cell|scrna[ -]?seq|multi[ -]?omic\w*|spatial transcriptom\w*)\b/i,
  /\b(?:epitopes?|neoantigens?|antigen\w*|mhc|hla|binding|receptor prediction)\b/i,
  /\b(?:immunotherap\w*|car[ -]?t|checkpoint|cancer vaccine\w*|tumou?r microenvironment)\b/i,
];

export function cleanText(value = "") {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Math.min(Number(number), 0x10ffff)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity])
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDoi(value = "") {
  const doi = String(value).trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : "";
}

export function classifyPaper(paper) {
  const text = `${paper.title} ${paper.abstract}`;
  if (!IMMUNE.test(text) || !COMPUTATIONAL.test(text)) return null;
  const categories = NEWS_CATEGORIES.filter((_, index) => TOPICS[index]?.test(text));
  if (!categories.length) categories.push(NEWS_CATEGORIES[4]);
  // Transparent relevance to the owner's interests, never a scientific-quality score.
  const score = 2 + (IMMUNE.test(paper.title) ? 3 : 0) + (COMPUTATIONAL.test(paper.title) ? 3 : 0)
    + (TOPICS[0].test(text) ? 4 : 0) + (TOPICS[1].test(text) ? 2 : 0)
    + (/\b(?:longitudinal|temporal|trajectory|trajectories|clonal dynamics)\b/i.test(text) ? 2 : 0);
  return { ...paper, categories, relevanceScore: score };
}

export function fromBioRxiv(item) {
  const doi = normalizeDoi(item.doi);
  return {
    id: doi ? `doi:${doi}` : `biorxiv:${item.title}`,
    title: cleanText(item.title), authors: cleanText(item.authors), abstract: cleanText(item.abstract),
    date: item.date, dateLabel: "Posted / revised", doi,
    url: doi ? `https://doi.org/${doi}` : "https://www.biorxiv.org/",
    source: "bioRxiv", venue: "bioRxiv", publicationType: "Preprint",
    version: String(item.version || "1"), license: item.license || "",
    publishedDoi: normalizeDoi(item.published),
  };
}

export function fromEuropePmc(item) {
  const doi = normalizeDoi(item.doi);
  const preprint = item.source === "PPR" || item.pubTypeList?.pubType?.some((type) => /preprint/i.test(type));
  return {
    id: doi ? `doi:${doi}` : `epmc:${item.source}:${item.id}`,
    title: cleanText(item.title), authors: cleanText(item.authorString), abstract: cleanText(item.abstractText),
    date: item.firstPublicationDate, dateLabel: "Published", doi,
    url: doi ? `https://doi.org/${doi}` : `https://europepmc.org/article/${encodeURIComponent(item.source)}/${encodeURIComponent(item.id)}`,
    source: "Europe PMC", venue: cleanText(item.journalInfo?.journal?.title || (preprint ? "Preprint" : "Europe PMC")),
    publicationType: preprint ? "Preprint" : "Journal article", version: "", license: item.license || "", publishedDoi: "",
  };
}

export function selectPapers(papers, seenIds, editionDate, limit = 12) {
  const unique = new Map();
  for (const paper of papers) {
    if (!paper.title || !/^\d{4}-\d{2}-\d{2}$/.test(paper.date || "") || paper.date > editionDate || seenIds.has(paper.id)) continue;
    const selected = classifyPaper(paper);
    if (!selected) continue;
    const previous = unique.get(paper.id);
    if (!previous || Number(paper.version) > Number(previous.version)
      || (Number(paper.version) === Number(previous.version) && paper.abstract.length > previous.abstract.length)) {
      unique.set(paper.id, selected);
    }
  }
  return [...unique.values()]
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "YanbinXuResearchNews/1.0 (https://github.com/HEIMA-programmer/personal-website)", Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await pause(1500 * (attempt + 1));
    }
  }
}

async function fetchBioRxiv(start, end) {
  const papers = [];
  for (const category of ["immunology", "bioinformatics"]) {
    let cursor = 0;
    let total = Infinity;
    while (cursor < total) {
      if (cursor >= 3000) throw new Error(`bioRxiv ${category} exceeded the 3,000-record safety limit`);
      const data = await requestJson(`https://api.biorxiv.org/details/biorxiv/${start}/${end}/${cursor}?category=${category}`);
      const message = data.messages?.[0];
      // A valid empty result is different from a provider error.
      if (!Array.isArray(data.collection) || (message?.status !== "ok" && message?.status !== "no papers found")) {
        throw new Error(`bioRxiv returned an invalid response (${message?.status || "missing status"})`);
      }
      total = Number(message.total || 0);
      papers.push(...data.collection.map(fromBioRxiv));
      if (!data.collection.length) break;
      cursor += data.collection.length;
      if (cursor < total) await pause(350);
    }
  }
  return papers;
}

export async function fetchEuropePmc(start, end) {
  // FIRST_IDATE catches newly indexed articles whose publication date is older.
  const query = `(FIRST_PDATE:[${start} TO ${end}] OR FIRST_IDATE:[${start} TO ${end}]) AND (SRC:MED OR SRC:PMC) AND (TITLE_ABS:"immune repertoire" OR TITLE_ABS:clonotype OR TITLE_ABS:TCR OR TITLE_ABS:BCR OR TITLE_ABS:"computational immunology" OR ((TITLE_ABS:immune OR TITLE_ABS:immunotherapy OR TITLE_ABS:antibody OR TITLE_ABS:antigen) AND (TITLE_ABS:"single cell" OR TITLE_ABS:"machine learning" OR TITLE_ABS:"deep learning" OR TITLE_ABS:computational OR TITLE_ABS:bioinformatics))) NOT PUB_TYPE:"Retracted Publication"`;
  let cursor = "*";
  const papers = [];
  for (let page = 0; page < 30; page++) {
    const params = new URLSearchParams({ query, format: "json", resultType: "core", pageSize: "100", cursorMark: cursor, sort: "P_PDATE_D desc" });
    const data = await requestJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`);
    if (!Array.isArray(data.resultList?.result) || typeof data.hitCount !== "number") throw new Error("Europe PMC returned an invalid response");
    papers.push(...data.resultList.result.map(fromEuropePmc));
    if (!data.resultList.result.length || papers.length >= data.hitCount || !data.nextCursorMark || cursor === data.nextCursorMark) return papers;
    cursor = data.nextCursorMark;
    await pause(350);
  }
  throw new Error("Europe PMC exceeded the 3,000-record safety limit");
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

async function writeJson(filename, value) {
  const temporary = `${filename}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, filename);
}

export async function rebuildIndex(outputDirectory) {
  const names = (await readdir(outputDirectory)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().reverse();
  const editions = await Promise.all(names.map(async (name) => {
    const edition = await readJson(path.join(outputDirectory, name));
    return { date: edition.date, count: edition.papers.length, status: edition.status };
  }));
  await writeJson(path.join(outputDirectory, "index.json"), { version: 1, latest: editions[0]?.date || null, editions });
  return editions;
}

export async function updateNews({ date = new Date().toISOString().slice(0, 10), outputDirectory = path.resolve("public/news"), fetchers } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("Edition date must be a valid YYYY-MM-DD date");
  await mkdir(outputDirectory, { recursive: true });
  const editions = await rebuildIndex(outputDirectory);
  if (editions.some((edition) => edition.date === date)) {
    console.log(`News edition ${date} already exists; preserving its published selection.`);
    return { unchanged: true };
  }
  const seenIds = new Set();
  for (const edition of editions.filter((edition) => edition.date < date)) {
    for (const paper of (await readJson(path.join(outputDirectory, `${edition.date}.json`))).papers) seenIds.add(paper.id);
  }
  const startDate = new Date(`${date}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 13);
  const start = startDate.toISOString().slice(0, 10);
  const providers = fetchers || [{ name: "bioRxiv", fetch: fetchBioRxiv }, { name: "Europe PMC", fetch: fetchEuropePmc }];
  const results = await Promise.allSettled(providers.map(async (provider) => {
    const records = await provider.fetch(start, date);
    console.log(`${provider.name}: fetched ${records.length} records.`);
    return records;
  }));
  const sourceStatus = results.map((result, index) => ({
    name: providers[index].name,
    status: result.status === "fulfilled" ? "ok" : "unavailable",
    records: result.status === "fulfilled" ? result.value.length : 0,
    ...(result.status === "rejected" ? { error: String(result.reason?.message || result.reason) } : {}),
  }));
  if (results.every((result) => result.status === "rejected")) throw new Error(`All news sources failed; existing editions retained. ${sourceStatus.map((source) => `${source.name}: ${source.error}`).join("; ")}`);
  const papers = selectPapers(results.flatMap((result) => result.status === "fulfilled" ? result.value : []), seenIds, date);
  const edition = {
    version: 1, date, generatedAt: new Date().toISOString(), timezone: "UTC",
    status: sourceStatus.every((source) => source.status === "ok") ? "complete" : "partial",
    searchWindow: { start, end: date }, sources: sourceStatus,
    selection: "Up to 12 previously unfeatured papers, ranked by computational-immunology relevance. Automated discovery, not a scientific-quality assessment.",
    papers,
  };
  await writeJson(path.join(outputDirectory, `${date}.json`), edition);
  await rebuildIndex(outputDirectory);
  console.log(`Saved ${date}: ${papers.length} papers (${edition.status}). ${sourceStatus.map((source) => `${source.name}: ${source.status}, ${source.records} records`).join("; ")}`);
  return edition;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const valueOf = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  updateNews({ date: valueOf("--date"), outputDirectory: valueOf("--output") }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
