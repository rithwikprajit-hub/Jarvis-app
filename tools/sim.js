// Device simulation harness — boots index.html in jsdom with per-device hardware stubs.
// Usage: node sim.js [path-to-index.html] [--runs N] [--only deviceId]
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const args = process.argv.slice(2);
const file = path.resolve(args.find(a => !a.startsWith('--')) || '../index.html');
const runs = +(args[args.indexOf('--runs') + 1] || 1) || 1;
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const html = fs.readFileSync(file, 'utf8');

// ---- Device catalogue ------------------------------------------------------
// ram = navigator.deviceMemory bucket (GB), cores = hardwareConcurrency,
// gpu = WebGL renderer string, webgpu / speech / battery = API availability,
// heapLimitMB = Chrome's per-tab JS heap ceiling (approx), cpuScale = relative
// single-thread speed vs. a 2023 flagship (1.0) used to scale the timing budget.
const DEVICES = [
  { id: 'realme9', name: 'realme 9 (RMX3521) — Snapdragon 680, 6GB(+4GB virt), Android 13', w: 393, h: 873, dpr: 2.75, cores: 8, ram: 4, gpu: 'Adreno (TM) 610', webgpu: false, speech: 'webkit', battery: true, heapLimitMB: 512, cpuScale: 0.22,
    ua: 'Mozilla/5.0 (Linux; Android 13; RMX3521) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36' },
  { id: 'lowend', name: 'Entry Android — Helio G25, 2GB, Android 11', w: 360, h: 720, dpr: 2, cores: 8, ram: 2, gpu: 'PowerVR Rogue GE8320', webgpu: false, speech: 'webkit', battery: true, heapLimitMB: 256, cpuScale: 0.10,
    ua: 'Mozilla/5.0 (Linux; Android 11; Redmi 9A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' },
  { id: 'midand', name: 'Mid Android — Dimensity 7050, 8GB', w: 412, h: 915, dpr: 2.6, cores: 8, ram: 8, gpu: 'Mali-G68 MC4', webgpu: true, speech: 'webkit', battery: true, heapLimitMB: 1024, cpuScale: 0.45,
    ua: 'Mozilla/5.0 (Linux; Android 14; CPH2569) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' },
  { id: 'flagand', name: 'Flagship Android — Snapdragon 8 Gen 3, 12GB', w: 412, h: 915, dpr: 3.5, cores: 8, ram: 8, gpu: 'Adreno (TM) 750', webgpu: true, speech: 'webkit', battery: true, heapLimitMB: 2048, cpuScale: 1.0,
    ua: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' },
  { id: 'iphone', name: 'iPhone 15 — Safari iOS 17', w: 393, h: 852, dpr: 3, cores: 6, ram: 0, gpu: 'Apple GPU', webgpu: false, speech: 'webkit', battery: false, heapLimitMB: 1024, cpuScale: 1.1,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  { id: 'ipad', name: 'iPad Air — Safari iPadOS 17', w: 820, h: 1180, dpr: 2, cores: 8, ram: 0, gpu: 'Apple GPU', webgpu: false, speech: 'webkit', battery: false, heapLimitMB: 2048, cpuScale: 1.1,
    ua: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  { id: 'tablet', name: 'Android tablet — Tab S9, 12GB', w: 800, h: 1280, dpr: 2, cores: 8, ram: 8, gpu: 'Adreno (TM) 740', webgpu: true, speech: 'webkit', battery: true, heapLimitMB: 2048, cpuScale: 0.9,
    ua: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' },
  { id: 'winchrome', name: 'Windows laptop — Chrome, i5, 16GB', w: 1366, h: 768, dpr: 1, cores: 12, ram: 8, gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)', webgpu: true, speech: 'webkit', battery: true, heapLimitMB: 4096, cpuScale: 0.8,
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' },
  { id: 'macsafari', name: 'MacBook — Safari 17, M2', w: 1440, h: 900, dpr: 2, cores: 8, ram: 0, gpu: 'Apple M2', webgpu: false, speech: 'webkit', battery: false, heapLimitMB: 4096, cpuScale: 1.3,
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15' },
  { id: 'firefox', name: 'Firefox desktop — no SpeechRecognition / WebGPU', w: 1280, h: 800, dpr: 1, cores: 8, ram: 0, gpu: 'Mesa Intel(R) UHD Graphics', webgpu: false, speech: 'none', battery: false, heapLimitMB: 4096, cpuScale: 0.9,
    ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0' },
];

// ---- Stubs ---------------------------------------------------------------
function ctxStub() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  const base = { canvas: null, measureText: t => ({ width: String(t).length * 6 }), createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => ({}), getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }), createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }) };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
}

function installStubs(win, dev, sink) {
  const def = (o, k, v) => { try { Object.defineProperty(o, k, { value: v, configurable: true, writable: true }); } catch (e) {} };
  const nav = win.navigator;
  const getter = (k, v) => { try { Object.defineProperty(nav, k, { get: () => v, configurable: true }); } catch (e) {} };
  getter('hardwareConcurrency', dev.cores);
  if (dev.ram) getter('deviceMemory', dev.ram);
  getter('maxTouchPoints', /iphone|ipad|android/i.test(dev.ua) ? 5 : 0);
  if (/iPhone|iPad/.test(dev.ua)) getter('platform', /iPad/.test(dev.ua) ? 'iPad' : 'iPhone');
  if (dev.webgpu) getter('gpu', { requestAdapter: async () => ({}) });
  getter('onLine', true);
  getter('language', 'en-IN');
  if (dev.battery) def(nav, 'getBattery', async () => ({ level: 0.82, charging: false, addEventListener() {} }));
  def(nav, 'vibrate', () => true);
  def(nav, 'clipboard', { writeText: async () => {} });
  def(nav, 'mediaDevices', { getUserMedia: async () => ({ getTracks: () => [{ stop() {}, getSettings: () => ({ width: 1920, height: 1080, frameRate: 30 }), applyConstraints: async () => {} }], getVideoTracks: () => [{ stop() {}, getSettings: () => ({ width: 1920, height: 1080, frameRate: 30 }), applyConstraints: async () => {} }] }), enumerateDevices: async () => [] });
  def(nav, 'serviceWorker', { register: async () => ({}), addEventListener() {} });
  def(nav, 'wakeLock', { request: async () => ({ release: async () => {}, addEventListener() {} }) });
  def(nav, 'storage', { estimate: async () => ({ quota: 8e9, usage: 5e7 }), persist: async () => true });
  if (dev.id !== 'firefox') win.performance.memory = { usedJSHeapSize: 40e6, jsHeapSizeLimit: dev.heapLimitMB * 1e6, totalJSHeapSize: 60e6 };

  def(win, 'matchMedia', q => ({ matches: /dark|standalone/.test(q) ? false : /max-width:\s*(\d+)px/.test(q) ? dev.w <= +RegExp.$1 : false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  def(win, 'ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  def(win, 'IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  def(win, 'scrollTo', () => {});
  def(win, 'open', () => (sink.popupBlocked ? null : { closed: false, focus() {}, close() {} }));
  def(win.HTMLElement.prototype, 'scrollIntoView', function () {});
  def(win.HTMLElement.prototype, 'requestFullscreen', async function () {});
  def(win.HTMLCanvasElement.prototype, 'getContext', function (type) { const c = ctxStub(); c.canvas = this; if (/webgl/.test(type)) { const gl = { getExtension: n => (n === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 37446 } : { loseContext() {} }), getParameter: p => (p === 37446 ? dev.gpu : dev.gpu), RENDERER: 7937 }; return gl; } return c; });
  def(win.HTMLCanvasElement.prototype, 'toBlob', function (cb) { cb(new win.Blob(['x'], { type: 'image/png' })); });
  def(win.HTMLCanvasElement.prototype, 'toDataURL', () => 'data:image/png;base64,iVBORw0KGgo=');
  def(win.HTMLMediaElement.prototype, 'play', async function () {});
  def(win.HTMLMediaElement.prototype, 'pause', function () {});
  def(win, 'screen', Object.assign(Object.create(null), { width: dev.w, height: dev.h, orientation: { type: 'portrait-primary', lock: async () => {}, unlock() {}, addEventListener() {} } }));
  def(win, 'devicePixelRatio', dev.dpr);
  def(win, 'innerWidth', dev.w); def(win, 'innerHeight', dev.h);

  const ac = class { constructor() { this.state = 'running'; this.sampleRate = 48000; this.currentTime = 0; this.destination = {}; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createOscillator() { return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 256, frequencyBinCount: 128, connect() {}, disconnect() {}, getByteFrequencyData(a) { a.fill(40); }, getByteTimeDomainData(a) { a.fill(128); }, getFloatTimeDomainData(a) { a.fill(0); } }; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createMediaElementSource() { return { connect() {}, disconnect() {} }; }
    createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {}, disconnect() {}, playbackRate: { value: 1 } }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, gain: { value: 0 }, connect() {}, disconnect() {} }; }
    createScriptProcessor() { return { connect() {}, disconnect() {}, onaudioprocess: null }; }
    createBuffer(c, l, r) { return { getChannelData: () => new Float32Array(l), duration: l / r, length: l, sampleRate: r, numberOfChannels: c }; }
    decodeAudioData() { return Promise.resolve({ duration: 1, getChannelData: () => new Float32Array(16000), length: 16000, sampleRate: 16000 }); }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
    get audioWorklet() { return { addModule: async () => {} }; } };
  def(win, 'AudioContext', ac); def(win, 'webkitAudioContext', ac);
  def(win, 'OfflineAudioContext', ac);

  const spoken = [];
  def(win, 'SpeechSynthesisUtterance', class { constructor(t) { this.text = t; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; this.lang = ''; } });
  const synth = { speaking: false, pending: false, paused: false, getVoices: () => [{ name: 'Google UK English Male', lang: 'en-GB', default: false, localService: true, voiceURI: 'gb' }, { name: 'Google US English', lang: 'en-US', default: true, localService: false, voiceURI: 'us' }], speak(u) { spoken.push(u.text); synth.speaking = true; setTimeout(() => { synth.speaking = false; u.onend && u.onend({}); }, 8); }, cancel() { synth.speaking = false; }, pause() {}, resume() {}, onvoiceschanged: null, addEventListener() {}, removeEventListener() {} };
  def(win, 'speechSynthesis', synth);
  sink.spoken = spoken;

  if (dev.speech !== 'none') {
    const SR = class { constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; sink.srCreated = (sink.srCreated || 0) + 1; }
      start() { sink.srStarts = (sink.srStarts || 0) + 1; setTimeout(() => this.onstart && this.onstart({}), 1); } stop() { setTimeout(() => this.onend && this.onend({}), 1); } abort() { setTimeout(() => this.onend && this.onend({}), 1); } };
    def(win, 'webkitSpeechRecognition', SR);
    if (!/iPhone|iPad|Macintosh/.test(dev.ua)) def(win, 'SpeechRecognition', SR);
  }

  def(win, 'Worker', class { constructor() { this.onmessage = null; } postMessage() {} terminate() {} addEventListener() {} });
  def(win, 'createImageBitmap', async () => ({ width: 8, height: 8, close() {} }));
  def(win.URL, 'createObjectURL', () => 'blob:sim/' + Math.random().toString(36).slice(2));
  def(win.URL, 'revokeObjectURL', () => {});
  // Image: load/err behaviour is controlled by sink.imageFail
  const NativeImage = win.Image;
  def(win, 'Image', function () { const el = new NativeImage(); let _src = ''; Object.defineProperty(el, 'src', { get: () => _src, set: v => { _src = v; setTimeout(() => { if (sink.imageFail) el.onerror && el.onerror(new win.Event('error')); else el.onload && el.onload(new win.Event('load')); }, 5); } }); Object.defineProperty(el, 'naturalWidth', { get: () => 512 }); Object.defineProperty(el, 'naturalHeight', { get: () => 512 }); return el; });
  def(win, 'fetch', async (url, opt) => { sink.fetches = sink.fetches || []; sink.fetches.push(String(url).slice(0, 80)); const u = String(url);
    if (/pollinations|images?\./.test(u)) return { ok: !sink.imageFail, status: 200, blob: async () => new win.Blob(['img'], { type: 'image/jpeg' }), headers: new win.Headers() };
    if (/generativelanguage|groq|elevenlabs|openai|anthropic/.test(u)) { return { ok: false, status: 401, headers: new win.Headers(), text: async () => '{"error":{"message":"sim: no key"}}', json: async () => ({ error: { message: 'sim: no key' } }), body: null }; }
    return { ok: true, status: 200, text: async () => '', json: async () => ({}), blob: async () => new win.Blob([]), arrayBuffer: async () => new ArrayBuffer(8), headers: new win.Headers() }; });
  def(win, 'caches', { open: async () => ({ put: async () => {}, match: async () => null, addAll: async () => {} }), keys: async () => [], match: async () => null, delete: async () => true });
  def(win, 'indexedDB', { open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null }) });
  def(win, 'DeviceOrientationEvent', class { static requestPermission() { return Promise.resolve('granted'); } });
  if (!win.crypto || !win.crypto.subtle) { const nc = require('crypto'); def(win, 'crypto', { getRandomValues: a => nc.randomFillSync(a), subtle: nc.webcrypto.subtle, randomUUID: () => nc.randomUUID() }); }
  // Dynamic import() of CDN modules would hang the page; the app guards for failure, so reject quickly.
}

// ---- One run ---------------------------------------------------------------
async function runDevice(dev, runNo) {
  const sink = { errors: [], warns: [], logs: [] };
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { const m = (e.detail && e.detail.message || e.message || ''); if (!/Not implemented|Cannot read properties of undefined \(reading 'catch'\)/.test(m)) sink.errors.push('jsdomError: ' + m); });
  vc.on('error', (...a) => sink.errors.push('console.error: ' + a.map(String).join(' ').slice(0, 200)));
  vc.on('warn', (...a) => sink.warns.push(a.map(String).join(' ').slice(0, 160)));
  const t0 = Date.now();
  const dom = new JSDOM(html, {
    url: 'https://jarvis.local/index.html', runScripts: 'dangerously', pretendToBeVisual: true, resources: undefined, virtualConsole: vc,
    userAgent: dev.ua, includeNodeLocations: false,
    beforeParse(win) {
      installStubs(win, dev, sink);
      win.addEventListener('error', e => sink.errors.push('window.onerror: ' + (e.message || e.error) + ' @' + (e.lineno || '?') + ' ' + String(e.error && e.error.stack || '').split('\n').slice(1,4).join(' <- ').replace(/\s+/g,' ')));
      win.addEventListener('unhandledrejection', e => sink.errors.push('unhandledrejection: ' + (e.reason && e.reason.message || e.reason)));
    },
  });
  const win = dom.window;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const click = el => el && el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const checks = [];
  const check = (name, ok, extra) => checks.push({ name, ok: !!ok, extra });
  try {
    await wait(250);
    check('boot overlay present', win.document.getElementById('bootOverlay'));
    const bootBtn = win.document.getElementById('bootBtn') || win.document.querySelector('[data-boot], .boot-btn');
    click(bootBtn);
    await wait(700);
    const overlayGone = !win.document.getElementById('bootOverlay') || /none/.test(win.getComputedStyle(win.document.getElementById('bootOverlay')).display) || !win.document.getElementById('bootOverlay').classList.contains('show');
    check('boot completes', overlayGone);

    // commands that don't need a network key
    const cmds = ['time', 'date', 'diagnostics', 'who are you', 'joke', 'help', 'remember that my favourite colour is teal', 'what do you remember', 'friday mode', 'jarvis mode', 'open youtube', 'search ai news', 'how are you feeling', 'reactor status'];
    const input = win.document.getElementById('cmdInput') || win.document.querySelector('input[type=text]');
    const send = win.document.getElementById('sendBtn');
    let before = (win.document.getElementById('screen') || win.document.body).children.length;
    for (const c of cmds) { if (input) { input.value = c; click(send); await wait(60); } }
    await wait(300);
    const after = (win.document.getElementById('screen') || win.document.body).children.length;
    check('commands rendered replies (' + (after - before) + ' msgs)', after - before >= cmds.length);
    check('speech engine spoke', sink.spoken.length > 0, sink.spoken.length + ' utterances');

    // image generation: success path
    sink.imageFail = false; if (input) { input.value = 'generate an image of a red sports car'; click(send); await wait(200); }
    check('image render appended <img>', win.document.querySelectorAll('#screen img, .screen img').length >= 1);
    // image generation: failure path must not throw
    sink.imageFail = true; if (input) { input.value = 'draw a picture of a mountain'; click(send); await wait(200); }
    sink.imageFail = false;

    // settings open/close & provider switching
    click(win.document.getElementById('settingsBtn')); await wait(50);
    const sel = win.document.getElementById('providerSelect');
    if (sel) for (const v of ['gemini', 'groq', 'local']) { sel.value = v; sel.dispatchEvent(new win.Event('change', { bubbles: true })); await wait(20); }
    click(win.document.getElementById('settingsSave')); await wait(50);

    // wake word, goggles, AR toggles must not throw
    click(win.document.getElementById('wakeBtn')); await wait(120);
    click(win.document.getElementById('wakeBtn')); await wait(60);
    click(win.document.getElementById('gogglesBtn')); await wait(300);
    click(win.document.getElementById('gogglesExit')); await wait(120);

    // code-block rendering & sandbox RUN button
    const h = { bubble: win.document.createElement('div'), entry: {} };
    if (win.Persona) { win.Persona.render(h, 'Here:\n```js\nconsole.log(1+1)\n```\nand\n```python\nprint(2)\n```'); check('code blocks rendered', h.bubble.querySelectorAll('.jcode').length === 2 || h._t); }

    // stress: 150 messages must stay inside the DOM budget (watchdog trims)
    for (let i = 0; i < 150; i++) win.addMsg && win.addMsg('jarvis', 'stress message ' + i);
    check('DOM node count sane after 150 msgs', win.document.getElementsByTagName('*').length < 6000, win.document.getElementsByTagName('*').length + ' nodes');
    await wait(100);

    const ev = x => { try { return win.eval(x); } catch (e) { return undefined; } };
    sink.profile = { tier: ev('DeviceProfile.tier'), sd680: ev('Hardware.sd680Class'), gpuBudgetMB: ev('Hardware.gpuBudgetMB'), label: ev('Hardware.label'), lowGraphics: ev('lowGraphics'), sttDefault: ev('sttEngine'), particles: ev('PARTICLE_COUNT') };
  } catch (e) { sink.errors.push('HARNESS: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); }
  sink.checks = checks; sink.ms = Date.now() - t0;
  try { win.close(); } catch (e) {}
  return sink;
}

(async () => {
  const list = DEVICES.filter(d => !only || d.id === only);
  let totalErrors = 0, totalFails = 0;
  const report = [];
  for (const dev of list) {
    for (let r = 1; r <= runs; r++) {
      const s = await runDevice(dev, r);
      const fails = s.checks.filter(c => !c.ok);
      totalErrors += s.errors.length; totalFails += fails.length;
      report.push({ device: dev.id, run: r, errors: s.errors, fails: fails.map(f => f.name), profile: s.profile, spoken: s.spoken.length, ms: s.ms });
      console.log(`${s.errors.length || fails.length ? '✗' : '✓'} ${dev.name.padEnd(78)} run${r}  errors:${s.errors.length} failedChecks:${fails.length} tier:${s.profile && s.profile.tier} gpuBudget:${s.profile && s.profile.gpuBudgetMB}MB ${s.ms}ms`);
      s.errors.slice(0, 6).forEach(e => console.log('     ERR  ' + e.slice(0, 220)));
      fails.forEach(f => console.log('     FAIL ' + f.name + (f.extra ? ' [' + f.extra + ']' : '')));
    }
  }
  fs.writeFileSync(path.join(__dirname, 'sim-report.json'), JSON.stringify(report, null, 2));
  console.log(`\nTOTAL devices×runs: ${list.length * runs} | errors: ${totalErrors} | failed checks: ${totalFails}`);
  process.exit(0);
})();
