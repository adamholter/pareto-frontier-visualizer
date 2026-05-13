# Pareto Frontier Visualizer

Stop asking which AI model is best. Ask which one is worth its price.

![Screenshot of the Pareto Frontier Visualizer showing the best model tradeoffs](./docs/pareto-frontier-social.png)

This React + TypeScript app turns live Artificial Analysis website data into a
clean cost/performance map. It shows which models are currently Pareto-optimal
across two dimensions: higher Intelligence Index and lower cost to run the
Artificial Analysis Intelligence Index.

The checked-in CSV is generated from Artificial Analysis' public website data
route. Run `npm run data:fetch` to refresh it.

## What It Does

- Parses a CSV at build time.
- Filters rows with invalid dates, missing scores, or non-positive costs.
- Computes the "worth paying for" frontier for every release-date cutoff.
- Animates the frontier over time with a slider or play button.
- Shows branded points with `simple-icons` where available.
- Includes a Remotion composition for rendering a vertical social video.

## Quick Start

```sh
npm install
npm run dev
```

Open the local Vite URL that appears in your terminal.

`npm run dev` refreshes `src/data/pareto_intelligence_vs_cost.csv` from
Artificial Analysis before starting Vite.

## Build And Check

```sh
npm run data:fetch
npm run lint
npm run build
```

`npm run build` also refreshes the CSV before compiling the app.

## Render The Video

```sh
npm run video:preview
npm run video:render
```

The render command writes `out/pareto-frontier.mp4`. The `out/` directory is
ignored by git.

## Data Source

The refresh script uses Artificial Analysis' public website data route because
the documented free API is account/API-key based and does not expose every chart
field used on the site. The script selects each model's
`computed_performance_host_model_id`, then computes `cost_to_run` from the
Artificial Analysis Intelligence Index token counts and current input/output
pricing. It writes:

- `src/data/pareto_intelligence_vs_cost.csv`
- `src/data/artificial-analysis-meta.json`

Attribution: data from [Artificial Analysis](https://artificialanalysis.ai/).

## Use Your Own Data

Replace `src/data/pareto_intelligence_vs_cost.csv` with your own CSV. Required
columns are documented in `src/data/README.md`.

The frontier logic lives in `src/pareto.ts`, so adapting the app usually means:

1. Rename the score and cost labels in `src/App.tsx`.
2. Replace the CSV with data you can publish.
3. Update or remove creator icons in `src/logos.ts`.
4. Adjust the video copy in `src/remotion/ParetoVideo.tsx` if you use Remotion.

## Security And Privacy

This repo is intentionally static. It does not need API keys, OAuth tokens,
cookies, browser profiles, account identifiers, or server-side credentials.

Before publishing your own fork, scan any replacement dataset for private
vendor names, customer names, internal URLs, account IDs, and unpublished
pricing.

## Included Data

The included CSV is generated from Artificial Analysis data. If you replace it
with data from a different third-party source, keep that source's attribution and
redistribution terms with your version.
