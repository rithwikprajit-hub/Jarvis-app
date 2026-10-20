const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || '/home/claude/v12';
const srv = http.createServer((q, r) => { let p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : p.endsWith('.json') ? 'application/json' : p.endsWith('.js') ? 'text/javascript' : 'image/png' }); r.end(d); } }); }).listen(8123);
const UA = 'Mozilla/5.0 (Linux; Android 13; RMX3521) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const results = {};
  async function session(name, ctxOpts, throttle) {
    const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
    const cdp = await ctx.newCDPSession(page); if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' }); await page.waitForTimeout(600);
    return { ctx, page, errs, cdp };
  }
  const phone = { viewport: { width: 393, height: 873 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, permissions: ['microphone', 'camera'] };

  // ---- 1. Realme 9 screenshots
  let { ctx, page, errs } = await session('phone', phone, 1);
  await page.screenshot({ path: 'shots/01-boot.png' });
  await page.click('#bootBtn',{force:true}); await page.waitForTimeout(900);
  await page.evaluate(() => { const h = addMsg('jarvis', 'Good evening. All systems are running on this device. How can I help?'); addMsg('user', 'write a hello world in python'); const c = addMsg('jarvis', ''); updateMsg(c, 'Of course.\n```python\nprint("hello, world")\n```\nRun it with python.'); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/02-talk.png' });
  await page.click('#dock [data-go="control"]'); await page.waitForTimeout(300); await page.screenshot({ path: 'shots/03-control.png' });
  await page.click('#dock [data-go="system"]'); await page.waitForTimeout(1800); await page.screenshot({ path: 'shots/04-system.png' });
  await page.click('#settingsBtn'); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/05-settings.png' });
  await page.click('#settingsCancel'); await page.click('#dock [data-go="talk"]'); await page.waitForTimeout(200);
  await page.focus('#cmdInput'); await page.waitForTimeout(400); await page.screenshot({ path: 'shots/06-typing.png' });
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  results.phoneOverflow = overflow; results.phoneErrors = errs.slice(); await ctx.close();

  // ---- 2. Desktop layout
  ({ ctx, page, errs } = await session('desktop', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, 1));
  await page.click('#bootBtn',{force:true}); await page.waitForTimeout(800);
  await page.evaluate(() => { addMsg('jarvis', 'Good evening. Ready when you are.'); addMsg('user', 'system status'); });
  await page.waitForTimeout(1800); await page.screenshot({ path: 'shots/07-desktop.png' });
  results.desktopErrors = errs.slice(); await ctx.close();

  // ---- 3. Frame rate under CPU throttling (Snapdragon 680 is roughly 4-6x slower than a desktop core)
  results.fps = {};
  for (const rate of [1, 4, 6]) {
    ({ ctx, page, errs } = await session('fps' + rate, phone, rate));
    await page.click('#bootBtn',{force:true}); await page.waitForTimeout(800);
    await page.evaluate(() => { for (let i = 0; i < 6; i++) addMsg(i % 2 ? 'user' : 'jarvis', 'message ' + i + ' lorem ipsum dolor sit amet'); });
    await page.waitForTimeout(3500);
    const f1 = await page.evaluate(() => ({ fps: UIStats.fps, min: UIStats.minFps }));
    // while "speaking": drive the orb at its busiest
    await page.evaluate(() => { Speech.speaking = true; }); await page.waitForTimeout(3000);
    const f2 = await page.evaluate(() => ({ fps: UIStats.fps, min: UIStats.minFps }));
    await page.evaluate(() => { Speech.speaking = false; });
    results.fps['x' + rate] = { idle: f1, speaking: f2, errors: errs.length }; await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(JSON.stringify(results, null, 1));
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
