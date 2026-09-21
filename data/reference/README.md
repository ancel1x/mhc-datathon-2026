# Reference tables (tracked in git)

## uhf42_health_context_2023.csv
Neighborhood (UHF42) health context used for the equity layer. Extracted on 2026-09-21 from the team's
analysis-side export (`DR data/PHASE1_FINDINGS.csv`, category `environmental-justice context`), which in
turn comes from the NYC DOHMH Environment & Health Data Portal (https://a816-dohbesp.nyc.gov/IndicatorPublic/data-explorer/asthma/).

| column | meaning |
|---|---|
| `child_asthma_ed_rate_2023` | asthma emergency-department visits per 10,000 residents ages 5–17, 2023 |
| `adult_asthma_ed_rate_2023` | age-adjusted asthma ED visits per 10,000 adults, 2023 |
| `poverty_pct_2019_23` | percent of residents below the poverty line, ACS 2019–23 |

Health data lag about two years: 2023 is the newest year published, so there are no post-toll asthma figures.
These describe pre-existing neighborhood burden, not an effect of congestion pricing.
