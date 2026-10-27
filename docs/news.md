# Computational immunology reading index

News is a local, static publication index maintained by a scheduled GitHub Action. It keeps the original site's Joy UI visual language and shares `ResearchCarousel` with Publications and Tools. No API key, paid model, live database, or browser-side call to academic APIs is required.

## Dates, history and article counts

The main view now indexes **publication dates from 2026-10-01 onward**. Both endpoints of a selected date range are included. Selecting the same date in From and Through gives a single day. BioRxiv dates are its posting/revision dates; journal dates come from Europe PMC's first-publication field. Dates are UTC calendar dates.

The October index was retrieved retrospectively on 2026-10-27. It is **not** a reconstruction of what the website displayed each day. The separate **Daily collections** view preserves the actual immutable files under `public/news/YYYY-MM-DD.json`, beginning on 2026-10-27. The original 12-paper first collection is retained unchanged. This distinguishes publication time from website discovery time.

The first backfill, after the focus review, contains **770 matching papers**, including **50 verified article figures**. The default view shows the most relevant records within the latest seven days; visitors can switch to newest-first ordering or select the full month. The initial twelve cards include two actual article figures; the latest seven days contain 106 matches.

The old fixed top-12 collection has been replaced by **all retrieved records passing the immunology plus computational-method filters**. Each page contains up to twelve cards, with an explicit total, previous/next buttons and page selection in the results toolbar. Changing page or filters replaces the cards and resets horizontal scrolling instead of extending an increasingly long carousel. Complete titles are shown on cards; abstracts are in Details. Date presets and topics stay visible, while source, type and sorting are under More filters. Neither sorting nor collection membership is presented as a scientific-quality judgement.

`public/news/catalog.json` stores the cumulative index, metadata, figure attribution, first-discovery date and source status. On each daily update, a rolling 14-day publication/indexing window catches new papers and delayed indexing; previously collected records stay available. After a longer scheduling gap the search resumes from the last successful update, so the missed days are included. A partial-source failure retries the affected search window on the next run, including a manual retry on the same day. All-source failure leaves the catalog and daily collections intact. DOI normalization deduplicates records and preprint versions. A preprint and later journal article may have different DOIs and remain separate, with a published-version link when supplied.

## Sources and selection

- [bioRxiv's official API](https://api.biorxiv.org/) supplies preprints in immunology and bioinformatics, posting/revision dates, authors, abstracts, versions, licences and published DOI links.
- [Europe PMC's official API](https://dev.europepmc.org/RestfulWebService) supplies journal metadata from PubMed/PMC plus open-access full-text identifiers. [Europe PMC developer resources](https://dev.europepmc.org/developers) describe the supported metadata and full-text services.
- [arXiv's official API](https://info.arxiv.org/help/api/user-manual.html) was reconsidered for quantitative biology and machine-learning methods. It is useful for a future methods-specific feed; the current implementation keeps bioRxiv plus PubMed/PMC as its focused biomedical sources. Adding more platforms would not by itself improve article relevance or quality.

The maintained rule-based classifier requires both computational-method evidence and an immunology focus: immune terminology in the title, receptor-specific evidence, or multiple immune concepts or sentences in the abstract. A single background mention of immunity is insufficient. It excludes retraction titles and avoids counting the BCR::ABL fusion gene as a B-cell receptor or a routine immune-inflammation index as a research topic. Repertoire/clonal, single-cell and longitudinal methods receive higher relevance weights. General multiomics alone does not receive a single-cell label. Multi-label categories are repertoire/clonal dynamics, single-cell immunology, antigen/receptor prediction, immunotherapy and systems immunology. Topic labels and the relevance order remain automatic and auditable in `scripts/update-news.mjs`.

Indexing in a biomedical database is not a quality guarantee; journal articles and preprints are clearly distinguished. Citation counts were not used to rank newly posted papers because they are time dependent and favor older work. The UI exposes source, venue, date, authors, DOI, original abstract and the paper link so visitors can assess a paper themselves.

## Open-source comparison

- [paperscraper](https://github.com/jannisborn/paperscraper) separates metadata retrieval across PubMed/preprint sources from filtering and post-processing. This implementation retains that separation and official-source metadata, without importing its Python environment or broad historical dumps.
- [Paperlib](https://github.com/Future-Scholars/paperlib) uses metadata enrichment, source adapters, tags and smart filtering. These informed the combined filters and distinct metadata/detail view; no Paperlib code is copied.
- [daily-arXiv-ai-enhanced](https://github.com/dw-dengwei/daily-arXiv-ai-enhanced) illustrates daily collection and browsing. The website retains real daily snapshots, but adds a cumulative date index so an arbitrary daily quota does not hide otherwise matching papers. There is no dependency on its site framework or paid LLM summaries.

## Real article figures

Where an indexed article has a PMC identifier and open-access full text, the updater requests its **Europe PMC JATS XML**. A figure is used only if the article XML supplies an explicit **CC BY, CC BY-SA or CC0** licence and an exact supported image path. Figure-specific permission overrides and third-party reproduction notices are excluded conservatively. The first eligible figure is a preview, not a claim that the author designated it as a cover or graphical abstract.

The pipeline reads the actual `cloudpmc-path` from the XML and keeps its original NCBI CDN image URL. It does not guess publisher image filenames, download paywalled articles, or manufacture scientific illustrations. Each figure retains its label, caption, source link, licence URL and copyright/author credit; the details dialog shows those fields. The page loads figures lazily with contain scaling, so scientific axes and labels are not cropped. A broken or unavailable image falls back to a clearly labelled topic panel. The website does not claim that every paper provides reusable figures; bioRxiv records without a verified reusable figure keep the fallback.

Figure retrieval is limited to 60 eligible requests per normal daily run, in batches of three. This bounds runtime and load on the full-text service without limiting the paper index. Successful figure metadata is cached in the catalog. Unchecked papers take priority; a checked article without an eligible figure is retried after a week. Temporary figure failures never block the metadata update.

The legacy [PMC OA Web Service](https://pmc.ncbi.nlm.nih.gov/tools/oa-service/) was retired in August 2026, so that outdated image-fetching route is deliberately not used.

## Running and scheduling

```sh
npm run news:update
npm test
```

The existing schedule remains **01:23 UTC daily (09:23 China Standard Time)**, with manual workflow dispatch available. GitHub schedules can be delayed or suspended on inactive repositories. The workflow needs Actions enabled and contents-write permission. It commits only `public/news/`.

For a deliberate retrospective index refresh:

```sh
node scripts/update-news.mjs --backfill-from 2026-10-01 --image-limit 150
```

`--date YYYY-MM-DD` sets the collection date and `--output DIRECTORY` supports isolated tests. Do not use backdated runs to manufacture a history of website editions. An existing edition is never overwritten; a backfill refreshes the catalog while preserving those original snapshots.

The optional Pages workflow also listens for the completion of **Update research news**, because a commit made by GitHub's default token does not trigger an independent push workflow. All URLs honor Vite's `BASE_URL` for the `/personal-website/` deployment path.

## Verification

Eleven tests cover domain focus, incidental immune mentions and clinical-marker false positives, general multiomics versus single-cell labels, false BCR gene matches, inclusive date ranges, invalid dates, no fixed 12-paper cap, DOI/version deduplication, source labels, licence/path/credit checks for figures, metadata refresh preserving figure credit, retrospective indexing without fabricated editions, immutable daily collections, source outage recovery and catch-up after a long scheduling gap. Browser checks cover date presets, combined filters, replacing pages with reset scrolling, complete titles, image fallback, details, and the shared carousel at phone and desktop widths.
