import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const [chrome, pageUrl] = process.argv.slice(2);
if (!chrome || !pageUrl) throw new Error('Usage: node scripts/prove-responsive-width.mjs <chrome> <url>');

const port = 9_850 + (process.pid % 100);
const profile = `/tmp/anatomy-responsive-proof-${process.pid}`;
await rm(profile, { recursive: true, force: true });

let stderr = '';
const browser = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  `--remote-debugging-port=${port}`,
  '--remote-allow-origins=*',
  `--user-data-dir=${profile}`,
  pageUrl,
], { stdio: ['ignore', 'ignore', 'pipe'] });

browser.stderr.setEncoding('utf8');
browser.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12_000); });

async function cleanup() {
  if (browser.exitCode === null) browser.kill('SIGTERM');
  await delay(300);
  if (browser.exitCode === null) browser.kill('SIGKILL');
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

try {
  let target;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && !target) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        target = targets.find((candidate) => candidate.type === 'page' && candidate.url.includes('/hardware-wallet/'));
      }
    } catch {}
    if (!target) await delay(100);
  }
  if (!target?.webSocketDebuggerUrl) throw new Error(`No Chrome target\n${stderr}`);

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP socket timeout')), 10_000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', async (event) => {
    const raw = typeof event.data === 'string' ? event.data : await event.data.text?.();
    if (!raw) return;
    const message = JSON.parse(raw);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result ?? {});
  });

  const command = (method, params = {}, timeoutMs = 15_000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out: ${method}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'Runtime.evaluate failed');
    return result.result?.value;
  };

  await command('Runtime.enable');
  await command('Page.enable');

  const widths = [390, 430, 768, 820, 1024, 1180, 1200, 1280, 1344, 1366, 1440];
  for (const width of widths) {
    await command('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await delay(250);

    const metrics = await evaluate(`(() => {
      const viewport = window.innerWidth;
      const scrolling = document.scrollingElement ?? document.documentElement;
      const watched = [...document.querySelectorAll('.article, .prose, .prose > *, .device-lab, .wallet-transfer, .wallet-security, .loop-figure')];
      const offenders = watched.map((node) => {
        const r = node.getBoundingClientRect();
        return { tag: node.tagName, cls: node.className || '', left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
      }).filter((r) => r.left < -1 || r.right > viewport + 1).slice(0, 12);
      window.scrollTo(10_000, window.scrollY);
      return {
        viewport,
        scrollWidth: scrolling.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        scrollX: window.scrollX,
        offenders,
      };
    })()`);

    await evaluate('window.scrollTo(0, window.scrollY)');
    const overflow = Math.max(metrics.scrollWidth, metrics.bodyScrollWidth) - metrics.viewport;
    if (metrics.scrollX > 0 || overflow > 1 || metrics.offenders.length > 0) {
      throw new Error(`Horizontal overflow at ${width}px: ${JSON.stringify({ ...metrics, overflow })}`);
    }
    console.log(`${width}px: no horizontal overflow`);
  }

  await command('Emulation.clearDeviceMetricsOverride');
  socket.close();
} finally {
  await cleanup();
}
