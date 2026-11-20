# Habit Journal

A daily journal that finds out which of your **habits** (cleanser, moisturizer, 8h sleep…) actually move your **outcomes** (redness, energy, mood…), with stats that hold up to scrutiny.

> *"On days after I use moisturizer, my redness drops from 5.3 to 2.9."* That's the kind of sentence this app writes for you, along with how much you should trust it.

Works on **macOS** (Mac-style window, sidebar, ⌘-shortcuts) and **iPhone** (tab bar, bottom sheets, add to Home Screen), and keeps the two in sync through a private GitHub repo.

## Install on Mac and iPhone

App URL: **https://raphschweiger-dev.github.io/macos-ios-apps/**

- **Mac** (macOS Sonoma or newer): open the URL in Safari, then **File → Add to Dock**. It opens in its own window like a normal app, and you can find it in Launchpad and Spotlight.
- **iPhone:** open the URL in Safari, then **Share → Add to Home Screen**. It opens full screen with no browser bars.

## Sync between Mac and iPhone

The journal is saved as `journal.json` in a **private** GitHub repo that only you can see. No other account or server is involved.

1. Create a private repo named `habit-journal-data` at https://github.com/new.
2. Create a fine-grained token at https://github.com/settings/personal-access-tokens/new:
   - *Repository access*: **Only select repositories → habit-journal-data**
   - *Permissions → Repository permissions → Contents*: **Read and write**
   - Pick an expiration (e.g. 1 year) and copy the token (`github_pat_…`).
3. In the app, open **Data → Sync with GitHub**, enter your username, `habit-journal-data` and the token, then press **Connect & sync**. Do this once on the Mac and once on the iPhone.

The app syncs when you open it, about 3 seconds after each change, and whenever you switch back to it.

How the sync works:
- **Merging:** every habit, outcome and day carries an `updatedAt` timestamp, and for each one the newest edit wins.
- **Deletions:** deleting something leaves a tombstone, so it also disappears on the other device.
- **Simultaneous saves:** if both devices save at once, GitHub rejects the stale write and the app re-pulls, merges and retries.
- **History:** the data repo's commit history doubles as a version history of your journal.

## Develop on your Mac

```bash
git clone https://github.com/raphschweiger-dev/macos-ios-apps.git
cd macos-ios-apps/habit-journal
npm install
npm run dev        # http://localhost:5173
npm test           # stats + sync-merge unit tests
npm run build      # → dist/ (self-contained index.html + icons + manifest)
```

Pushing to `main` redeploys the app automatically.

## Daily flow

1. **Journal** (⌘1): tick the habits you did, rate each outcome 0–10, and add an optional note.
   Keyboard: `←`/`→` to change day, `T` for today, `1`–`9` to toggle habits.
2. **Insights** (⌘2): appears after 14 logged days. **Data → Load demo data** lets you try it right away.
3. **Habits & Outcomes** (⌘3): add, rename, recolor or archive items, and mark whether higher or lower is better for each outcome.
4. **Data** (⌘4): GitHub sync, JSON backup and import, plus CSV export for pandas or Excel.

## What the Insights page shows

| Visual | What it tells you |
|---|---|
| **Strongest finding** | The single most reliable link, shown as *without → with* averages and the change on a 10-point scale. |
| **Impact board** | For every outcome, one arrow per habit from the average on days *without* it (○) to days *with* it (●). Green arrows point toward "better" and red ones toward "worse". Bold rows with ★ survive multiple-testing correction. |
| **Correlation map** | A habits × outcomes heatmap of r. Faded cells aren't significant, and hatched ones don't have enough data. |
| **What the data says** | Plain-language findings, plus "trends to watch" (nominal p < 0.05 that don't survive correction). |
| **Habits you do together** | Flags habit pairs with \|φ\| ≥ 0.4. Their effects can't be separated, which is the classic confounder. |
| **Detail sheet** (click anything) | Effect by lag with 95% CIs, a with/without strip plot, and a timeline with a 7-day rolling mean and habit days shaded. |

## Methodology (`src/stats/`)

For every habit H, outcome O and lag k ∈ {0, 1, 2, 3} days (habit on day *t* → outcome on day *t+k*):

- **Point-biserial correlation** r between the binary habit and the 0–10 rating (Pearson on paired days only).
- **Mean difference** (with − without) and **Cohen's d** with pooled SD.
- **p-value** from t = r·√((n−2)/(1−r²)), using a Student-t CDF built on the regularized incomplete beta function (no stats library).
- **95% CI** via the Fisher z-transform.
- **Benjamini–Hochberg FDR** across all H × O × lag tests, so q < 0.05 is "strong" and q < 0.1 is "likely". With 4 lags × many pairs, uncorrected p-values would hand you false positives on autopilot.
- **Guards:** n < 14 paired days, or fewer than 3 days with or without the habit, gives *n/a* rather than a fake number.

The tests (`src/stats/__tests__`) check the numerics against reference values. They also check that the engine **recovers effects planted in synthetic data** (moisturizer → −2 redness at lag 1, sleep → +2 energy at lag 0) while keeping noise habits non-significant.

**Known limitations (on purpose, for now):** observational data only. There is no control for autocorrelation in the outcome series, which makes p-values somewhat optimistic when ratings are sticky day to day. There is also no multivariate model. The way to get causal answers is to *randomize*: flip a coin each morning to decide whether to do the habit, and log for 4–6 weeks.

Ideas for next steps: block bootstrap or Newey–West SEs for autocorrelation, an OLS with all habits jointly (partial effects), a coin-flip "experiment mode", and iCloud sync via a native SwiftUI wrapper.
