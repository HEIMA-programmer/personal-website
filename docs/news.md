# Daily computational immunology news

News uses the existing site's React and Joy UI presentation. It fetches public metadata in a scheduled GitHub Action, then serves static JSON; visitors never call academic APIs directly. No paid service or API key is required.

## Sources and research

- [bioRxiv API](https://api.biorxiv.org/): preprints in the immunology and bioinformatics subject categories, including revision dates and DOI links. These records are explicitly labelled **Preprint**.
- [Europe PMC REST API](https://dev.europepmc.org/RestfulWebService): biomedical journal metadata indexed by PubMed and PMC, including journal names, authors, abstracts and publication dates. PubMed/PMC membership is an indexing signal, not a guarantee of a paper's quality. [Search field documentation](https://europepmc.org/Help) explains publication and first-index dates.
- [arXiv API](https://info.arxiv.org/help/api/user-manual.html) was considered for quantitative biology and machine-learning methods. It is useful as a future supplement, but the initial feed prioritizes the two sources above for biomedical coverage. It is not currently polled.

Two existing projects were reviewed: [paperscraper](https://github.com/jannisborn/paperscraper) (MIT; multiple scientific sources) and [daily-arXiv-ai-enhanced](https://github.com/dw-dengwei/daily-arXiv-ai-enhanced) (daily scheduled retrieval and browsable archives). This small implementation follows the API → classification → dated archive pattern without importing either project's code, separate website, Python environment, or LLM API dependency.

## Selection and history

Each edition searches the preceding 14 UTC calendar days. Europe PMC queries both first-publication and first-index dates to catch delayed indexing. bioRxiv supplies posting/revision dates. A paper must match **both** an immune topic and a computational method. Repertoire/clonal dynamics, single-cell analysis and longitudinal research receive extra relevance weight, reflecting Yanbin's stated interests. The top 12 previously unfeatured records are selected, using publication date to break score ties. Full rules and thresholds are in `scripts/update-news.mjs`.

The categories are Repertoire & clonal dynamics, Single-cell immunology, Antigen & receptor prediction, Immunotherapy and Systems immunology. Classification is multi-label and rule based. It ranks topical relevance, **not** scientific quality. The website makes this distinction visible and does not generate claims about what a paper proves.

DOIs are normalized for deduplication; source IDs are used when no DOI is available. Versions with the same DOI are combined. Once a DOI has been featured in an earlier edition, it is not selected again. A preprint and its later journal version may have different DOIs and can appear separately; the bioRxiv card links the published DOI when supplied by the source.

`public/news/YYYY-MM-DD.json` preserves the exact published selection for a day. Rerunning that date leaves it unchanged. `public/news/index.json` lists every available edition; it is rebuilt from the archive if necessary. No older days are invented or deleted. Empty editions are valid when there are no newly matching papers.

Sources are fetched independently with timeouts, retries and pagination. A partial outage creates a visibly marked partial edition; if every source fails, the update exits unsuccessfully and keeps the previous latest edition. The UI displays the actual latest available date. It never substitutes a stale edition under today's date. A partial edition remains immutable on reruns; the next day's 14-day window can recover missed, previously unfeatured papers.

## Run and schedule

```sh
node scripts/update-news.mjs
node --test scripts/update-news.test.mjs
```

The optional `--date YYYY-MM-DD` argument chooses an edition date, and `--output DIRECTORY` is intended for isolated testing. It does not reconstruct what sources returned historically, so do not use it to manufacture a historical daily archive.

`.github/workflows/update-news.yml` runs each day at **01:23 UTC (09:23 China Standard Time)** and can also be started manually from GitHub Actions. GitHub schedules can be delayed and may be disabled after 60 days of repository inactivity. The workflow needs Actions enabled and permission to write repository contents. It commits only `public/news/` to `main`; it does not change the site's other content.

If hosting rebuilds on commits, ensure it also handles the scheduled archive update. GitHub does **not** start a separate push-triggered workflow for commits made using the default `GITHUB_TOKEN`; a GitHub Pages deployment workflow should also run on `workflow_run` completion of **Update research news**, or this workflow should call a reusable deployment job. The archive and UI work on any static host.

## Frontend integration

Import `NewsSection` from `src/components/NewsSection/NewsSection.tsx` and render it after Tools and before Experience. It reuses Joy UI soft cards, typography, chips and modal interactions. Dates, topic filters, abstracts, paper links and all prior editions are available in the section. Its JSON URLs honor Vite's `BASE_URL`, including a repository subdirectory deployment.
