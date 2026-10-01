// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import PdfEditor from "../src/PdfEditor";

const mockInvoke = vi.hoisted(() => vi.fn());
const mockOpen = vi.hoisted(() => vi.fn());
const mockSave = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen, save: mockSave }));

const pictureData = "data:image/png;base64,ORIGINAL_SIGNATURE_DATA";
const pageSize = { width: 612, height: 792 };
let pointerId = 0;
let displayWidth = pageSize.width;

beforeEach(() => {
  vi.clearAllMocks();
  pointerId = 0;
  displayWidth = pageSize.width;
  mockOpen.mockResolvedValue("/tmp/signature.png");
  mockSave.mockResolvedValue("/tmp/signed.pdf");
  mockInvoke.mockImplementation((_command: string, { request }: { request: { tool: string; page?: number } }) => {
    if (request.tool === "preview") return Promise.resolve({
      count: 2, page: request.page ?? 0, ...pageSize,
      image: "data:image/png;base64,AA==", objects: [],
    });
    if (request.tool === "signature_image") return Promise.resolve({ data: pictureData, width: 500, height: 180 });
    if (request.tool === "edit") return Promise.resolve({ message: "Saved PDF." });
    throw new Error(`Unexpected tool ${request.tool}`);
  });
  Object.defineProperty(SVGElement.prototype, "setPointerCapture", { value: () => {}, configurable: true });
  Object.defineProperty(HTMLCanvasElement.prototype, "setPointerCapture", { value: () => {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
    clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    drawImage: vi.fn(), fillText: vi.fn(), measureText: () => ({ width: 300 }),
    getImageData: (_x: number, _y: number, width: number, height: number) => {
      const data = new Uint8ClampedArray(width * height * 4);
      // A deterministic ink extent lets the editor exercise crop/asset handling
      // without depending on a native canvas implementation inside jsdom.
      data[(20 * width + 10) * 4 + 3] = 255;
      data[(70 * width + 210) * 4 + 3] = 255;
      return { data };
    },
  }) as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,CANVAS_SIGNATURE");
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 220, width: 600, height: 220, toJSON: () => ({}),
  });
  vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    x: 0, y: 0, left: 0, top: 0, right: displayWidth, bottom: 792 * displayWidth / 612,
    width: displayWidth, height: 792 * displayWidth / 612, toJSON: () => ({}),
  }));
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mountEditor() {
  const onDirtyChange = vi.fn();
  const rendered = render(<PdfEditor path="/tmp/sample.pdf" initialMode="signature" onDirtyChange={onDirtyChange} onBusyChange={() => {}} />);
  return { ...rendered, onDirtyChange };
}

async function preparePicture() {
  await screen.findByText("Page 1 of 2");
  await waitFor(() => expect(screen.getByRole("button", { name: "Add signature" }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Picture" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose signature picture" }));
  await screen.findByRole("img", { name: "Prepared signature" });
  fireEvent.click(screen.getByRole("button", { name: "Place signature" }));
}

function pdfPage(container: HTMLElement) {
  return container.querySelector(".page-stage > svg") as SVGSVGElement;
}

function getSignature(index = 1, page = 1) {
  return screen.getByRole("button", { name: `Signature ${index} on page ${page}` }) as unknown as SVGGElement;
}

function box(element: SVGGElement) {
  const rect = element.querySelector(".signature-hit")!;
  return Object.fromEntries(["x", "y", "width", "height"].map(key => [key, Number(rect.getAttribute(key))])) as { x: number; y: number; width: number; height: number };
}

async function place(page: SVGSVGElement, x = 300, y = 300, index = 1, pageNumber = 1) {
  const id = ++pointerId;
  fireEvent.pointerDown(page, { pointerId: id, clientX: x, clientY: y, button: 0 });
  fireEvent.pointerUp(page, { pointerId: id, clientX: x, clientY: y, button: 0 });
  await waitFor(() => expect(document.activeElement).toBe(getSignature(index, pageNumber)));
  return getSignature(index, pageNumber);
}

function drag(target: Element, page: SVGSVGElement, from: [number, number], to: [number, number], pointerType = "mouse") {
  const id = ++pointerId;
  fireEvent.pointerDown(target, { pointerId: id, clientX: from[0], clientY: from[1], button: 0, pointerType });
  fireEvent.pointerMove(page, { pointerId: id, clientX: to[0], clientY: to[1], button: 0, pointerType });
  fireEvent.pointerUp(page, { pointerId: id, clientX: to[0], clientY: to[1], button: 0, pointerType });
}

function key(key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}) {
  fireEvent.keyDown(document.activeElement ?? window, { key, ...modifiers });
}

function lastExport() {
  const calls = mockInvoke.mock.calls.filter(([, args]) => args.request.tool === "edit");
  return calls[calls.length - 1]?.[1].request;
}

test("a picture is placed once, selected, and can be deselected or selected without adding copies", async () => {
  const { container } = mountEditor();
  await preparePicture();
  const page = pdfPage(container);
  const signature = await place(page);
  expect(screen.getByText("1 edits")).toBeTruthy();
  expect(signature.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("toolbar", { name: "Signature actions" })).toBeTruthy();
  const handles = within(signature).getAllByRole("button", { name: /Resize signature/ });
  expect(handles).toHaveLength(4);
  for (const handle of handles) {
    const target = handle.querySelector(".resize-target")!;
    expect(Number(target.getAttribute("width"))).toBe(44);
    expect(Number(target.getAttribute("height"))).toBe(44);
  }
  fireEvent.pointerDown(page, { pointerId: ++pointerId, clientX: 500, clientY: 500, button: 0 });
  expect(screen.getByText("1 edits")).toBeTruthy();
  expect(signature.getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByRole("toolbar", { name: "Signature actions" })).toBeNull();
  drag(signature, page, [300, 300], [300, 300]);
  await waitFor(() => expect(document.activeElement).toBe(signature));
  expect(signature.getAttribute("aria-pressed")).toBe("true");
  key("Escape");
  expect(signature.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByText("1 edits")).toBeTruthy();
  key("z", { ctrlKey: true });
  expect(screen.getByText("0 edits")).toBeTruthy();
  key("y", { ctrlKey: true });
  expect(screen.getByText("1 edits")).toBeTruthy();
});

test("touch dragging moves within page bounds and proportionally resizes with a 20px minimum", async () => {
  const { container } = mountEditor();
  await preparePicture();
  const page = pdfPage(container);
  const signature = await place(page);
  const original = box(signature);
  drag(signature, page, [300, 300], [5000, 5000], "touch");
  expect(box(signature).x + box(signature).width).toBeCloseTo(612);
  expect(box(signature).y + box(signature).height).toBeCloseTo(792);
  drag(signature, page, [500, 700], [-5000, -5000], "touch");
  expect(box(signature)).toEqual({ ...original, x: 0, y: 0 });
  drag(screen.getByRole("button", { name: "Resize signature se" }), page, [180, 64.8], [220, 64.8], "touch");
  expect(box(signature).width).toBeCloseTo(220);
  expect(box(signature).width / box(signature).height).toBeCloseTo(500 / 180);
  key("z", { ctrlKey: true });
  expect(box(signature)).toEqual({ ...original, x: 0, y: 0 });
  key("y", { ctrlKey: true });
  expect(box(signature).width).toBeCloseTo(220);
  drag(screen.getByRole("button", { name: "Resize signature se" }), page, [220, 79.2], [-1000, -1000], "touch");
  expect(box(signature).height).toBe(20);
  fireEvent.change(screen.getByLabelText("Width (pt)"), { target: { value: "9000" } });
  expect(box(signature).width).toBeCloseTo(612);
  expect(box(signature).width / box(signature).height).toBeCloseTo(500 / 180);
});

test("focusable signatures support arrow keys, Shift nudges, deletion and both undo/redo shortcuts", async () => {
  const { container } = mountEditor();
  await preparePicture();
  const signature = await place(pdfPage(container));
  const original = box(signature);
  expect(signature.getAttribute("tabindex")).toBe("0");
  key("ArrowRight");
  key("ArrowDown", { shiftKey: true });
  expect(box(signature)).toEqual({ ...original, x: original.x + 1, y: original.y + 10 });
  key("z", { ctrlKey: true });
  expect(box(signature)).toEqual({ ...original, x: original.x + 1 });
  key("y", { ctrlKey: true });
  expect(box(signature).y).toBe(original.y + 10);
  key("Delete");
  expect(screen.queryByRole("button", { name: "Signature 1 on page 1" })).toBeNull();
  key("z", { metaKey: true });
  expect(box(getSignature()).y).toBe(original.y + 10);
  key("z", { metaKey: true, shiftKey: true });
  expect(screen.queryByRole("button", { name: "Signature 1 on page 1" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  act(() => getSignature().focus());
  key("Backspace");
  expect(screen.getByText("0 edits")).toBeTruthy();
});

test("one undo restores an entire drag and a cancelled gesture leaves its original position", async () => {
  const { container } = mountEditor();
  await preparePicture();
  const page = pdfPage(container);
  const signature = await place(page);
  const original = box(signature);
  const id = ++pointerId;
  fireEvent.pointerDown(signature, { pointerId: id, clientX: 300, clientY: 300, button: 0 });
  fireEvent.pointerMove(page, { pointerId: id, clientX: 320, clientY: 320 });
  fireEvent.pointerMove(page, { pointerId: id, clientX: 350, clientY: 360 });
  fireEvent.pointerUp(page, { pointerId: id, clientX: 350, clientY: 360 });
  expect(box(signature)).toEqual({ ...original, x: original.x + 50, y: original.y + 60 });
  key("z", { ctrlKey: true });
  expect(box(signature)).toEqual(original);
  key("y", { ctrlKey: true });
  expect(box(signature).x).toBe(original.x + 50);
  const moved = box(signature);
  const cancelledId = ++pointerId;
  fireEvent.pointerDown(signature, { pointerId: cancelledId, clientX: 350, clientY: 360, button: 0 });
  fireEvent.pointerMove(page, { pointerId: cancelledId, clientX: 400, clientY: 400 });
  fireEvent.pointerCancel(page, { pointerId: cancelledId });
  expect(box(signature)).toEqual(moved);
});

test("undo during a drag cancels the gesture before undoing signature placement", async () => {
  const { container } = mountEditor();
  await preparePicture();
  const page = pdfPage(container);
  const signature = await place(page);
  const original = box(signature);
  const id = ++pointerId;
  fireEvent.pointerDown(signature, { pointerId: id, clientX: 300, clientY: 300, button: 0 });
  fireEvent.pointerMove(page, { pointerId: id, clientX: 370, clientY: 350 });
  expect(box(signature)).toEqual({ ...original, x: original.x + 70, y: original.y + 50 });

  key("z", { ctrlKey: true });
  expect(box(getSignature())).toEqual(original);
  expect(screen.getByText("1 edits")).toBeTruthy();
  // Releasing the cancelled pointer must not recommit its moved coordinates.
  fireEvent.pointerUp(page, { pointerId: id, clientX: 370, clientY: 350 });
  expect(box(getSignature())).toEqual(original);
  key("z", { ctrlKey: true });
  expect(screen.getByText("0 edits")).toBeTruthy();
  key("y", { ctrlKey: true });
  expect(box(getSignature())).toEqual(original);
});

test("duplicate and reused signatures remain independent across pages, and export uses only current objects", async () => {
  const { container, onDirtyChange } = mountEditor();
  await preparePicture();
  const page = pdfPage(container);
  const first = await place(page);
  const firstBox = box(first);
  fireEvent.click(screen.getByRole("button", { name: "Duplicate signature" }));
  const second = getSignature(2);
  await waitFor(() => expect(document.activeElement).toBe(second));
  expect(box(first)).toEqual(firstBox);
  key("ArrowRight", { shiftKey: true });
  expect(box(second).x).toBe(firstBox.x + 26);
  act(() => first.focus());
  expect(first.getAttribute("aria-pressed")).toBe("true");
  expect(second.getAttribute("aria-pressed")).toBe("false");
  act(() => second.focus());
  fireEvent.click(within(screen.getByRole("toolbar", { name: "Signature actions" })).getByRole("button", { name: "Delete signature" }));
  expect(box(first)).toEqual(firstBox);
  expect(screen.getByText("1 edits")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByText("Page 2 of 2");
  await waitFor(() => expect(screen.getByRole("button", { name: "Reuse signature" }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Reuse signature" }));
  const third = await place(page, 150, 400, 2, 2);
  drag(third, page, [150, 400], [170, 430]);
  const thirdBox = box(third);
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockInvoke.mock.calls.filter(([, args]) => args.request.tool === "edit")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Apply changes →" }));
  await screen.findByRole("status");
  const exported = lastExport();
  expect(exported.output).toBe("/tmp/signed.pdf");
  expect(exported.operations).toHaveLength(2);
  expect(exported.operations[0]).toMatchObject({ kind: "signature", page: 0, ...firstBox, data: pictureData });
  expect(exported.operations[1]).toMatchObject({ kind: "signature", page: 1, ...thirdBox, data: pictureData });
  expect(exported.operations[0].id).not.toBe(exported.operations[1].id);
  expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  expect(getSignature(2, 2)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
  await screen.findByText("Page 1 of 2");
  expect(box(getSignature())).toEqual(firstBox);
});

test("preview zoom converts pointer movement and touch handles without changing export coordinates", async () => {
  displayWidth = 306;
  const { container } = mountEditor();
  await preparePicture();
  const page = pdfPage(container);
  const signature = await place(page, 150, 150);
  const original = box(signature);
  expect(original.x).toBe(210);
  const handle = screen.getByRole("button", { name: "Resize signature se" });
  expect(Number(handle.querySelector(".resize-target")!.getAttribute("width"))).toBe(88);
  key("ArrowRight");
  expect(box(signature).x).toBe(original.x + 2);
  drag(handle, page, [195, 165], [-1000, -1000]);
  expect(box(signature).height).toBe(40);
  const expected = box(signature);
  fireEvent.click(screen.getByRole("button", { name: "Apply changes →" }));
  await screen.findByRole("status");
  expect(lastExport().operations[0]).toMatchObject(expected);
});

test("typing in inspector inputs does not delete a selected signature or invoke editor undo", async () => {
  const { container } = mountEditor();
  await preparePicture();
  await place(pdfPage(container));
  const width = screen.getByLabelText("Width (pt)");
  fireEvent.keyDown(width, { key: "Backspace" });
  fireEvent.keyDown(width, { key: "z", ctrlKey: true });
  expect(screen.getByText("1 edits")).toBeTruthy();
});

test.each(["Type", "Draw"] as const)("%s signatures remain editable and retain their source representation until export", async source => {
  const { container } = mountEditor();
  await screen.findByText("Page 1 of 2");
  await waitFor(() => expect(screen.getByRole("button", { name: "Add signature" }).hasAttribute("disabled")).toBe(false));
  if (source === "Type") {
    fireEvent.click(screen.getByRole("button", { name: "Type", exact: true }));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Jane Doe" } });
  } else {
    const canvas = container.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, { pointerId: 20, clientX: 30, clientY: 40 });
    fireEvent.pointerMove(canvas, { pointerId: 20, clientX: 80, clientY: 60 });
    fireEvent.pointerMove(canvas, { pointerId: 20, clientX: 200, clientY: 50 });
    fireEvent.pointerUp(canvas, { pointerId: 20 });
    // Changing creation tabs must not lose an existing drawn signature.
    fireEvent.click(screen.getByRole("button", { name: "Picture", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Draw", exact: true }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Place signature" }));
  const page = pdfPage(container);
  const signature = await place(page);
  const original = box(signature);
  fireEvent.click(screen.getByRole("button", { name: "Make selected image larger" }));
  expect(box(signature).width).toBeCloseTo(original.width * 1.25);
  expect(box(signature).width / box(signature).height).toBeCloseTo(original.width / original.height);
  fireEvent.click(screen.getByRole("button", { name: "Apply changes →" }));
  await screen.findByRole("status");
  const operation = lastExport().operations[0];
  expect(operation).toMatchObject({ kind: "signature", ...box(signature), data: "data:image/png;base64,CANVAS_SIGNATURE" });
  if (source === "Draw") {
    expect(operation.signaturePaths).toEqual([[[27, 27], [77, 47], [197, 37]]]);
    expect(operation.signatureViewBox).toEqual({ width: 215, height: 65 });
    expect(signature.querySelector("polyline")!.getAttribute("points")).toBe("27,27 77,47 197,37");
  } else expect(operation.signaturePaths).toBeUndefined();
});
