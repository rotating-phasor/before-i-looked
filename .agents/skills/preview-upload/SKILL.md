---
name: preview-upload
description: Save a rig page as one HTML file and publish it as a public review preview on GitHub Pages, then take the lane marker off after the review. Use when a plan has a "Preview for review" or a clean-up step (ADR 0003).
---

# preview-upload

A preview is one HTML file on a public HTTPS link that we can upload over later (ADR 0003).
This lane uses GitHub Pages on its own repo, `rig-preview`, with `gh`. Never put a preview in
this repo, in an issue or in a chat attachment.

## Ask first

Publishing is an outside action. Before each upload, tell the human what goes up, where, who
can see it (anyone with the link), and how to undo it (delete the `rig-preview` repo or turn
Pages off). Wait for a yes. Ask again before the clean-up upload.

## 1. Save the page

Run rig and fetch the page with a command, not a browser's "save as". Keep the file outside the
repo or in `var/` (git-ignored).

```sh
pnpm start &                  # needs .env; LANE_MARKER set for the review copy
curl -sS -o var/preview/index.html http://localhost:8787/digest/<night>
```

Check: HTTP 200, no `<script`, and the banner shows the marker.

## 2. Publish (first time)

```sh
cd <folder outside this repo>/rig-preview
git init -b main && cp <path>/var/preview/index.html . && touch .nojekyll
git add . && git commit -m "preview"
gh repo create <owner>/rig-preview --public --source . --push
gh api -X POST repos/<owner>/rig-preview/pages -f 'source[branch]=main' -f 'source[path]=/'
```

The link is `https://<owner>.github.io/rig-preview/`. If the repo already exists, commit and
push the new `index.html` instead.

## 3. Check the link like a stranger

Pages takes about a minute to build. Before you send the link, fetch it from outside the build
until it answers 200, then check the served page, not the local file:

```sh
curl -s -o /dev/null -w "%{http_code}\n" https://<owner>.github.io/rig-preview/
curl -s https://<owner>.github.io/rig-preview/ | grep -o 'class="marker">[^<]*'
```

## 4. Clean up after the review

Only after the reviewer has looked. Save the page again with `LANE_MARKER` unset (the banner
reads "no marker set"). Then replace the branch with one fresh commit, so the marked version
leaves the history:

```sh
git checkout --orphan clean && git rm -rq --cached .
cp <path>/var/preview-clean/index.html index.html && git add index.html .nojekyll
git commit -m "preview, no lane marker"
git branch -D main && git branch -m main && git push --force origin main
```

Run step 3 again and check that the banner reads "no marker set". GitHub may still serve the
old commit by its exact id for a while; deleting `rig-preview` once the plan is accepted
removes it.
