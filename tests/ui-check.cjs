const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const outDir = path.join(process.cwd(), 'shots');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  page.on('pageerror', err => errors.push('pageerror: ' + (err.stack || err.message)));

  const url = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, '01-menu.png') });

  const menuLayout = await page.evaluate(() => {
    const r = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    return {
      viewport: { w: innerWidth, h: innerHeight },
      title: r('.game-title'),
      actions: r('.menu-actions'),
      overflowX: document.documentElement.scrollWidth > innerWidth,
      overflowY: document.documentElement.scrollHeight > innerHeight
    };
  });

  await page.click('#btnRules');
  await page.waitForTimeout(650);
  await page.screenshot({ path: path.join(outDir, '02-rules.png') });
  const rulesLayout = await page.evaluate(() => {
    const r = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), scroll: e.scrollHeight }; };
    return { paper: r('.rules-paper'), scroll: r('.rules-scroll'), overflow: document.documentElement.scrollWidth > innerWidth };
  });

  await page.click('#btnTutorial');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, '03-coin.png') });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(outDir, '04-game-ai-first.png') });

  await page.waitForSelector('#diceOverlay.is-open', { timeout: 18000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, '05-fix.png') });
  const fixLayout = await page.evaluate(() => {
    const r = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    return { modal: r('.dice-modal'), row: r('#diceRow'), timer: r('#diceTimer'), diceCount: document.querySelectorAll('#diceRow .die').length };
  });

  const dice = await page.$$('#diceRow .die.is-clickable');
  if (dice.length >= 2) { await dice[0].click(); await dice[1].click(); }
  await page.click('#diceConfirm');
  await page.waitForSelector('#diceOverlay.is-open', { timeout: 6000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, '06-adjust.png') });
  const adjustLayout = await page.evaluate(() => {
    const r = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    return { row: r('#diceRow'), modal: r('.dice-modal'), arrows: document.querySelectorAll('.die-arrow').length, dice: document.querySelectorAll('#diceRow .die').length };
  });

  await page.click('#diceConfirm');
  await page.waitForSelector('#paperOverlay.is-open', { timeout: 8000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, '07-paper.png') });
  const paperLayout = await page.evaluate(() => {
    const r = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), scroll: e.scrollHeight }; };
    return { paper: r('.paper-modal'), body: r('#paperBody'), rows: document.querySelectorAll('#paperBody .paper-row').length, overflow: document.documentElement.scrollWidth > innerWidth };
  });

  console.log(JSON.stringify({ menuLayout, rulesLayout, fixLayout, adjustLayout, paperLayout, errors }, null, 2));
  await browser.close();
  if (errors.length) process.exit(1);
})().catch(err => {
  console.error('UI CHECK FAILED', err);
  process.exit(1);
});
