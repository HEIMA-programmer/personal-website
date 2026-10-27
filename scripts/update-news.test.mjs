import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { classifyPaper, cleanText, fromBioRxiv, fromEuropePmc, normalizeDoi, selectPapers, updateNews } from "./update-news.mjs";

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
  assert.deepEqual(classifyPaper(fixture()).categories, ["Repertoire & clonal dynamics", "Single-cell immunology"]);
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

test("partial outages are visible in edition status", async () => {
  const outputDirectory = await mkdtemp(path.join(process.cwd(), ".news-test-"));
  try {
    const edition = await updateNews({ date: "2026-10-27", outputDirectory, fetchers: [
      { name: "working", fetch: async () => [fixture()] },
      { name: "offline", fetch: async () => { throw new Error("Offline"); } },
    ] });
    assert.equal(edition.status, "partial");
    assert.equal(edition.sources[1].status, "unavailable");
    assert.equal(edition.papers.length, 1);
  } finally {
    await cleanup(outputDirectory);
  }
});
