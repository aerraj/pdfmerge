import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

/**
 * Chromium executable for Playwright. Uses Playwright's own download when it is
 * installed; otherwise falls back to GEOFRONT_CHROMIUM or a shared browser cache
 * ($PLAYWRIGHT_BROWSERS_PATH/chromium), as found in preconfigured containers.
 */
export function chromiumExecutable(): string | undefined {
  const explicit = process.env.GEOFRONT_CHROMIUM;
  if (explicit) return explicit;
  try {
    if (existsSync(chromium.executablePath())) return undefined;
  } catch {
    // executablePath() throws when the browser registry has no entry; fall through.
  }
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const shared = cache ? join(cache, 'chromium') : undefined;
  return shared && existsSync(shared) ? shared : undefined;
}

/**
 * Chromium flags that expose WebGPU and WebGL 2. Without a GPU (CI, containers)
 * both run on SwiftShader; set GEOFRONT_GPU=hardware on a machine with a real GPU
 * so the bench measures that GPU instead.
 */
export function chromiumArgs(): string[] {
  const args = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist'];
  if (process.env.GEOFRONT_GPU !== 'hardware') {
    args.push('--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader');
  }
  return args;
}
