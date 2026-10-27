# Computational immunology reading index

News is a local, static publication index maintained by a scheduled GitHub Action. It keeps the original site's Joy UI visual language and shares `ResearchCarousel` with Publications and Tools. No API key, paid model, live database, or browser-side call to academic APIs is required.

## Dates, history and article counts

The main view now indexes **publication dates from 2026-10-01 onward**. Both endpoints of a selected date range are included. Selecting the same date in From and Through gives a single day. BioRxiv dates are its posting/revision dates; journal dates come from Europe PMC's first-publication field. Dates are UTC calendar dates.

The October index was retrieved retrospectively on 2026-10-27. It is **not** a reconstruction of what the website displayed each day. The separate **Saved editions** view preserves the actual immutable files under `public/news/YYYY-MM-DD.json`, beginning on 2026-10-27. The original 12-paper first collection is retained unchanged. The compact date-mode labels and the information icon beside the result count distinguish the paper's publication/posting date from the website's collection date.

Specifically, Published → Single day → 2026-10-27 currently returns **one indexed paper**, the bioRxiv preprint [Early tuberculosis treatment remodels blood mRNA and small RNA…](https://doi.org/10.64898/2026.10.25.761687), posted on October 27. The edition saved at **2026-10-27 14:50:49 UTC** contains twelve papers chosen by the original top-12 rule from a rolling discovery/indexing window. Those twelve papers were published between **August 11 and October 23**; none was published on October 27. They are different queries, not eleven missing articles. Recently indexed papers may have earlier publication dates. This explanation describes the retrieved index, not a claim that only one relevant paper existed worldwide that day.

The first backfill, after the focus review, contains **770 matching papers**, now including **182 verified article figures** after the image-only refresh (up from 50). The default view shows the most relevant records within the latest seven days; visitors can switch to newest-first ordering or select the full month. The initial twelve cards include two actual article figures; the latest seven days contain 106 matches. Figure availability does not influence relevance ranking.

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
- [rOpenSci europepmc](https://github.com/ropensci/europepmc) provides DOI-based metadata lookup and official full-text XML retrieval; it supports the decision to use structured identifiers and JATS rather than guessing publisher image URLs.
- [manuscript-harvest](https://github.com/Lattice-Data/manuscript-harvest) separates retrieval outcomes and records source provenance. Those ideas inform the figure status fields and identity checks. Its code, browser/proxy retrieval routes and legacy services are not incorporated.

## Real article figures

Where an indexed article has a PMC identifier, the updater requests its **Europe PMC JATS XML**. Eligibility is determined from the actual XML rather than a possibly incomplete metadata flag. A figure is used only when that XML supplies an explicit Creative Commons licence and an exact supported image path. The current noncommercial academic site accepts CC BY variants, including NC and ND, plus CC0. Figure-specific permission overrides, reproduction/adaptation/third-party notices and BioRender credits are excluded conservatively. If the XML supplies an article DOI, it must match the catalog DOI. The first eligible available figure is a preview, not a claim that the author designated it as a cover or graphical abstract.

The pipeline reads both official `cloudpmc-path` and `image-cloudpmc-urn` processing instructions, recognizes explicitly named CC BY 4.0 licences where the publisher omitted the URL, and distinguishes actual `fig` elements from `fig-count`. Every selected image passes an HTTP HEAD check for a successful image response. The original NCBI CDN URL is retained; the pipeline does not guess publisher filenames, download paywalled articles, or manufacture scientific illustrations. Each figure retains its label, caption, source link, licence URL, copyright/author credit and verification time. Images use contain scaling without cropping. Clicking the preview or Details image opens a fit-to-window viewer with 1–6× zoom, scrolling, mouse dragging and an original-image link. A broken image falls back to a clearly labelled topic panel.

The 182 current images comprise **134 CC BY, 20 CC BY-NC and 28 CC BY-NC-ND** figures. They are displayed as original, unmodified images with attribution. [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.en) permits noncommercial sharing of unadapted material; technical resizing for display does not alter the scientific content. If the site gains commercial use, review its use and credits again and remove NC images from the catalog with `--refresh-figures --commercial-figures-only`. This option does not rewrite immutable historical editions, so their licensed images also require review before a commercial deployment.

Of the **588 currently unillustrated records**, **577 have no PMC identifier in the retrieved metadata**, **5 have no eligible reusable figure in the returned XML**, and **6 could not supply full text from the official service during the refresh**. The 577 include all 107 bioRxiv records. The [bioRxiv API](https://api.biorxiv.org/) can supply an official `jatsxml` URL, which is now retained when present. A direct test of that official XML endpoint returned HTTP 429; full-text requests were stopped. No alternate route was used to bypass the restriction. [bioRxiv's TDM documentation](https://www.biorxiv.org/tdm) also describes monthly requester-pays S3 content, which requires an AWS account and charges and was not enabled for this static site. Access alone does not grant reuse rights; the individual article/figure licence still governs display. Consequently the pipeline does not promise an image for every paper or substitute logos or unrelated thumbnails.

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

For an image-only recheck using the improved licence/path parser:

```sh
node scripts/update-news.mjs --refresh-figures --image-limit 300
```

The image-only command changes only `catalog.json` figure metadata and its `figuresUpdatedAt` timestamp. It does not refetch article metadata, change publication dates, rebuild the edition index, or modify saved daily files. The October 27 refresh checked all 193 records with PMC identifiers and verified 182 figures.

`--date YYYY-MM-DD` sets the collection date and `--output DIRECTORY` supports isolated tests. Do not use backdated runs to manufacture a history of website editions. An existing edition is never overwritten; a backfill refreshes the catalog while preserving those original snapshots.

The optional Pages workflow also listens for the completion of **Update research news**, because a commit made by GitHub's default token does not trigger an independent push workflow. All URLs honor Vite's `BASE_URL` for the `/personal-website/` deployment path.

## Verification

Thirteen tests cover domain focus, incidental immune mentions and clinical-marker false positives, general multiomics versus single-cell labels, false BCR gene matches, inclusive date ranges, invalid dates, no fixed 12-paper cap, DOI/version deduplication, source labels, both official image-path formats, explicit/textual licences and NC/ND policy, third-party/BioRender exclusions, exact DOI identity, metadata refresh preserving attribution, publication date versus collection date, image-only refresh preserving edition bytes, retrospective indexing without fabricated editions, immutable daily collections, source outage recovery and catch-up after a long scheduling gap. Browser verification is coordinated with the rest of the website, including date presets, combined filters, replacement pagination, complete titles, image fallback, Details, figure zoom and shared carousels at phone and desktop widths.
