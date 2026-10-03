/**
 * Runs a browser test command with a display. Headless Chromium cannot present WebGPU
 * to a canvas on SwiftShader (the device is lost on the first frame), so on Linux
 * without a display the command runs inside Xvfb with a headed browser
 * (DECISIONS D-017). Elsewhere it runs as is.
 *
 *   tsx scripts/with-display.ts playwright test -c playwright.config.ts
 *
 * GEOFRONT_HEADED=1 forces a headed browser; GEOFRONT_HEADLESS=1 forces headless.
 */
import { spawn, spawnSync } from 'node:child_process';

const XVFB_SCREEN = '-screen 0 1920x1080x24';

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error('usage: tsx scripts/with-display.ts <command> [args...]');
  process.exit(2);
}

const env = { ...process.env };
const wantsXvfb =
  process.platform === 'linux' && !env.DISPLAY && env.GEOFRONT_HEADLESS !== '1' && spawnSync('which', ['xvfb-run']).status === 0;

let [bin, ...args] = command as [string, ...string[]];
if (wantsXvfb) {
  args = ['-a', '-s', XVFB_SCREEN, bin, ...args];
  bin = 'xvfb-run';
  env.GEOFRONT_HEADED = '1';
} else if (env.GEOFRONT_HEADLESS === '1') {
  env.GEOFRONT_HEADED = '0';
}

const child = spawn(bin, args, { stdio: 'inherit', env });
child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
