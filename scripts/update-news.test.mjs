import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { classifyPaper, cleanText, extractFigure, filterByDate, fromBioRxiv, fromEuropePmc, mergePapers, normalizeDoi, selectPapers, updateNews, validDate } from "./update-news.mjs";

const fixture = (overrides = {}) => ({ id: "doi:10.1234/example", title: "Single-cell analysis of TCR clonal dynamics", abstract: "Longitudinal immune repertoire modelling", date: "2026-10-26", version: "1", ...overrides });

async function cleanup(directory) {
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== process.cwd() || !path.basename(resolved).startsWith(".news-test-")) throw new Error("Unexpected test directory");
  await rm(resolved, { recursive: true, force: true });
}

test("relevance requires both immunology and computational evidence", () => {
  assert.equal(classifyPaper(fixture({ title: "A neural network for galaxies", abstract: "Deep learning" })), null);
  assert.equal(classifyPaper(fixture({ title: "Immune responses to influenza", abstract: "An animal model" })), null);
  assert.equal(classifyPaper(fixture({ title: "Bioinformatics analysis of gastric glycolysis", abstract: "Immunohistochemical staining" })), null);
  assert.equal(classifyPaper(fixture({ title: "BCR::ABL1 computational assay", abstract: "Fusion genes in myeloid leukemia" })), null);
  assert.deepEqual(classifyPaper(fixture()).categories, ["Repertoire & clonal dynamics", "Single-cell immunology"]);
});

test("immune focus excludes incidental background and clinical indices without confusing multiomics with single-cell", () => {
  assert.equal(classifyPaper(fixture({ title: "Volatilomics in psychiatric biomarker research: from odor signatures to multiomic integration", abstract: "Schizophrenia involves immune, metabolic and neurodevelopmental pathways. Machine learning analyzes volatile organic compounds for diagnosis and longitudinal monitoring." })), null);
  assert.equal(classifyPaper(fixture({ title: "A machine learning nomogram for coronary artery lesions", abstract: "Predictors included fever duration, the systemic immune-inflammation index and intravenous immunoglobulin resistance. We used machine learning to predict risk." })), null);
  assert.ok(classifyPaper(fixture({ title: "A computational framework for disease monitoring", abstract: "We jointly model T cells and B cells using multiomics." })));
  assert.deepEqual(classifyPaper(fixture({ title: "Immune regulation through multiomics analysis", abstract: "Computational analysis of immune pathways and cytokines." })).categories, ["Systems immunology"]);
});

test("date browsing includes both endpoints and does not impose a twelve-paper quota", () => {
  const records = Array.from({ length: 25 }, (_, index) => fixture({ id: `record-${index}`, date: index < 12 ? "2026-10-01" : "2026-10-27" }));
  const papers = mergePapers(records, "2026-10-27");
  assert.equal(papers.length, 25);
  assert.equal(selectPapers(records, new Set(), "2026-10-27").length, 25);
  assert.equal(filterByDate(papers, "2026-10-01", "2026-10-27").length, 25);
  assert.equal(filterByDate(papers, "2026-10-01", "2026-10-01").length, 12);
  assert.equal(filterByDate(papers, "2026-10-27", "2026-10-01").length, 0);
  assert.equal(validDate("2026-02-30"), false);
});

test("figure thumbnails require an explicit reusable licence and exact source image path", () => {
  const paper = fixture({ pmcid: "PMC12345", authors: "Example A", venue: "Journal" });
  const xml = '<permissions><copyright-statement>2026 The Authors</copyright-statement><license><ext-link xlink:href="https://creativecommons.org/licenses/by/4.0/" /></license></permissions><fig id="fig1"><label>Figure 1</label><caption><p>T cells &amp; B cells</p></caption><graphic content-type="image"><?cloudpmc-path blobs/abcd/12345/efgh/figure1.webp?></graphic></fig>';
  const figure = extractFigure(xml, paper);
  assert.equal(figure.url, "https://cdn.ncbi.nlm.nih.gov/pmc/blobs/abcd/12345/efgh/figure1.webp");
  assert.equal(figure.caption, "T cells & B cells");
  assert.equal(figure.sourceUrl, "https://europepmc.org/articles/PMC12345#fig1");
  assert.equal(figure.license, "CC BY");
  assert.equal(extractFigure(xml.replace("/licenses/by/", "/licenses/by-nc-nd/"), paper), null);
  assert.equal(extractFigure(xml.replace("blobs/abcd", "blobs/../abcd"), paper), null);
  assert.equal(extractFigure(xml.replace('<fig id="fig1">', '<fig id="fig1"><permissions>Third-party content</permissions>'), paper), null);
  assert.equal(extractFigure("<article>No figures</article>", paper), null);
});

test("catalog metadata updates keep existing figure attribution and first discovery date", () => {
  const original = fixture({ figure: { url: "https://cdn.ncbi.nlm.nih.gov/pmc/example.webp" }, firstSeen: "2026-10-20", pmcid: "PMC12345" });
  const refreshed = fixture({ abstract: "Updated longitudinal single-cell TCR immune repertoire analysis", version: "2" });
  const [merged] = mergePapers([original, refreshed], "2026-10-27");
  assert.equal(merged.version, "2");
  assert.deepEqual(merged.figure, original.figure);
  assert.equal(merged.firstSeen, "2026-10-20");
  assert.equal(merged.pmcid, "PMC12345");
});

test("retrospective backfill creates a publication catalog without fabricating earlier collections", async () => {
  const outputDirectory = await mkdtemp(path.join(process.cwd(), ".news-test-"));
  try {
    const fetched = [fixture({ id: "october-1", date: "2026-10-01" }), fixture({ id: "october-27", date: "2026-10-27" }), fixture({ id: "september", date: "2026-09-30" })];
    await updateNews({ date: "2026-10-27", backfillFrom: "2026-10-01", outputDirectory, fetchers: [{ name: "fixture", fetch: async () => fetched }] });
    const catalog = JSON.parse(await readFile(path.join(outputDirectory, "catalog.json"), "utf8"));
    assert.equal(catalog.papers.length, 2);
    assert.equal(catalog.coverageStart, "2026-10-01");
    const index = JSON.parse(await readFile(path.join(outputDirectory, "index.json"), "utf8"));
    assert.deepEqual(index.editions.map(item => item.date), ["2026-10-27"]);
    await assert.rejects(readFile(path.join(outputDirectory, "2026-10-01.json")), /ENOENT/);
  } finally { await cleanup(outputDirectory); }
});

test("selection deduplicates DOI/version, excludes previously shown and future papers", () => {
  const papers = selectPapers([fixture(), fixture({ version: "2" }), fixture({ abstract: "A much longer but older abstract about longitudinal immune repertoire modelling and single-cell TCRs" }), fixture({ id: "old" }), fixture({ id: "future", date: "2027-01-01" })], new Set(["old"]), "2026-10-27");
  assert.equal(papers.length, 1);
  assert.equal(papers[0].version, "2");
});

test("source metadata is normalized without treating preprints as journal articles", () => {
  assert.equal(normalizeDoi("https://doi.org/10.1234/ABC"), "10.1234/abc");
  assert.equal(normalizeDoi("NA"), "");
  assert.equal(cleanText("<p>T &amp; B &#x03b1; cells</p>"), "T & B α cells");
  assert.equal(cleanText("&lt;b&gt;T cells&lt;/b&gt;"), "T cells");
  assert.equal(fromBioRxiv({ title: "Example", doi: "10.1234/ABC" }).publicationType, "Preprint");
  assert.equal(fromEuropePmc({ source: "PPR", id: "1", title: "Example" }).publicationType, "Preprint");
  assert.equal(fromEuropePmc({ source: "MED", id: "1", title: "Example" }).url, "https://europepmc.org/article/MED/1");
});

test("daily archives are immutable, history excludes repeats, total failure retains latest", async () => {
  const outputDirectory = await mkdtemp(path.join(process.cwd(), ".news-test-"));
  const fetchers = [{ name: "fixture", fetch: async () => [fixture()] }];
  try {
    await updateNews({ date: "2026-10-27", outputDirectory, fetchers });
    const before = await readFile(path.join(outputDirectory, "2026-10-27.json"), "utf8");
    await updateNews({ date: "2026-10-27", outputDirectory, fetchers: [] });
    assert.equal(await readFile(path.join(outputDirectory, "2026-10-27.json"), "utf8"), before);
    const next = await updateNews({ date: "2026-10-28", outputDirectory, fetchers });
    assert.equal(next.papers.length, 0);
    await assert.rejects(updateNews({ date: "2026-10-29", outputDirectory, fetchers: [{ name: "offline", fetch: async () => { throw new Error("Offline"); } }] }), /All news sources failed/);
    assert.equal(JSON.parse(await readFile(path.join(outputDirectory, "index.json"), "utf8")).latest, "2026-10-28");
  } finally {
    await cleanup(outputDirectory);
  }
});

test("partial outages retain status and retry the missed window without rewriting the collection", async () => {
  const outputDirectory = await mkdtemp(path.join(process.cwd(), ".news-test-"));
  try {
    const edition = await updateNews({ date: "2026-10-27", outputDirectory, fetchers: [
      { name: "working", fetch: async () => [fixture()] },
      { name: "offline", fetch: async () => { throw new Error("Offline"); } },
    ] });
    assert.equal(edition.status, "partial");
    assert.equal(edition.sources[1].status, "unavailable");
    assert.equal(edition.papers.length, 1);
    const originalEdition = await readFile(path.join(outputDirectory, "2026-10-27.json"), "utf8");
    let requestedStart;
    await updateNews({ date: "2026-10-27", outputDirectory, fetchers: [{ name: "recovered", fetch: async start => {
      requestedStart = start;
      return [fixture({ id: "recovered-october-1", date: "2026-10-01" })];
    } }] });
    assert.equal(requestedStart, "2026-10-01");
    const catalog = JSON.parse(await readFile(path.join(outputDirectory, "catalog.json"), "utf8"));
    assert.equal(catalog.status, "complete");
    assert.equal(catalog.papers.length, 2);
    assert.equal(await readFile(path.join(outputDirectory, "2026-10-27.json"), "utf8"), originalEdition);
  } finally {
    await cleanup(outputDirectory);
  }
});

test("resuming after a long scheduling gap catches the missed dates", async () => {
  const outputDirectory = await mkdtemp(path.join(process.cwd(), ".news-test-"));
  try {
    await updateNews({ date: "2026-10-27", outputDirectory, fetchers: [{ name: "fixture", fetch: async () => [fixture()] }] });
    let requestedStart;
    await updateNews({ date: "2026-11-20", outputDirectory, fetchers: [{ name: "fixture", fetch: async start => {
      requestedStart = start;
      return [fixture({ id: "during-gap", date: "2026-10-31" })];
    } }] });
    assert.equal(requestedStart, "2026-10-27");
    const catalog = JSON.parse(await readFile(path.join(outputDirectory, "catalog.json"), "utf8"));
    assert.deepEqual(catalog.papers.map(paper => paper.id).sort(), ["doi:10.1234/example", "during-gap"]);
    await assert.rejects(updateNews({ date: "2026-10-27", outputDirectory, fetchers: [] }), /backdated run cannot replace/);
    assert.equal(JSON.parse(await readFile(path.join(outputDirectory, "catalog.json"), "utf8")).updatedThrough, "2026-11-20");
  } finally { await cleanup(outputDirectory); }
});
