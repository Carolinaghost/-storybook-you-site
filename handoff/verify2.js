const { chromium, devices } = require('playwright');

async function run(label, ctxOpts, shotPath) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  // Stub only the backend; everything else (images, scatter widget, samples.json) is real.
  await page.route('https://api.crayonauts.com/**', (route) => {
    const u = route.request().url();
    if (u.endsWith('/options')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        themes: ['Portrait','Adventure scene','Superhero','Fairy tale','Grandparent Garden','Family Keepsake'],
        detailLevels: [{id:'simple'},{id:'standard'},{id:'detailed'}], styleGrid:{kid:[],adult:[]},
        freePreviewPages: 2, priceCents: 1500, family:{maxPeople:5,minPeople:2,priceCents:2500} }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const r = {};
  r.stepLabels = await page.locator('.step-label').allTextContents();
  r.h2Order = await page.locator('.page h2').allTextContents();
  r.scatterTiles = await page.locator('.ss-tile').count();
  const firstTile = page.locator('.ss-tile').first();
  const fb = r.scatterTiles ? await firstTile.boundingBox() : null; r.firstTileTop = fb ? Math.round(fb.y) : null;
  r.step1Top = Math.round((await page.locator('.page:has(#bookModePicker)').boundingBox()).y);
  r.samplesTop = Math.round((await page.locator('[data-sample-block]').boundingBox()).y);

  // Same-row check: mode picker and themes share a row on desktop
  const mp = await page.locator('#bookModePicker').boundingBox();
  const th = await page.locator('#themes').boundingBox();
  r.modeAndThemesSameRow = Math.abs(mp.y - th.y) < 8;

  // Behaviour
  await page.click('#bookModePicker button[data-mode="family"]'); await page.waitForTimeout(150);
  r.family = {
    uploadStep: await page.locator('#uploadStep').evaluate(e=>getComputedStyle(e).display),
    familyPanel: await page.locator('#familyPanel').evaluate(e=>getComputedStyle(e).display),
    nameFieldHidden: await page.locator('#childName').evaluate(e=>getComputedStyle(e.closest('.field')).display),
    label: await page.locator('#styleStepLabel').textContent(),
  };
  await page.click('#bookModePicker button[data-mode="one"]'); await page.waitForTimeout(150);
  r.personalUploadStep = await page.locator('#uploadStep').evaluate(e=>getComputedStyle(e).display);
  await page.click('#themes button[data-theme="Fairy tale"]');
  r.fairyActive = await page.locator('#themes button[data-theme="Fairy tale"]').evaluate(e=>e.classList.contains('active'));
  await page.click('#audiencePicker button[data-audience="adult"]'); await page.waitForTimeout(100);
  r.adult = {
    superhero: await page.locator('#themes button[data-theme="Superhero"]').evaluate(e=>getComputedStyle(e).display),
    garden: await page.locator('#themes button[data-theme="Grandparent Garden"]').evaluate(e=>getComputedStyle(e).display),
    career: await page.locator('#careerPill').evaluate(e=>getComputedStyle(e).display),
  };
  await page.click('#audiencePicker button[data-audience="kid"]'); await page.waitForTimeout(100);
  r.kidCareer = await page.locator('#careerPill').evaluate(e=>getComputedStyle(e).display);
  await page.selectOption('#careerSelect', 'Doctor');
  r.careerPillActive = await page.locator('#careerPill').evaluate(e=>e.classList.contains('active'));

  const [chooser] = await Promise.all([ page.waitForEvent('filechooser',{timeout:3000}).catch(()=>null), page.click('#dropzone') ]);
  r.dropzoneOpensPicker = !!chooser;

  // Preview button with empty name/email must show the validation errors, not crash
  await page.click('#previewBtn'); await page.waitForTimeout(100);
  r.validation = {
    generateError: await page.locator('#generateError').evaluate(e=>getComputedStyle(e).display),
    nameError: await page.locator('#childNameError').evaluate(e=>getComputedStyle(e).display),
    emailError: await page.locator('#emailError').evaluate(e=>getComputedStyle(e).display),
  };

  r.errors = errors.filter(e => !e.includes('favicon'));
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(label, JSON.stringify(r, null, 1));
  await browser.close();
}

(async () => {
  await run('DESKTOP', { viewport: { width: 1500, height: 900 } }, '/tmp/layout-test/desktop.png');
  await run('PHONE', { ...devices['iPhone 13'] }, '/tmp/layout-test/phone.png');
})();
