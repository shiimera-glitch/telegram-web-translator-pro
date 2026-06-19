# Lessons Learned — telegram-web-translator-pro

Running log of build, CI, architecture, and tooling lessons.
Add new entries at the **top** of each section. Date format: YYYY-MM-DD.

---

## CI / GitHub Actions

### 2026-06-18 — Three sequential `build.yml` failures and their fixes

#### Context
The `Build & Release` workflow had been failing on every commit (30+ runs).
All failures were in `.github/workflows/build.yml`, diagnosed by reading the
GitHub Actions job log step-by-step.

---

#### Failure 1 — `npm ci` without a lockfile (exit code 1)

**Symptom**
```
Dependencies lock file is not found in /home/runner/work/...
Supported file patterns: package-lock.json, npm-shrinkwrap.json, yarn.lock
```

**Root cause**  
`npm ci` requires `package-lock.json` to exist and be committed.
This repo has no lockfile committed (intentional — it is a single-file
userscript with zero runtime deps).

**Fix**  
Replace `npm ci --ignore-scripts` with `npm install --ignore-scripts`.
Also remove the `cache: 'npm'` stanza from `setup-node` — it also requires
a lockfile to function and will fail silently or noisily without one.

```yaml
# WRONG
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'          # <-- requires lockfile
- name: Install dependencies
  run: npm ci --ignore-scripts  # <-- requires lockfile

# CORRECT
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'    # bump while we're here
- name: Install dependencies
  run: npm install --ignore-scripts
```

---

#### Failure 2 — `node -e "...require('./...')..."` shell quoting (exit code 2)

**Symptom**
```
line 1: syntax error near unexpected token '('
```

**Root cause**  
The GitHub web editor adds an extra layer of escaping to YAML `run:` values.
A `node -e "const v=require('./package.json').version; ..."` string contains
single-quoted paths inside a double-quoted shell string. When YAML serialises
this through the GitHub editor and bash then receives it, the `'` inside
`require('./package.json')` terminates the outer bash string early.

**Rule**  
> Never write `node -e "...require('./...')..."` in a GitHub Actions `run:`
> field via the web editor. The YAML→bash escaping path is lossy for mixed
> single/double quotes.

**Fix**  
Use `jq` — it is pre-installed on every `ubuntu-latest` runner, handles JSON
natively, and requires zero shell quoting for this use-case:

```yaml
# WRONG (quoting time-bomb)
- name: Get version
  id: ver
  run: node -e "const v=require('./package.json').version; const fs=require('fs'); fs.appendFileSync(process.env.GITHUB_OUTPUT, 'VERSION='+v+'\n');"

# CORRECT
- name: Get version
  id: ver
  run: echo "VERSION=$(jq -r .version package.json)" >> $GITHUB_OUTPUT
```

**Alternative** (if `jq` is unavailable for some reason):
```yaml
  run: |
    node -e "
      const fs = require('fs');
      const v = require('./package.json').version;
      fs.appendFileSync(process.env.GITHUB_OUTPUT, 'VERSION=' + v + '\n');
    "
```
Using a YAML block scalar (`run: |`) sidesteps the single-line quoting issue
because bash receives the script verbatim.

---

#### Failure 3 — `git add dist/` blocked by `.gitignore` (exit code 1)

**Symptom**
```
The following paths are ignored by one of your .gitignore files:
dist
hint: Use -f if you really want to add them.
```

**Root cause**  
`dist/` is listed in `.gitignore` to keep it out of local working trees.
But the CI bot needs to commit it. `git add dist/` honours `.gitignore` and
silently skips the directory, then the subsequent `git diff --cached --quiet`
detects nothing staged, skips the commit — but the `git add` itself exits 1.

**Fix**  
Force-add in CI with `git add -f dist/`. This is safe because:
- It only runs inside the isolated runner environment.
- The `.gitignore` exclusion still applies locally.
- `git diff --cached --quiet` still guards against empty commits.

```yaml
# WRONG
git add dist/

# CORRECT
git add -f dist/
```

---

#### Warning (non-blocking) — "Node.js 20 is deprecated"

```
Node.js 20 is deprecated. The following actions target Node.js 20 but are
being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4
```

This is emitted by GitHub's runner infrastructure regardless of the
`node-version:` setting. It refers to the Node version the **action runner
itself** uses internally, not the Node version your build steps run on.
No action required — it resolves automatically when GitHub updates the
action runner images.

---

#### Final working `build.yml` (as of 2026-06-18, commit 33ded6f)

```yaml
name: Build & Release

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'build.js'
      - 'package.json'
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm install --ignore-scripts

      - name: Build userscript
        run: node build.js

      - name: Get version
        id: ver
        run: echo "VERSION=$(jq -r .version package.json)" >> $GITHUB_OUTPUT

      - name: Commit dist artifact
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -f dist/
          git diff --cached --quiet || git commit -m "chore(dist): build v${{ steps.ver.outputs.VERSION }}"
          git push
```

---

## Architecture Decisions

### 2026-06-18 — Module load order (00–25)

Modules must be concatenated in numeric order by `build.js`.
New modules always append at the highest number to avoid re-ordering
existing code. Current ceiling: `25-dragdrop.js`.

Order rationale:
- `00` header metadata (userscript `@grant`, `@match`)
- `01` constants/config (referenced by everything)
- `02–05` language/bidi/segmentation/PUA primitives
- `06–10` extraction, translation, injection, observation, cache
- `11–16` UI, settings, context, recompiler, renderer, gestures
- `17–19` hotkeys, performance, compat shims
- `20–21` init bootstrap, footer/cleanup
- `22–25` engines registry, A/K adapter, a11y, drag-and-drop

---

## External LLM Consultation Log

### 2026-06-18 — Availability of free LLMs for CI/YAML questions

| Service | Outcome |
|---|---|
| chatglm.cn (GLM 5.2) | Requires WeChat QR or Chinese phone number login. Not usable without credentials. |
| huggingface.co/chat | Redirects to HF login page when clicking "Start chatting". No guest mode. |
| chat.mistral.ai (Vibe) | Terms popup accepted, question submitted, no response before self-diagnosis completed. |

**Takeaway:** For quick CI/YAML questions, the self-diagnostic loop
(read job log → identify exact failing line → apply minimal fix → re-dispatch)
was faster than waiting for an external LLM to load and respond.
Future candidates for login-free consultation: `poe.com`, `you.com`.
