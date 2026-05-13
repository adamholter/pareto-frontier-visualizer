# Data Format

The visualizer reads `pareto_intelligence_vs_cost.csv` at build time. Replace it
with your own model, product, or vendor comparison data as long as these columns
are present:

| Column | Purpose |
| --- | --- |
| `name` | Full label shown in tooltips. |
| `short_name` | Compact label shown in the frontier list. |
| `creator` | Vendor, lab, team, or owner name. |
| `creator_color` | Hex color used for points and labels. |
| `release_date` | ISO date in `YYYY-MM-DD` format. |
| `intelligence_index` | Higher-is-better score. |
| `cost_to_run` | Lower-is-better cost value. Must be positive. |

Extra columns are ignored. Rows with invalid dates, missing scores, or
non-positive costs are filtered before the frontier is computed.

The included sample CSV is synthetic demo data. For your own project, replace it
with data you are allowed to redistribute.
