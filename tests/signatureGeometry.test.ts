import { describe, expect, test } from "vitest";
import {
  constrainSignature, moveSignature, resizeSignature, scaleSignature, rotateSignature, signatureBounds,
  type Box, type Corner,
} from "../src/signatureGeometry";

const page = { width: 600, height: 800 };
const signature: Box = { x: 100, y: 200, width: 200, height: 50 };

function expectInside(box: Box) {
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.width);
  expect(box.y + box.height).toBeLessThanOrEqual(page.height);
}

describe("signature geometry in PDF points", () => {
  test("constrains numeric size and position without stretching the image", () => {
    const actual = constrainSignature({ x: 590, y: -50, width: 1600, height: 400 }, page, 20);
    expect(actual).toEqual({ x: 0, y: 0, width: 600, height: 150 });
    expect(actual.width / actual.height).toBe(4);
  });

  test("move clamps against all page edges and leaves the source untouched", () => {
    expect(moveSignature(signature, -500, -500, page)).toEqual({ ...signature, x: 0, y: 0 });
    expect(moveSignature(signature, 2000, 2000, page)).toEqual({ ...signature, x: 400, y: 750 });
    expect(signature).toEqual({ x: 100, y: 200, width: 200, height: 50 });
  });

  test("keyboard sized movement retains exact point coordinates", () => {
    expect(moveSignature(signature, 0.5, -5, page)).toEqual({ ...signature, x: 100.5, y: 195 });
  });

  test.each([
    ["nw", -40, -10, 60, 190],
    ["ne", 40, -10, 100, 190],
    ["se", 40, 10, 100, 200],
    ["sw", -40, 10, 60, 200],
  ] as const)("%s resize preserves the opposite corner and aspect ratio", (corner, dx, dy, x, y) => {
    expect(resizeSignature(signature, corner, dx, dy, page, 20)).toEqual({ x, y, width: 240, height: 60 });
  });

  test.each(["nw", "ne", "se", "sw"] as Corner[])("%s resize cannot cross a page boundary", corner => {
    const west = corner.includes("w");
    const north = corner.includes("n");
    const actual = resizeSignature(signature, corner, west ? -5000 : 5000, north ? -5000 : 5000, page, 20);
    expectInside(actual);
    expect(actual.width / actual.height).toBe(4);
    expect(actual.x + (west ? actual.width : 0)).toBe(signature.x + (west ? signature.width : 0));
    expect(actual.y + (north ? actual.height : 0)).toBe(signature.y + (north ? signature.height : 0));
  });

  test("dragging through the opposite corner stops at the minimum without flipping", () => {
    expect(resizeSignature(signature, "se", -1000, -1000, page, 20))
      .toEqual({ ...signature, width: 80, height: 20 });
  });

  test("minimum display height converts to PDF points at the current zoom", () => {
    const atHalfZoom = resizeSignature(signature, "se", -1000, -1000, page, 20 * 2);
    const atDoubleZoom = resizeSignature(signature, "se", -1000, -1000, page, 20 * 0.5);
    expect(atHalfZoom.height).toBe(40);
    expect(atDoubleZoom.height).toBe(10);
    expect(atHalfZoom.width / atHalfZoom.height).toBe(4);
    expect(atDoubleZoom.width / atDoubleZoom.height).toBe(4);
  });

  test("extreme aspect ratios respect page bounds when a minimum cannot fit", () => {
    expect(constrainSignature({ x: 500, y: 300, width: 4000, height: 20 }, page, 20))
      .toEqual({ x: 0, y: 300, width: 600, height: 3 });
  });

  test("fixed corner and page bounds take precedence when the minimum cannot fit at the anchor", () => {
    const nearEdge = { x: 590, y: 795, width: 8, height: 2 };
    expect(resizeSignature(nearEdge, "se", 100, 100, page, 20))
      .toEqual({ x: 590, y: 795, width: 10, height: 2.5 });
  });

  test("size buttons clamp both maximum and minimum while preserving proportions", () => {
    expect(scaleSignature(signature, 100, page, 20)).toEqual({ x: 0, y: 200, width: 600, height: 150 });
    expect(scaleSignature(signature, 0.01, page, 20)).toEqual({ ...signature, width: 80, height: 20 });
    expect(scaleSignature(signature, 1.25, page, 20)).toEqual({ ...signature, width: 250, height: 62.5 });
  });
});


describe("rotated signature geometry", () => {
  function inside(box: Box) {
    const b=signatureBounds(box);
    expect(b.x).toBeGreaterThanOrEqual(-1e-8);expect(b.y).toBeGreaterThanOrEqual(-1e-8);
    expect(b.x+b.width).toBeLessThanOrEqual(page.width+1e-8);expect(b.y+b.height).toBeLessThanOrEqual(page.height+1e-8);
  }
  test("rotation keeps centre and original pixels' aspect ratio",()=>{
    const b=rotateSignature(signature,90,page,20);
    expect(b.rotation).toBe(90);expect(b.x+b.width/2).toBe(200);expect(b.y+b.height/2).toBe(225);
    expect(b.width/b.height).toBe(4);
    expect(rotateSignature(signature,-15,page,20).rotation).toBe(345);
    expect(rotateSignature(signature,720,page,20).rotation).toBe(0);
  });
  test.each([15,45,90,135,180,270,345])("%s degrees stays inside after rotation, move and scale",angle=>{
    const rotated=rotateSignature({...signature,x:400,y:740},angle,page,20);
    inside(rotated);inside(moveSignature(rotated,-2000,-2000,page));inside(moveSignature(rotated,2000,2000,page));
    inside(scaleSignature(rotated,100,page,20));
    expect(scaleSignature(rotated,100,page,20).rotation).toBe(angle);
  });
  test.each(["nw","ne","se","sw"] as Corner[])("rotated %s handle keeps its opposite corner fixed",corner=>{
    const original={...signature,rotation:45};
    const anchor=(box:Box)=>{
      const dx=(corner.includes("w")?1:-1)*box.width/2,dy=(corner.includes("n")?1:-1)*box.height/2;
      const a=(box.rotation||0)*Math.PI/180;
      return [box.x+box.width/2+Math.cos(a)*dx-Math.sin(a)*dy,box.y+box.height/2+Math.sin(a)*dx+Math.cos(a)*dy];
    };
    const resized=resizeSignature(original,corner,5000,5000,page,20);
    inside(resized);expect(resized.width/resized.height).toBeCloseTo(4);
    anchor(resized).forEach((v,i)=>expect(v).toBeCloseTo(anchor(original)[i]));
  });
});
