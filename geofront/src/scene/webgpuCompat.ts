/**
 * WebGPU compatibility shims, applied once after the device exists.
 *
 * Texture-view swizzle: three.js (r186) always sends `swizzle: 'rgba'` (the current
 * spec's string form) in GPUTextureViewDescriptor. Chromium builds that shipped the
 * earlier draft of `texture-component-swizzle` type that member as a dictionary and
 * throw on every createView, so nothing renders. The identity swizzle is the default,
 * so when the browser rejects the string form we drop the member for identity views.
 */

type ViewDescriptor = GPUTextureViewDescriptor & { swizzle?: unknown };

const IDENTITY_SWIZZLE = 'rgba';
/** GPUTextureUsage.TEXTURE_BINDING (the namespace object is missing from TypeScript's DOM lib). */
const TEXTURE_BINDING = 0x04;
let swizzleShimInstalled = false;

function acceptsStringSwizzle(device: GPUDevice): boolean {
  const texture = device.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: TEXTURE_BINDING });
  try {
    texture.createView({ swizzle: IDENTITY_SWIZZLE } as ViewDescriptor);
    return true;
  } catch {
    return false;
  } finally {
    texture.destroy();
  }
}

/** Returns the list of shims installed, for diagnostics. */
export function applyWebGpuCompat(device: GPUDevice): string[] {
  const installed: string[] = [];
  if (!swizzleShimInstalled && !acceptsStringSwizzle(device)) {
    const proto = GPUTexture.prototype;
    // The original method is re-bound with .call(this) below.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const createView = proto.createView;
    proto.createView = function createViewWithoutIdentitySwizzle(this: GPUTexture, descriptor?: GPUTextureViewDescriptor) {
      const d: ViewDescriptor | undefined = descriptor;
      if (d?.swizzle === IDENTITY_SWIZZLE) {
        const { swizzle: _identity, ...rest } = d;
        return createView.call(this, rest);
      }
      return createView.call(this, descriptor);
    };
    swizzleShimInstalled = true;
    installed.push('texture-view-swizzle');
  }
  return installed;
}
