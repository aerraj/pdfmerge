/** Signature rectangles use PDF points, independent of the preview zoom. */
export type Box = { x: number; y: number; width: number; height: number };
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
  const fittedHeight = boundedHeight(
    height,
    Math.min(pageHeight, pageWidth / ratio),
    minHeight,
  );
  const fittedWidth = fittedHeight * ratio;
  return {
    x: clamp(finite(box.x), 0, pageWidth - fittedWidth),
    y: clamp(finite(box.y), 0, pageHeight - fittedHeight),
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
  const { height, ratio, pageWidth, pageHeight } = dimensions(box, page);
  const nextHeight = boundedHeight(
    height * Math.max(0, finite(factor, 1)),
    Math.min(pageHeight, pageWidth / ratio),
    minHeight,
  );
  return constrainSignature(
    { ...box, width: nextHeight * ratio, height: nextHeight },
    page,
    minHeight,
  );
}
