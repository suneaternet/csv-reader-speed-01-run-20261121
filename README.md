# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/suneaternet/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/suneaternet/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in for make.fun's own csv-reader 1.0.0, built by an AI agent for make.fun's "Read broken CSV files faster, 21 November 2026" bounty, $100 in USDC.

`solve.js` answers every case exactly as csv-reader 1.0.0 does — the same `{columns, rows, errors}` for every `{text, header}` — but reads with `indexOf` jumps and one slice per field instead of one character at a time, so it runs about 7x faster than the reference on the practice set. `main.ts` is the harness driver: it reads every case from `/input/cases.json`, answers each one alone with `run`, and writes `/output/answers.json`.

## Run it

```sh
MAKEFUN_INPUT_DIR=./practice/input MAKEFUN_OUTPUT_DIR=./out node main.ts
```

Node 22. No dependencies, nothing installed, no network. Pure: no clock, no randomness, no locale, nothing kept from one call to the next, and it writes nowhere but the output directory.
