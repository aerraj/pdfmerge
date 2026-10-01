// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import PdfEditor from "../src/PdfEditor";

const mockInvoke = vi.hoisted(() => vi.fn());
const mockOpen = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen, save: vi.fn() }));

beforeEach(() => {
  mockOpen.mockResolvedValue("/tmp/signature.png");
  mockInvoke.mockImplementation((_command: string, { request }: { request: { tool: string } }) => {
    if (request.tool === "preview") return Promise.resolve({
      count: 1, page: 0, width: 612, height: 792,
      image: "data:image/png;base64,AA==", objects: [],
    });
    if (request.tool === "signature_image") return Promise.resolve({
      data: "data:image/png;base64,AA==", width: 500, height: 180,
    });
    throw new Error(`Unexpected tool ${request.tool}`);
  });
  Object.defineProperty(SVGElement.prototype, "setPointerCapture", { value: () => {}, configurable: true });
  vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 612, bottom: 792,
    width: 612, height: 792, toJSON: () => ({}),
  });
});

test("a picture signature is placed once, keeps its ratio, resizes and can be deleted", async () => {
  const { container } = render(<PdfEditor path="/tmp/sample.pdf" initialMode="signature" onDirtyChange={() => {}} onBusyChange={() => {}} />);
  await screen.findByText(/Page 1 of 1/);
  fireEvent.click(screen.getByRole("button", { name: "Picture" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose signature picture" }));
  await waitFor(() => expect(screen.getByRole("img", { name: "Prepared signature" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Place signature" }));

  const page = container.querySelector(".page-stage svg") as SVGSVGElement;
  fireEvent.pointerDown(page, { pointerId: 1, clientX: 300, clientY: 300 });
  fireEvent.pointerUp(page, { pointerId: 1, clientX: 300, clientY: 300 });
  expect(screen.getByText("1 edits")).toBeTruthy();
  expect(screen.getByText("Signature selected")).toBeTruthy();
  expect((screen.getByLabelText("Width (pt)") as HTMLInputElement).value).toBe("180");
  expect((screen.getByLabelText("Height (pt)") as HTMLInputElement).value).toBe("65");

  fireEvent.pointerDown(page, { pointerId: 2, clientX: 400, clientY: 400 });
  fireEvent.pointerUp(page, { pointerId: 2, clientX: 400, clientY: 400 });
  expect(screen.getByText("1 edits")).toBeTruthy();
  fireEvent.pointerDown(page.querySelector("g") as SVGGElement, { pointerId: 3, clientX: 300, clientY: 300 });
  fireEvent.pointerUp(page, { pointerId: 3, clientX: 300, clientY: 300 });

  fireEvent.click(screen.getByRole("button", { name: "Make selected image larger" }));
  expect((screen.getByLabelText("Width (pt)") as HTMLInputElement).value).toBe("225");
  expect((screen.getByLabelText("Height (pt)") as HTMLInputElement).value).toBe("81");
  fireEvent.pointerDown(screen.getByRole("button", { name: "Resize signature se" }), { pointerId: 4, clientX: 300, clientY: 300 });
  fireEvent.pointerMove(page, { pointerId: 4, clientX: 330, clientY: 300 });
  fireEvent.pointerUp(page, { pointerId: 4, clientX: 330, clientY: 300 });
  expect((screen.getByLabelText("Width (pt)") as HTMLInputElement).value).toBe("255");
  fireEvent.click(screen.getByText("Delete signature"));
  expect(screen.getByText("0 edits")).toBeTruthy();
  expect(screen.queryByText("Signature selected")).toBeNull();
});
