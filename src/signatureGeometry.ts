/** Signature rectangles use PDF points, independent of the preview zoom. */
export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};
export type PageSize = { width: number; height: number };
export type Corner = "nw" | "ne" | "se" | "sw";

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(value, maximum));

function dimensions(box: Box, page: PageSize) {
  const width = Math.max(Number.EPSILON, finite(box.width, 1));
  const height = Math.max(Number.EPSILON, finite(box.height, 1));
  return {
    width,
    height,
    ratio: width / height,
    pageWidth: Math.max(0, finite(page.width)),
    pageHeight: Math.max(0, finite(page.height)),
  };
}

function boundedHeight(requested: number, maximum: number, minimum: number) {
  return clamp(
    requested,
    Math.min(Math.max(0, finite(minimum)), maximum),
    maximum,
  );
}

/**
 * Keep a signature proportional and wholly inside its page. minHeight is in
 * PDF points: for a 20 CSS pixel minimum, pass 20 * pointsPerPixel.
 * Page bounds win when an unusually wide signature cannot meet that minimum.
 */
export function constrainSignature(
  box: Box,
  page: PageSize,
  minHeight: number,
): Box {
  const { height, ratio, pageWidth, pageHeight } = dimensions(box, page);
  const angle = (normalizeRotation(box.rotation ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(angle)),
    sn = Math.abs(Math.sin(angle));
  const fittedHeight = boundedHeight(
    height,
    Math.min(pageHeight / (ratio * sn + c), pageWidth / (ratio * c + sn)),
    minHeight,
  );
  const fittedWidth = fittedHeight * ratio;
  const offsetX = (fittedWidth * c + fittedHeight * sn - fittedWidth) / 2;
  const offsetY = (fittedWidth * sn + fittedHeight * c - fittedHeight) / 2;
  return {
    ...(box.rotation === undefined ? {} : { rotation: box.rotation }),
    x: clamp(finite(box.x), offsetX, pageWidth - fittedWidth - offsetX),
    y: clamp(finite(box.y), offsetY, pageHeight - fittedHeight - offsetY),
    width: fittedWidth,
    height: fittedHeight,
  };
}

/** Translate an object without allowing any part of it outside the page. */
export function moveSignature(
  box: Box,
  dx: number,
  dy: number,
  page: PageSize,
): Box {
  return constrainSignature(
    {
      ...constrainSignature(box, page, 0),
      x: finite(box.x) + finite(dx),
      y: finite(box.y) + finite(dy),
    },
    page,
    0,
  );
}

/** Resize proportionally about the opposite corner, which stays stationary. */
export function resizeSignature(
  box: Box,
  corner: Corner,
  dx: number,
  dy: number,
  page: PageSize,
  minHeight: number,
): Box {
  if (normalizeRotation(box.rotation ?? 0) !== 0)
    return resizeRotatedSignature(box, corner, dx, dy, page, minHeight);
  const current = constrainSignature(box, page, 0);
  const { ratio, pageWidth, pageHeight } = dimensions(current, page);
  const west = corner === "nw" || corner === "sw";
  const north = corner === "nw" || corner === "ne";
  const anchorX = current.x + (west ? current.width : 0);
  const anchorY = current.y + (north ? current.height : 0);
  const maximumHeight = Math.min(
    (west ? anchorX : pageWidth - anchorX) / ratio,
    north ? anchorY : pageHeight - anchorY,
  );
  // The axis with the greater proportional movement drives the resize. This
  // also lets users resize wide signatures with a purely horizontal drag.
  const horizontalHeightDelta = (finite(dx) * (west ? -1 : 1)) / ratio;
  const verticalHeightDelta = finite(dy) * (north ? -1 : 1);
  const delta =
    Math.abs(horizontalHeightDelta) >= Math.abs(verticalHeightDelta)
      ? horizontalHeightDelta
      : verticalHeightDelta;
  const height = boundedHeight(
    current.height + delta,
    maximumHeight,
    minHeight,
  );
  const width = height * ratio;
  return {
    ...(box.rotation === undefined ? {} : { rotation: box.rotation }),
    x: anchorX - (west ? width : 0),
    y: anchorY - (north ? height : 0),
    width,
    height,
  };
}

/** Scale from size controls, shifting the rectangle into page bounds if needed. */
export function scaleSignature(
  box: Box,
  factor: number,
  page: PageSize,
  minHeight: number,
): Box {
  const { height, ratio } = dimensions(box, page);
  const nextHeight = height * Math.max(Number.EPSILON, finite(factor, 1));
  return constrainSignature(
    { ...box, width: nextHeight * ratio, height: nextHeight },
    page,
    minHeight,
  );
}

/** Positive angles turn clockwise, as in the SVG preview. */
export function normalizeRotation(degrees: number) {
  return ((finite(degrees) % 360) + 360) % 360;
}

export function signatureBounds(box: Box): Box {
  const angle = (normalizeRotation(box.rotation ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle));
  const width = box.width * c + box.height * s;
  const height = box.width * s + box.height * c;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

export function rotateSignature(
  box: Box,
  degrees: number,
  page: PageSize,
  minHeight: number,
): Box {
  const rotation = normalizeRotation(degrees);
  const fitted = constrainSignature({ ...box, rotation }, page, minHeight);
  // Preserve the centre when rotation requires a smaller size, then clamp.
  return constrainSignature(
    {
      ...fitted,
      x: box.x + (box.width - fitted.width) / 2,
      y: box.y + (box.height - fitted.height) / 2,
    },
    page,
    0,
  );
}

function resizeRotatedSignature(
  box: Box,
  corner: Corner,
  dx: number,
  dy: number,
  page: PageSize,
  minHeight: number,
): Box {
  const current = constrainSignature(box, page, 0),
    ratio = current.width / current.height;
  const radians = (normalizeRotation(current.rotation ?? 0) * Math.PI) / 180,
    c = Math.cos(radians),
    s = Math.sin(radians);
  const west = corner.includes("w"),
    north = corner.includes("n");
  const signX = west ? -1 : 1,
    signY = north ? -1 : 1;
  const ax = (-signX * current.width) / 2,
    ay = (-signY * current.height) / 2;
  const anchor = {
    x: current.x + current.width / 2 + c * ax - s * ay,
    y: current.y + current.height / 2 + s * ax + c * ay,
  };
  const localX = c * dx + s * dy,
    localY = -s * dx + c * dy;
  const hx = (signX * localX) / ratio,
    hy = signY * localY;
  let maximum = Infinity;
  // Each corner is a ray from the fixed opposite corner, linear in height.
  for (const [lx, ly] of [
    [signX * ratio, 0],
    [0, signY],
    [signX * ratio, signY],
  ]) {
    const vx = c * lx - s * ly,
      vy = s * lx + c * ly;
    if (Math.abs(vx) > 1e-12)
      maximum = Math.min(
        maximum,
        (vx > 0 ? page.width - anchor.x : anchor.x) / Math.abs(vx),
      );
    if (Math.abs(vy) > 1e-12)
      maximum = Math.min(
        maximum,
        (vy > 0 ? page.height - anchor.y : anchor.y) / Math.abs(vy),
      );
  }
  const height = boundedHeight(
    current.height + (Math.abs(hx) >= Math.abs(hy) ? hx : hy),
    Math.max(0, maximum),
    minHeight,
  );
  const width = height * ratio;
  return {
    rotation: current.rotation,
    x:
      anchor.x + (c * signX * width) / 2 - (s * signY * height) / 2 - width / 2,
    y:
      anchor.y +
      (s * signX * width) / 2 +
      (c * signY * height) / 2 -
      height / 2,
    width,
    height,
  };
}
