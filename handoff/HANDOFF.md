# Handoff: crayonauts.com two-step layout (match the last mockup)

Written 26 Sep 2026 by the Cowork session for Claude Code. Read this whole file
before touching anything. Jonathan (the owner) wants the live site's order flow
to look and feel like the last mockup, with every existing function still
working. Short version of how he works: prove things before saying they work,
do the work yourself, keep answers short and plain, spend what a test costs.

---

## 1. The repo and how to work in it

- Repo: `Carolinaghost/-storybook-you-site` (GitHub). `main` is served live at
  https://crayonauts.com by GitHub Pages. **Merging to `main` = live instantly.**
- The whole site is one file: `index.html` (~2100 lines: CSS, HTML, inline JS).
  `embed/sample-scatter.js` draws the floating sample pages down both sides.
- Backend is separate (`api.crayonauts.com`, repo `Carolinaghost/coloring-book-backend`).
  **Do not change the backend for this job.**
- Work on branch **`claude/two-step-layout`** (already pushed, PR #23 open).
  Open a PR, do **not** push to `main` and do **not** merge - Jonathan merges
  after looking at screenshots.
- Fail-safe already in place: git tag **`backup-live-site-20260926`** is the
  exact live site before any of this work. Revert = `git reset --hard` to that
  tag and push, or GitHub's Revert button on the merged PR.

## 2. What the finished product must look like

The reference is **`handoff/mockup-reference.html`** in this folder (open it in a
browser). It is the last version (V33) of the mockup Jonathan approved. Also see
`handoff/two-step-desktop.png` and `handoff/two-step-phone.png` - the current
state of the branch, which is close but not final (see section 5).

Page order, top to bottom:

1. **Header** - logo, tagline, gift line, price line. Unchanged.
2. **"What you get"** sample grid with the floating scatter pages around it.
   **Stays exactly where it is, at the top.** (See section 4 for why.)
3. **Step 1 - "Upload a photo"** - ONE card containing, in this order:
   - Row 1: the **Personal / The whole family** toggle and the **style
     picker** side by side (mockup: chips on the left, style + "When I grow up"
     dropdowns on the right, thin vertical divider between). On the real site
     the style picker is pills plus a career pill with a `<select>`; keeping
     pills is fine, but lay them out on the same row as the toggle where they
     fit, wrapping on phones.
   - "Who's the star of this book?" and "How many kids are in this photo?"
     side by side (personal mode only; family mode shows the people rows
     instead - that is existing behaviour, keep it).
   - The **dropzone** ("Drop a photo here, or tap to choose one").
4. **Step 2 - "Name + email"** - ONE card containing:
   - Child's name, Your email, "Who's coloring it?" detail pills, optional
     notes.
   - **See my free preview** button.
   - The two free preview pages appear right here, then the **Unlock** paywall
     ($15 / $25) and, after payment, the download button. All in this card.
5. Footer. Unchanged.

That is the whole spec: **two step cards, samples on top, everything else the
same.** No new colours, fonts or copy beyond what the merge needs.

## 3. Hard rules (these are what "keep every function working" means)

- **Every element `id` stays exactly as it is.** The inline JS finds everything
  by id. Move markup, never rename. Run this before committing:
  every `getElementById('x')` in the JS must match an `id="x"` in the HTML,
  and no id may appear twice.
- **The preview button must stay after name + email.** The backend creates the
  order (needs email) *before* it draws the free pages; the click handler
  validates `#childName` and `#parentEmail` first. The mockup put the button
  in Step 1 - that cannot be copied without a backend change, so it lives at
  the bottom of Step 2. Jonathan has been told this.
- `#uploadStep` must keep its id: `applyBookMode()` hides it in family mode.
- `#themes` pills are shown/hidden by audience (kid vs adult) in JS; their
  position in the DOM does not matter, their ids/classes do.
- `sendToNextStep()` scrolls to `document.getElementById('childName').closest('.page')`
  (already changed on the branch from `#themes`) - keep whichever card holds the
  name field as the target.
- Only two `.step-label`s remain ("Step 1", "Step 2"). `applyBookMode()` now sets
  `#styleStepLabel` to a fixed 'Step 2'; `#bookStepLabel` no longer exists.
- No `.page` may be nested inside another `.page`.

## 4. What already happened (so you do not repeat it)

- **PR #22 (merged, then reverted within minutes).** It merged the intake cards
  AND moved "What you get" below Step 1. That moved the floating side pictures
  with it (the scatter widget is `data-sample-scatter` wrapped around that
  block), so the top of the page went bare and Jonathan said "it's all messed
  up". Lesson: **the samples block and its scatter rail stay on top.** Also:
  I had only tested in a headless browser without images loaded, so I never
  saw it. Always test with real assets (section 6).
- **PR #21 (closed, not merged):** a `data-slowest="5000"` scatter timing
  tweak. Jonathan decided against it. **Leave the scatter timing alone.**
- **PR #23 (open, branch `claude/two-step-layout`):** the current two-step
  version. It is functionally verified and is close to the spec. It is what
  you are finishing, not starting over.

## 5. What is left to do on PR #23

1. **Row 1 layout in Step 1.** Right now the toggle and the style pills are in
   one flex row but the pills wrap under the toggle because five pills plus the
   career pill do not fit beside it. The mockup has them side by side. Options,
   in order of preference:
   a. Keep pills; make the toggle and the pills two columns (toggle ~35%,
      styles ~65%) so the pills wrap *within* their own column beside the
      toggle, with a thin 1px divider between the columns (`opacity:.18`),
      stacking to one column under ~640px.
   b. Turn the style pills into a `<select>` styled like the career pill. Only
      do this if you also wire it: the theme handler is
      `document.querySelectorAll('#themes .theme-pill')` click -> sets
      `selectedTheme` and `active` class. Anything you change here must keep
      the audience filtering (`data-audience`) working. Prefer (a).
2. **Dropzone copy.** The branch moved the "front-facing photos... plain
   fabric" sentence into the dropzone's small text. Fine, but check it is not
   cramped on the phone; if it is, put it back as a `step-desc` line above the
   dropzone.
3. **Look at it with real assets on desktop AND phone** (section 6) and compare
   to `mockup-reference.html`. Screenshot both and attach to the PR.
4. Update the PR description if you changed anything, then **stop and report** -
   Jonathan merges.

## 6. How to verify (do all of it, every time)

Static checks (no browser):
```
node --check on the extracted <script> blocks
no duplicate id=""; every getElementById target exists; <div> open == close
```
Behaviour, headless Chromium with **the whole site served** (so images, fonts
and `embed/sample-scatter.js` + `samples.json` load), backend calls to
`https://api.crayonauts.com/**` stubbed (`/options` -> JSON with themes,
detailLevels, styleGrid, freePreviewPages:2, priceCents:1500, family{...}).
Run at 1500px wide and as iPhone 13. Assert:
- 18 `.ss-tile` scatter tiles exist on desktop and sit around "What you get"
- `.step-label` texts == ["Step 1","Step 2"]; `.page h2` order ==
  ["What you get","Upload a photo","Name + email"]
- click Family: `#uploadStep` display none, `#familyPanel` block,
  `#childName`'s `.field` hidden; click Personal: `#uploadStep` back
- click a theme pill -> it gets `active`; click adult audience -> Superhero
  pill hidden, Garden pill shown, `#careerPill` hidden; back to kid -> career
  pill shown; `selectOption('#careerSelect','Doctor')` -> career pill active
- click `#dropzone` -> a `filechooser` event fires
- click `#previewBtn` with empty fields -> `#generateError`, `#childNameError`,
  `#emailError` all display block, no exception
- zero `pageerror`s
A working script that does exactly this is `handoff/verify2.js` (adjust the
URL/port). Then **look at the screenshots yourself**, especially the top of the
page and Step 1 on the phone.

Live end-to-end (real backend, costs a preview draw - that is fine): after
Jonathan merges, open https://crayonauts.com, upload a photo, fill name +
email, click See my free preview, confirm two pages draw and the Unlock box
appears. Then confirm the side pictures are still floating at the top.

## 7. Files in this folder

- `HANDOFF.md` - this file
- `mockup-reference.html` - the approved mockup (V33). Open in a browser.
  Note: it is a design reference only; its JS is a stand-alone demo, not the
  site's code.
- `two-step-desktop.png`, `two-step-phone.png` - current branch rendered
- `verify2.js` - Playwright verification used above

**Delete the `handoff/` folder in the final commit before the PR is merged** -
it must not be published to the live site.
