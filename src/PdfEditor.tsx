import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  constrainSignature,
  moveSignature,
  resizeSignature,
  scaleSignature,
  type Corner,
} from "./signatureGeometry";
import { useEditHistory } from "./useEditHistory";

type PdfObject = {
  id: number;
  annotationId?: number;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  size?: number;
};
type Preview = {
  count: number;
  page: number;
  width: number;
  height: number;
  image: string;
  objects: PdfObject[];
};
type SignatureAsset = {
  data: string;
  ratio: number;
  signaturePaths?: number[][][];
  signatureViewBox?: { width: number; height: number };
  signatureStrokeWidth?: number;
};
type Edit = {
  id: string;
  signaturePaths?: number[][][];
  signatureViewBox?: { width: number; height: number };
  signatureStrokeWidth?: number;
  kind: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  size?: number;
  color?: string;
  data?: string;
  url?: string;
  targetPage?: number;
  objectId?: number;
  annotationId?: number;
  points?: number[][];
  font?: string;
  bold?: boolean;
  italic?: boolean;
  fill?: boolean;
  stroke?: number;
  options?: string;
  value?: string;
  find?: string;
  replace?: string;
  matchCase?: boolean;
  scope?: string;
};
type SignatureSource = "draw" | "type" | "upload";
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const engine = <T,>(request: object) => invoke<T>("run_engine", { request });
const toolGroups = [
  ["Text", ["select", "text", "find_replace"]],
  ["Links", ["link"]],
  ["Forms", ["field", "multiline", "dropdown", "radio", "checkbox"]],
  ["Images", ["image"]],
  ["Sign", ["signature"]],
  ["Whiteout", ["whiteout", "redact"]],
  ["Annotate", ["highlight", "strikeout", "underline", "ink"]],
  ["Shapes", ["rectangle", "ellipse", "line", "arrow"]],
] as const;
const labels: Record<string, string> = {
  select: "Select",
  text: "Add text",
  find_replace: "Find & replace",
  link: "Link",
  field: "Text field",
  multiline: "Multiline",
  dropdown: "Drop-down",
  radio: "Radio",
  checkbox: "Checkbox",
  image: "Add image",
  signature: "Add signature",
  whiteout: "Whiteout",
  redact: "Secure redact",
  highlight: "Highlight",
  strikeout: "Strike out",
  underline: "Underline",
  ink: "Freehand",
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  arrow: "Arrow",
};
const areaModes = new Set([
  "link",
  "field",
  "multiline",
  "dropdown",
  "whiteout",
  "redact",
  "highlight",
  "strikeout",
  "underline",
  "rectangle",
  "ellipse",
  "line",
  "arrow",
]);
const imageModes = new Set(["image", "signature"]);
const minDimension = (value: number) => Math.max(4, value);
const safeRatio = (width: number, height: number) =>
  width > 0 && height > 0 ? width / height : 2.5;
const handles: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const handleCursor: Record<Handle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};
function resizeBox(
  original: Edit,
  handle: Handle,
  dx: number,
  dy: number,
  keepRatio: boolean,
) {
  const { x, y, width, height } = original;
  let w = width,
    h = height;
  if (handle.includes("e")) w = width + dx;
  if (handle.includes("w")) w = width - dx;
  if (handle.includes("s")) h = height + dy;
  if (handle.includes("n")) h = height - dy;
  w = minDimension(w);
  h = minDimension(h);
  if (keepRatio && handle.length === 2) {
    const ratio = safeRatio(width, height);
    if (Math.abs(w / width - 1) >= Math.abs(h / height - 1))
      h = minDimension(w / ratio);
    else w = minDimension(h * ratio);
  }
  const nx = handle.includes("w") ? x + width - w : x,
    ny = handle.includes("n") ? y + height - h : y;
  return {
    ...original,
    x: nx,
    y: ny,
    width: w,
    height: h,
    points: original.points?.map(([px, py]) => [
      nx + ((px - x) * w) / width,
      ny + ((py - y) * h) / height,
    ]),
  };
}

export default function PdfEditor({
  path,
  initialMode = "select",
  onDirtyChange,
  onBusyChange,
}: {
  path: string;
  initialMode?: string;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [preview, setPreview] = useState<Preview>();
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState(initialMode);
  const history = useEditHistory<Edit>();
  const edits = history.items,
    setEdits = history.update;
  const [savedEdits, setSavedEdits] = useState<Edit[]>([]);
  const [draft, setDraft] = useState<Edit>();
  const [selected, setSelected] = useState<PdfObject>();
  const [selectedEdit, setSelectedEdit] = useState<string>();
  const [text, setText] = useState("Your text");
  const [options, setOptions] = useState("Option 1\nOption 2");
  const [size, setSize] = useState(16);
  const [color, setColor] = useState("#1d3927");
  const [font, setFont] = useState("sans");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [fill, setFill] = useState(false);
  const [asset, setAsset] = useState("");
  const [assetRatio, setAssetRatio] = useState(2.5);
  const [savedSignature, setSavedSignature] = useState<SignatureAsset>();
  const drawnPaths = useRef<number[][][]>([]);
  const signatureVectors = useRef<
    Pick<
      SignatureAsset,
      "signaturePaths" | "signatureViewBox" | "signatureStrokeWidth"
    >
  >({});
  const nextId = useRef(0);
  const newId = () => `edit-${++nextId.current}`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [signatureOpen, setSignatureOpen] = useState(
    initialMode === "signature",
  );
  const [signatureSource, setSignatureSource] =
    useState<SignatureSource>("draw");
  const [signatureName, setSignatureName] = useState("");
  const [signatureFile, setSignatureFile] = useState("");
  const [removeBackground, setRemoveBackground] = useState(true);
  const [signaturePreview, setSignaturePreview] = useState("");
  const [signaturePreviewRatio, setSignaturePreviewRatio] = useState(2.5);
  const [signaturePreparing, setSignaturePreparing] = useState(false);
  const [signatureError, setSignatureError] = useState("");
  const [find, setFind] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [scope, setScope] = useState("all");
  const [lockRatio, setLockRatio] = useState(true);
  const signatureCanvas = useRef<HTMLCanvasElement>(null);
  const signing = useRef(false);
  const signatureRequest = useRef(0);
  const start = useRef<
    | {
        x: number;
        y: number;
        id?: string;
        original?: Edit;
        resize?: Handle;
        pointerId?: number;
      }
    | undefined
  >(undefined);
  const svg = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const canvas = signatureCanvas.current;
    if (!signatureOpen || signatureSource !== "draw" || !canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.lineWidth = 3;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "#13291d";
    for (const stroke of drawnPaths.current) {
      if (!stroke.length) continue;
      c.beginPath();
      c.moveTo(stroke[0][0], stroke[0][1]);
      for (const [x, y] of stroke) c.lineTo(x, y);
      if (stroke.length === 1) c.lineTo(stroke[0][0] + 0.01, stroke[0][1]);
      c.stroke();
    }
  }, [signatureOpen, signatureSource]);
  useEffect(
    () =>
      onDirtyChange(
        edits.length !== savedEdits.length ||
          edits.some((op, i) => op !== savedEdits[i]),
      ),
    [edits, savedEdits, onDirtyChange],
  );
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    engine<Preview>({ tool: "preview", inputs: [path], page })
      .then((p) => {
        if (active) setPreview(p);
      })
      .catch((e) => {
        if (active) setError(String(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [path, page]);
  useEffect(() => {
    const element = svg.current;
    if (!element || !preview) return;
    const update = () => {
      const width = element.getBoundingClientRect().width;
      if (width) setScale(preview.width / width);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [preview]);
  const activeEdit = edits.find((op) => op.id === selectedEdit);
  const focusEdit = (id: string) =>
    requestAnimationFrame(() =>
      svg.current
        ?.querySelector<SVGGElement>(`[data-edit-id="${id}"]`)
        ?.focus(),
    );
  function deleteEdit(id: string) {
    if (busy) return;
    setEdits((items) => items.filter((op) => op.id !== id));
    setSelectedEdit(undefined);
    start.current = undefined;
    svg.current?.focus();
  }
  function undo() {
    if (busy) return;
    history.undo();
    setDraft(undefined);
    start.current = undefined;
    setMode("select");
    setSelected(undefined);
  }
  function redo() {
    if (busy) return;
    history.redo();
    setDraft(undefined);
    start.current = undefined;
    setMode("select");
    setSelected(undefined);
  }
  function duplicateSignature() {
    if (!activeEdit || !preview || busy) return;
    const op = {
      ...activeEdit,
      id: newId(),
      ...moveSignature(activeEdit, 16 * scale, 16 * scale, preview),
    };
    setEdits((items) => [...items, op]);
    setSelectedEdit(op.id);
    focusEdit(op.id);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        busy ||
        signatureOpen ||
        (target &&
          (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)))
      )
        return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (key === "y") {
          e.preventDefault();
          redo();
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        history.cancel();
        setDraft(undefined);
        start.current = undefined;
        setSelectedEdit(undefined);
        setSelected(undefined);
        setMode("select");
        svg.current?.focus();
        return;
      }
      if (!activeEdit || activeEdit.page !== page || !preview) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteEdit(activeEdit.id);
        return;
      }
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (delta[e.key] && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 1) * scale;
        const [dx, dy] = delta[e.key];
        setEdits((items) =>
          items.map((op) =>
            op.id === activeEdit.id
              ? { ...op, ...moveSignature(op, dx * step, dy * step, preview) }
              : op,
          ),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const getPoint = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * (preview?.width || 1),
      y: ((e.clientY - r.top) / r.height) * (preview?.height || 1),
    };
  };
  const pointerOnEdit = (
    e: React.PointerEvent<SVGElement>,
    op: Edit,
    resize?: Handle,
  ) => {
    if (
      (e.button !== undefined && e.button !== 0) ||
      mode !== "select" ||
      !preview ||
      busy ||
      start.current
    )
      return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedEdit(op.id);
    setSelected(undefined);
    focusEdit(op.id);
    const r = svg.current!.getBoundingClientRect();
    history.begin();
    start.current = {
      x: ((e.clientX - r.left) / r.width) * preview.width,
      y: ((e.clientY - r.top) / r.height) * preview.height,
      id: op.id,
      original: op,
      resize,
      pointerId: e.pointerId,
    };
    svg.current!.setPointerCapture(e.pointerId);
  };
  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (
      (e.button !== undefined && e.button !== 0) ||
      busy ||
      !preview ||
      mode === "find_replace" ||
      start.current
    )
      return;
    const p = getPoint(e);
    if (mode === "select") {
      setSelectedEdit(undefined);
      setSelected(undefined);
      e.currentTarget.focus();
      return;
    }
    if (imageModes.has(mode) && !asset) {
      setError(
        mode === "signature"
          ? "Create a signature first."
          : "Choose an image first.",
      );
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { ...p, pointerId: e.pointerId };
    setSelected(undefined);
    setSelectedEdit(undefined);
    let width = imageModes.has(mode)
      ? Math.min(180, preview.width * 0.3)
      : mode === "text"
        ? Math.max(90, text.length * size * 0.52)
        : mode === "checkbox" || mode === "radio"
          ? 20
          : 120;
    let height = imageModes.has(mode)
      ? width / assetRatio
      : mode === "text"
        ? Math.max(size * 1.3, 24)
        : mode === "checkbox" || mode === "radio"
          ? 20
          : 50;
    if (imageModes.has(mode) && height > preview.height * 0.3) {
      height = preview.height * 0.3;
      width = height * assetRatio;
    }
    const position = imageModes.has(mode)
      ? {
          x: Math.max(0, Math.min(preview.width - width, p.x - width / 2)),
          y: Math.max(0, Math.min(preview.height - height, p.y - height / 2)),
        }
      : p;
    let op: Edit = {
      id: newId(),
      kind: mode,
      page,
      ...position,
      width,
      height,
      text,
      size,
      color,
      data: asset,
      url: mode === "link" ? text : undefined,
      font,
      bold,
      italic,
      fill,
      stroke: 2,
      options,
    };
    if (mode === "signature")
      op = {
        ...op,
        ...signatureVectors.current,
        color: "#13291d",
        ...constrainSignature(op, preview, 20 * scale),
      };
    if (mode === "ink") op.points = [[p.x, p.y]];
    setDraft(op);
  }
  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (!start.current || !preview || start.current.pointerId !== e.pointerId)
      return;
    const p = getPoint(e);
    if (start.current.id && start.current.original) {
      const { id, original, x, y, resize } = start.current;
      history.preview((items) =>
        items.map((op) => {
          if (op.id !== id) return op;
          if (p.x === x && p.y === y) return original;
          if (original.kind === "signature")
            return {
              ...original,
              ...(resize
                ? resizeSignature(
                    original,
                    resize as Corner,
                    p.x - x,
                    p.y - y,
                    preview,
                    20 * scale,
                  )
                : moveSignature(original, p.x - x, p.y - y, preview)),
            };
          if (resize)
            return resizeBox(
              original,
              resize,
              p.x - x,
              p.y - y,
              lockRatio && imageModes.has(original.kind),
            );
          return {
            ...original,
            x: Math.max(0, original.x + p.x - x),
            y: Math.max(0, original.y + p.y - y),
            points: original.points?.map(([px, py]) => [
              px + p.x - x,
              py + p.y - y,
            ]),
          };
        }),
      );
    } else if (draft) {
      if (mode === "ink")
        setDraft({ ...draft, points: [...(draft.points || []), [p.x, p.y]] });
      else if (areaModes.has(mode))
        setDraft({
          ...draft,
          x: Math.min(start.current.x, p.x),
          y: Math.min(start.current.y, p.y),
          width: Math.max(8, Math.abs(p.x - start.current.x)),
          height: Math.max(8, Math.abs(p.y - start.current.y)),
        });
    }
  }
  function up(e: React.PointerEvent<SVGSVGElement>) {
    if (!start.current || start.current.pointerId !== e.pointerId) return;
    if (draft) {
      setEdits((v) => [...v, draft]);
      setDraft(undefined);
      setMode("select");
      setSelectedEdit(draft.id);
      setSelected(undefined);
      focusEdit(draft.id);
    } else if (start.current.id) history.finish();
    start.current = undefined;
  }
  function cancelGesture() {
    history.cancel();
    setDraft(undefined);
    start.current = undefined;
  }
  async function chooseImage() {
    try {
      const file = await open({
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tiff"],
          },
        ],
      });
      if (typeof file !== "string") return;
      const result = await engine<{
        data: string;
        width: number;
        height: number;
      }>({ tool: "read_image", inputs: [file] });
      setAsset(result.data);
      signatureVectors.current = {};
      setAssetRatio(safeRatio(result.width, result.height));
      setMode("image");
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  async function chooseSignature() {
    try {
      const file = await open({
        filters: [
          {
            name: "Signature pictures",
            extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tiff"],
          },
        ],
      });
      if (typeof file !== "string") return;
      setSignatureFile(file);
      setSignatureSource("upload");
      setRemoveBackground(true);
      await previewSignature(file, true);
    } catch (e) {
      setSignatureError(String(e));
    }
  }
  async function previewSignature(file: string, remove: boolean) {
    const request = ++signatureRequest.current;
    setSignatureError("");
    setSignaturePreview("");
    setSignaturePreparing(true);
    try {
      const result = await engine<{
        data: string;
        width: number;
        height: number;
      }>({ tool: "signature_image", inputs: [file], removeBackground: remove });
      if (request === signatureRequest.current) {
        setSignaturePreview(result.data);
        setSignaturePreviewRatio(safeRatio(result.width, result.height));
      }
    } catch (e) {
      if (request === signatureRequest.current) setSignatureError(String(e));
    } finally {
      if (request === signatureRequest.current) setSignaturePreparing(false);
    }
  }
  async function backgroundOption(remove: boolean) {
    setRemoveBackground(remove);
    if (signatureFile) await previewSignature(signatureFile, remove);
  }
  function armSignature(signature: SignatureAsset) {
    setAsset(signature.data);
    setAssetRatio(signature.ratio);
    signatureVectors.current = {
      signaturePaths: signature.signaturePaths,
      signatureViewBox: signature.signatureViewBox,
      signatureStrokeWidth: signature.signatureStrokeWidth,
    };
    setSavedSignature(signature);
    setMode("signature");
    setSignatureOpen(false);
    setSignatureError("");
    setSelectedEdit(undefined);
  }
  function useSignature() {
    if (signatureSource === "upload") {
      if (signaturePreparing || !signaturePreview) {
        setSignatureError("Choose a signature picture first.");
        return;
      }
      armSignature({ data: signaturePreview, ratio: signaturePreviewRatio });
    } else if (signatureSource === "type") {
      const value = signatureName.trim();
      if (!value) {
        setSignatureError("Type your name first.");
        return;
      }
      const canvas = document.createElement("canvas"),
        c = canvas.getContext("2d")!;
      c.font = "italic 144px cursive";
      canvas.width = Math.ceil(c.measureText(value).width) + 100;
      canvas.height = 240;
      c.fillStyle = "#13291d";
      c.font = "italic 144px cursive";
      c.fillText(value, 45, 170);
      armSignature(cropCanvas(canvas));
    } else {
      const source = signatureCanvas.current!;
      if (!drawnPaths.current.length) {
        setSignatureError("Draw a signature first.");
        return;
      }
      const cropped = cropCanvas(source);
      armSignature({
        ...cropped,
        signaturePaths: drawnPaths.current.map((stroke) =>
          stroke.map(([x, y]) => [x - cropped.left + 7, y - cropped.top + 7]),
        ),
        signatureViewBox: { width: cropped.width, height: cropped.height },
        signatureStrokeWidth: 3,
      });
    }
  }
  function cropCanvas(source: HTMLCanvasElement) {
    const context = source.getContext("2d")!,
      pixels = context.getImageData(0, 0, source.width, source.height).data;
    let left = source.width,
      top = source.height,
      right = 0,
      bottom = 0;
    for (let y = 0; y < source.height; y++)
      for (let x = 0; x < source.width; x++)
        if (pixels[(y * source.width + x) * 4 + 3] > 8) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
    const crop = document.createElement("canvas");
    crop.width = Math.max(1, right - left + 15);
    crop.height = Math.max(1, bottom - top + 15);
    crop
      .getContext("2d")!
      .drawImage(
        source,
        left,
        top,
        right - left + 1,
        bottom - top + 1,
        7,
        7,
        right - left + 1,
        bottom - top + 1,
      );
    return {
      data: crop.toDataURL("image/png"),
      ratio: safeRatio(crop.width, crop.height),
      left,
      top,
      width: crop.width,
      height: crop.height,
    };
  }
  function drawSignature(
    e: React.PointerEvent<HTMLCanvasElement>,
    begin = false,
  ) {
    const canvas = e.currentTarget,
      r = canvas.getBoundingClientRect(),
      c = canvas.getContext("2d")!;
    const point = [
      ((e.clientX - r.left) * canvas.width) / r.width,
      ((e.clientY - r.top) * canvas.height) / r.height,
    ];
    if (begin) {
      signing.current = true;
      canvas.setPointerCapture(e.pointerId);
      drawnPaths.current.push([point]);
      c.beginPath();
      c.moveTo(point[0], point[1]);
    }
    if (!signing.current) return;
    const stroke = drawnPaths.current[drawnPaths.current.length - 1];
    if (!begin) stroke.push(point);
    c.lineWidth = 3;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "#13291d";
    c.lineTo(point[0] + (begin ? 0.01 : 0), point[1]);
    c.stroke();
  }
  function replaceOriginal() {
    if (!selected) return;
    if (selected.kind === "image" && !asset) {
      setError("Choose an image first.");
      return;
    }
    const kind =
      selected.kind === "link"
        ? "link"
        : selected.kind === "text"
          ? "text"
          : "image";
    setEdits((v) => [
      ...v,
      {
        id: newId(),
        kind,
        page,
        x: selected.x,
        y: selected.y,
        width: selected.width,
        height: selected.height,
        text,
        size,
        color,
        data: asset,
        url: kind === "link" ? text : undefined,
        objectId: selected.annotationId === undefined ? selected.id : undefined,
        annotationId: selected.annotationId,
        font,
        bold,
        italic,
      },
    ]);
    setSelected(undefined);
  }
  function changeEdit(key: keyof Edit, value: string | number | boolean) {
    if (!activeEdit || busy) return;
    setEdits((items) =>
      items.map((op) => {
        if (op.id !== selectedEdit) return op;
        const result = { ...op, [key]: value };
        if (op.kind === "signature" && preview && typeof value === "number") {
          if (key === "width" || key === "height")
            return {
              ...op,
              ...scaleSignature(op, value / op[key], preview, 20 * scale),
            };
          if (key === "x" || key === "y")
            return {
              ...op,
              ...moveSignature(
                op,
                key === "x" ? value - op.x : 0,
                key === "y" ? value - op.y : 0,
                preview,
              ),
            };
        }
        if (lockRatio && imageModes.has(op.kind) && typeof value === "number") {
          if (key === "width")
            result.height = minDimension(value / (op.width / op.height));
          if (key === "height")
            result.width = minDimension(value * (op.width / op.height));
        }
        return result;
      }),
    );
  }
  function scaleSelected(factor: number) {
    if (!activeEdit || !preview || busy) return;
    setEdits((items) =>
      items.map((op) =>
        op.id === selectedEdit
          ? {
              ...op,
              ...(op.kind === "signature"
                ? scaleSignature(op, factor, preview, 20 * scale)
                : {
                    width: minDimension(op.width * factor),
                    height: minDimension(op.height * factor),
                  }),
            }
          : op,
      ),
    );
  }
  function addFindReplace() {
    if (!find.trim()) {
      setError("Enter text to find.");
      return;
    }
    setEdits((items) => [
      ...items,
      {
        id: newId(),
        kind: "find_replace",
        page,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        find,
        replace: replaceText,
        matchCase,
        scope,
        font,
      },
    ]);
    setMessage(`Find and replace queued: ${find}. Apply changes to save.`);
    setError("");
  }
  async function saveEdits() {
    if (busy) return;
    setError("");
    setMessage("");
    const output = await save({
      defaultPath: path.replace(/\.pdf$/i, "-edited.pdf"),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!output) return;
    if (output === path) {
      setError(
        "Save the edited PDF under a new name to keep this working copy editable.",
      );
      return;
    }
    setBusy(true);
    try {
      const result = await engine<{ message: string }>({
        tool: "edit",
        inputs: [path],
        output,
        operations: edits,
      });
      setMessage(result.message + " " + output);
      setSavedEdits(edits);
      onDirtyChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function renderOp(op: Edit, key: string) {
    if (op.kind === "find_replace" || op.kind === "delete") return null;
    const selected = selectedEdit === key && op !== draft;
    const signature = op.kind === "signature";
    const props = {
      onPointerDown: (e: React.PointerEvent<SVGGElement>) =>
        pointerOnEdit(e, op),
      style: { cursor: mode === "select" ? "move" : "crosshair" },
    };
    const x = op.x,
      y = op.y,
      w = op.width,
      h = op.height;
    const hs = 10 * scale,
      bs = 11 * scale;
    const bx = Math.min(x + w + bs * 0.4, (preview?.width || x + w) - bs),
      by = Math.max(bs, y - bs * 1.4);
    const stroke = op.color || color;
    return (
      <g
        key={key}
        {...props}
        data-edit-id={key}
        className={signature ? "signature-object" : undefined}
        role={signature ? "button" : undefined}
        tabIndex={signature && op !== draft && !busy ? 0 : undefined}
        aria-label={
          signature
            ? `Signature ${edits.filter((item) => item.kind === "signature").findIndex((item) => item.id === op.id) + 1} on page ${op.page + 1}`
            : undefined
        }
        aria-pressed={signature ? selected : undefined}
        onFocus={
          signature
            ? () => {
                if (!busy) {
                  setSelectedEdit(key);
                  setSelected(undefined);
                  setMode("select");
                }
              }
            : undefined
        }
      >
        {signature && (
          <rect
            className="signature-hit"
            x={x}
            y={y}
            width={w}
            height={h}
            fill="transparent"
          />
        )}
        {op.objectId !== undefined && (
          <rect
            x={x}
            y={y - 2}
            width={w + 3}
            height={h + 5}
            fill="white"
            stroke="none"
          />
        )}
        {op.kind === "text" ? (
          <text
            x={x}
            y={y + (op.size || 16)}
            fontSize={op.size}
            fontFamily={
              op.font === "serif"
                ? "serif"
                : op.font === "mono"
                  ? "monospace"
                  : "sans-serif"
            }
            fontWeight={op.bold ? 700 : 400}
            fontStyle={op.italic ? "italic" : "normal"}
            fill={stroke}
          >
            {(op.text || "").split("\n").map((line, i) => (
              <tspan key={i} x={x} dy={i ? 1.2 * (op.size || 16) : 0}>
                {line}
              </tspan>
            ))}
          </text>
        ) : imageModes.has(op.kind) ? (
          <>
            {op.signaturePaths && op.signatureViewBox ? (
              <svg
                x={x}
                y={y}
                width={w}
                height={h}
                viewBox={`0 0 ${op.signatureViewBox.width} ${op.signatureViewBox.height}`}
                style={{ pointerEvents: "none" }}
              >
                {op.signaturePaths.map((points, i) => (
                  <polyline
                    key={i}
                    points={(points.length === 1
                      ? [points[0], [points[0][0] + 0.01, points[0][1]]]
                      : points
                    )
                      .map((p) => p.join(","))
                      .join(" ")}
                    fill="none"
                    stroke="#13291d"
                    strokeWidth={op.signatureStrokeWidth || 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            ) : (
              <image
                href={op.data}
                x={x}
                y={y}
                width={w}
                height={h}
                preserveAspectRatio="none"
              />
            )}
          </>
        ) : op.kind === "ellipse" ? (
          <ellipse
            cx={x + w / 2}
            cy={y + h / 2}
            rx={w / 2}
            ry={h / 2}
            fill={op.fill ? stroke : "none"}
            stroke={stroke}
            strokeWidth={op.stroke || 2}
          />
        ) : ["line", "arrow", "strikeout", "underline"].includes(op.kind) ? (
          <>
            <line
              x1={x}
              y1={
                op.kind === "underline"
                  ? y + h
                  : op.kind === "strikeout"
                    ? y + h / 2
                    : y
              }
              x2={x + w}
              y2={
                op.kind === "arrow" || op.kind === "line"
                  ? y + h
                  : op.kind === "underline"
                    ? y + h
                    : y + h / 2
              }
              stroke={stroke}
              strokeWidth={op.stroke || 2}
            />
            {op.kind === "arrow" && (
              <path
                d={`M ${x + w - 9} ${y + h - 5} L ${x + w} ${y + h} L ${x + w - 5} ${y + h - 9}`}
                fill="none"
                stroke={stroke}
                strokeWidth={op.stroke || 2}
              />
            )}
          </>
        ) : op.kind === "ink" ? (
          <polyline
            points={op.points?.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke={stroke}
            strokeWidth={op.stroke || 2}
          />
        ) : (
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            fill={
              op.kind === "redact"
                ? "black"
                : op.kind === "whiteout"
                  ? "white"
                  : op.kind === "highlight"
                    ? "#ffec6680"
                    : op.fill
                      ? stroke
                      : [
                            "field",
                            "multiline",
                            "dropdown",
                            "radio",
                            "checkbox",
                          ].includes(op.kind)
                        ? "#ddecff88"
                        : "none"
            }
            stroke={stroke}
            strokeWidth={op.stroke || 2}
            strokeDasharray={op.kind === "link" ? "4 3" : undefined}
          />
        )}
        {selected && (
          <>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke="#268953"
              strokeWidth={1.5 * scale}
              strokeDasharray={`${5 * scale} ${3 * scale}`}
              pointerEvents="none"
            />
            {(signature ? (["nw", "ne", "se", "sw"] as Handle[]) : handles).map(
              (handle) => {
                const hx = handle.includes("w")
                    ? x
                    : handle.includes("e")
                      ? x + w
                      : x + w / 2,
                  hy = handle.includes("n")
                    ? y
                    : handle.includes("s")
                      ? y + h
                      : y + h / 2;
                return (
                  <g
                    key={handle}
                    className="resize-handle"
                    role="button"
                    aria-label={`Resize ${op.kind} ${handle}`}
                    style={{ cursor: handleCursor[handle] }}
                    onPointerDown={(e) => pointerOnEdit(e, op, handle)}
                  >
                    <rect
                      className="resize-target"
                      x={hx - 22 * scale}
                      y={hy - 22 * scale}
                      width={44 * scale}
                      height={44 * scale}
                      fill="transparent"
                    />
                    <rect
                      x={hx - hs / 2}
                      y={hy - hs / 2}
                      width={hs}
                      height={hs}
                      rx={hs / 2}
                      fill="white"
                      stroke="#268953"
                      strokeWidth={1.5 * scale}
                      pointerEvents="none"
                    />
                  </g>
                );
              },
            )}
            {!signature && (
              <g
                className="delete-handle"
                role="button"
                aria-label={`Delete ${op.kind}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (e.button === undefined || e.button === 0) deleteEdit(key);
                }}
              >
                <circle
                  cx={bx}
                  cy={by}
                  r={bs}
                  fill="#c83c3c"
                  stroke="white"
                  strokeWidth={1.5 * scale}
                />
                <path
                  d={`M ${bx - bs * 0.4} ${by - bs * 0.4} L ${bx + bs * 0.4} ${by + bs * 0.4} M ${bx + bs * 0.4} ${by - bs * 0.4} L ${bx - bs * 0.4} ${by + bs * 0.4}`}
                  stroke="white"
                  strokeWidth={2 * scale}
                  strokeLinecap="round"
                />
              </g>
            )}
          </>
        )}
      </g>
    );
  }
  function changeMode(id: string) {
    setSelected(undefined);
    setSelectedEdit(undefined);
    setError("");
    if (id === "signature") {
      setMode("select");
      setSignatureOpen(true);
      return;
    }
    if (id === "image") {
      void chooseImage();
      return;
    }
    setMode(id);
  }
  return (
    <div className="editor">
      <div className="editor-menu" role="toolbar" aria-label="PDF editor tools">
        {toolGroups.map(([group, items]) => (
          <div className="editor-menu-group" key={group}>
            <span>{group}</span>
            <div>
              {items.map((id) => (
                <button
                  key={id}
                  className={mode === id ? "active" : ""}
                  disabled={busy}
                  onClick={() => changeMode(id)}
                >
                  {labels[id]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          className="editor-undo"
          disabled={!history.canUndo || busy}
          onClick={undo}
        >
          Undo
        </button>
        <button disabled={!history.canRedo || busy} onClick={redo}>
          Redo
        </button>
        {savedSignature && (
          <button disabled={busy} onClick={() => armSignature(savedSignature)}>
            Reuse signature
          </button>
        )}
      </div>
      {mode === "find_replace" ? (
        <div className="editor-action-row">
          <label>
            Find
            <input value={find} onChange={(e) => setFind(e.target.value)} />
          </label>
          <label>
            Replace with
            <input
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
            />
          </label>
          <label className="editor-check">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(e) => setMatchCase(e.target.checked)}
            />{" "}
            Match case
          </label>
          <label>
            Scope
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">All pages</option>
              <option value="page">This page</option>
            </select>
          </label>
          <button onClick={addFindReplace}>Replace all</button>
        </div>
      ) : (
        <div
          className="editor-options"
          hidden={mode === "signature" || activeEdit?.kind === "signature"}
        >
          <label>
            {mode === "link"
              ? "Link destination"
              : mode === "dropdown" ||
                  ["field", "multiline", "radio", "checkbox"].includes(mode)
                ? "Field or group name"
                : "Text"}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={
                imageModes.has(mode) ||
                [
                  "select",
                  "whiteout",
                  "redact",
                  "highlight",
                  "strikeout",
                  "underline",
                  "ink",
                  "rectangle",
                  "ellipse",
                  "line",
                  "arrow",
                ].includes(mode)
              }
            />
          </label>
          <label>
            Font
            <select value={font} onChange={(e) => setFont(e.target.value)}>
              <option value="sans">Sans</option>
              <option value="serif">Serif</option>
              <option value="mono">Mono</option>
              <option value="vera">Vera</option>
            </select>
          </label>
          <label>
            Size
            <input
              type="number"
              min="5"
              max="144"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </label>
          <label>
            Color
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <button
            className={bold ? "style-active" : ""}
            onClick={() => setBold(!bold)}
            aria-label="Bold"
          >
            B
          </button>
          <button
            className={italic ? "style-active" : ""}
            onClick={() => setItalic(!italic)}
            aria-label="Italic"
          >
            I
          </button>
          <label className="editor-check">
            <input
              type="checkbox"
              checked={fill}
              onChange={(e) => setFill(e.target.checked)}
            />{" "}
            Fill
          </label>
        </div>
      )}
      {mode === "dropdown" && (
        <div className="editor-action-row">
          <label>
            Options, one per line
            <textarea
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              rows={3}
            />
          </label>
        </div>
      )}
      {mode === "signature" && asset && (
        <div className="editor-action-row placement-guide">
          <span>
            <strong>Place signature</strong> Click once on the PDF. It will be
            selected so you can move, resize or delete it.
          </span>
          <button onClick={() => setSignatureOpen(true)}>
            Change signature
          </button>
          <button onClick={() => setMode("select")}>Cancel placement</button>
        </div>
      )}
      {mode === "image" && asset && (
        <div className="editor-action-row placement-guide">
          <span>
            <strong>Place image</strong> Click once on the PDF, then resize or
            delete it.
          </span>
          <button onClick={() => void chooseImage()}>
            Choose another image
          </button>
          <button onClick={() => setMode("select")}>Cancel placement</button>
        </div>
      )}
      {selected && (
        <div className="selection-panel">
          <span>
            Selected original {selected.kind}: {selected.text?.slice(0, 70)}
          </span>
          <button
            onClick={replaceOriginal}
            disabled={selected.kind === "image" && !asset}
          >
            Replace
          </button>
          {selected.kind === "image" && (
            <button onClick={() => void chooseImage()}>
              Choose replacement
            </button>
          )}
          <button
            onClick={() => {
              setEdits((v) => [
                ...v,
                {
                  ...selected,
                  id: newId(),
                  kind: "delete",
                  page,
                  objectId:
                    selected.annotationId === undefined
                      ? selected.id
                      : undefined,
                  annotationId: selected.annotationId,
                },
              ]);
              setSelected(undefined);
            }}
          >
            Delete original
          </button>
        </div>
      )}
      {activeEdit && (
        <div className="edit-inspector">
          <strong>
            {activeEdit.kind === "signature"
              ? "Signature selected"
              : labels[activeEdit.kind] || activeEdit.kind}
          </strong>
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label key={key}>
              {key === "x"
                ? "Left"
                : key === "y"
                  ? "Top"
                  : key === "width"
                    ? "Width"
                    : "Height"}{" "}
              (pt)
              <input
                type="number"
                value={Math.round(activeEdit[key])}
                onChange={(e) =>
                  changeEdit(
                    key,
                    Math.max(
                      key === "width" || key === "height" ? 1 : 0,
                      Number(e.target.value),
                    ),
                  )
                }
              />
            </label>
          ))}
          {imageModes.has(activeEdit.kind) && (
            <>
              <label className="editor-check">
                <input
                  type="checkbox"
                  disabled={activeEdit.kind === "signature"}
                  checked={activeEdit.kind === "signature" || lockRatio}
                  onChange={(e) => setLockRatio(e.target.checked)}
                />{" "}
                Keep proportions
              </label>
              <div className="signature-size-actions">
                <button
                  onClick={() => scaleSelected(0.8)}
                  aria-label="Make selected image smaller"
                >
                  − Smaller
                </button>
                <button
                  onClick={() => scaleSelected(1.25)}
                  aria-label="Make selected image larger"
                >
                  + Larger
                </button>
              </div>
            </>
          )}
          {activeEdit.kind === "text" && (
            <>
              <input
                aria-label="Edit selected text"
                value={activeEdit.text || ""}
                onChange={(e) => changeEdit("text", e.target.value)}
              />
              <button
                onClick={() => {
                  changeEdit("size", size);
                  changeEdit("color", color);
                }}
              >
                Use style above
              </button>
            </>
          )}
          {activeEdit.kind === "link" && (
            <>
              <input
                aria-label="Link destination"
                value={activeEdit.url || ""}
                onChange={(e) => changeEdit("url", e.target.value)}
              />
              <input
                aria-label="Internal page number"
                type="number"
                min="1"
                max={preview?.count}
                placeholder="Page #"
                value={activeEdit.targetPage || ""}
                onChange={(e) =>
                  changeEdit(
                    "targetPage",
                    e.target.value
                      ? Number(e.target.value)
                      : (undefined as unknown as number),
                  )
                }
              />
            </>
          )}
          <button
            className="delete-edit"
            onClick={() => deleteEdit(selectedEdit!)}
          >
            {activeEdit.kind === "signature"
              ? "Delete signature"
              : "Delete item"}
          </button>
          {activeEdit.kind === "signature" && (
            <p className="inspector-help">
              Drag to move. Drag a corner to resize proportionally. Arrow keys
              move; Shift moves faster. Delete removes; Undo restores.
            </p>
          )}
        </div>
      )}
      <div className="page-navigation">
        <button
          aria-label="Previous page"
          disabled={page === 0 || busy}
          onClick={() => {
            setPage(page - 1);
            setSelected(undefined);
            setSelectedEdit(undefined);
          }}
        >
          ←
        </button>
        <span>
          Page {page + 1} of {preview?.count || "…"}
        </span>
        <button
          aria-label="Next page"
          disabled={!preview || page >= preview.count - 1 || busy}
          onClick={() => {
            setPage(page + 1);
            setSelected(undefined);
            setSelectedEdit(undefined);
          }}
        >
          →
        </button>
        <span>{edits.length} edits</span>
      </div>
      <p className="editor-hint">
        {mode === "select"
          ? "Select an item to move, resize or delete it. Choose a tool again to add another item."
          : mode === "signature"
            ? "Click once to place your signature. The editor then switches to Select."
            : mode === "find_replace"
              ? "Find and replace is applied when you save the PDF."
              : areaModes.has(mode)
                ? "Drag on the page to set one area, then choose a tool again for another."
                : "Click once to place content, then choose a tool again for another."}
      </p>
      <div className="page-stage">
        {preview && (
          <svg
            ref={svg}
            tabIndex={-1}
            aria-label="PDF page"
            viewBox={`0 0 ${preview.width} ${preview.height}`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={cancelGesture}
            style={{ touchAction: "none" }}
          >
            <image
              href={preview.image}
              width={preview.width}
              height={preview.height}
            />
            {mode === "select" &&
              preview.objects
                .filter(
                  (obj) =>
                    !edits.some(
                      (op) =>
                        op.page === page &&
                        (obj.annotationId === undefined
                          ? op.objectId === obj.id
                          : op.annotationId === obj.annotationId),
                    ),
                )
                .map((obj) => (
                  <rect
                    key={obj.id}
                    className={
                      selected?.id === obj.id
                        ? "object-hit selected"
                        : "object-hit"
                    }
                    x={obj.x}
                    y={obj.y}
                    width={Math.max(obj.width, 5)}
                    height={Math.max(obj.height, 5)}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelected(obj);
                      setSelectedEdit(undefined);
                      setText(obj.text || "");
                      setSize(obj.size || 16);
                    }}
                  />
                ))}
            {edits.map((op) => (op.page === page ? renderOp(op, op.id) : null))}
            {draft && renderOp(draft, draft.id)}
          </svg>
        )}
        {activeEdit?.kind === "signature" &&
          activeEdit.page === page &&
          preview && (
            <div
              className="signature-toolbar"
              role="toolbar"
              aria-label="Signature actions"
              style={{
                left:
                  16 +
                  Math.min(
                    Math.max(0, activeEdit.x / scale),
                    Math.max(0, preview.width / scale - 104),
                  ),
                top:
                  16 +
                  (activeEdit.y / scale >= 54
                    ? activeEdit.y / scale - 52
                    : activeEdit.y / scale + activeEdit.height / scale + 24),
              }}
            >
              <button
                disabled={busy}
                aria-label="Duplicate signature"
                title="Duplicate signature"
                onClick={duplicateSignature}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 8h12v12H8zM4 16V4h12" />
                </svg>
              </button>
              <button
                disabled={busy}
                aria-label="Delete signature"
                title="Delete signature"
                onClick={() => deleteEdit(activeEdit.id)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
                </svg>
              </button>
            </div>
          )}
        {busy && <div className="editor-loading">Processing…</div>}
      </div>
      {edits.some((op) => op.kind === "redact") && (
        <p className="notice error">
          Secure redaction rebuilds all pages as images and removes underlying
          text, links, forms and metadata. Whiteout only covers content
          visually.
        </p>
      )}
      <div className="editor-save">
        <button
          className="primary-button"
          disabled={busy || (!edits.length && !savedEdits.length)}
          onClick={() => void saveEdits()}
        >
          Apply changes →
        </button>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {signatureOpen && (
        <div className="modal-backdrop">
          <div
            className="signature-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Create signature"
          >
            <h2>Add your signature</h2>
            <div className="signature-tabs">
              {(["draw", "type", "upload"] as SignatureSource[]).map(
                (source) => (
                  <button
                    key={source}
                    className={signatureSource === source ? "active" : ""}
                    onClick={() => {
                      setSignatureSource(source);
                      setSignatureError("");
                    }}
                  >
                    {source === "draw"
                      ? "Draw"
                      : source === "type"
                        ? "Type"
                        : "Picture"}
                  </button>
                ),
              )}
            </div>
            {signatureSource === "draw" && (
              <>
                <p>Draw with your mouse, trackpad or pen.</p>
                <canvas
                  ref={signatureCanvas}
                  width={600}
                  height={220}
                  onPointerDown={(e) => drawSignature(e, true)}
                  onPointerMove={(e) => drawSignature(e)}
                  onPointerUp={() => (signing.current = false)}
                  onPointerCancel={() => (signing.current = false)}
                />
                <button
                  onClick={() => {
                    signatureCanvas.current
                      ?.getContext("2d")
                      ?.clearRect(0, 0, 600, 220);
                    drawnPaths.current = [];
                  }}
                >
                  Clear drawing
                </button>
              </>
            )}

            {signatureSource === "type" && (
              <div className="typed-signature">
                <label>
                  Your name
                  <input
                    autoFocus
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                  />
                </label>
                <span>{signatureName || "Your signature"}</span>
              </div>
            )}
            {signatureSource === "upload" && (
              <div className="signature-upload">
                <button onClick={() => void chooseSignature()}>
                  Choose signature picture
                </button>
                <span>{signatureFile.split(/[\\/]/).pop()}</span>
                <div className="signature-background">
                  <label>
                    <input
                      type="radio"
                      checked={!removeBackground}
                      onChange={() => void backgroundOption(false)}
                    />{" "}
                    Keep original background
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={removeBackground}
                      onChange={() => void backgroundOption(true)}
                    />{" "}
                    Remove light background
                  </label>
                </div>
                {signaturePreview && (
                  <div className="signature-image-preview">
                    <img src={signaturePreview} alt="Prepared signature" />
                  </div>
                )}
                <p>
                  For the cleanest result, use dark ink on plain light paper.
                  Your original picture is unchanged.
                </p>
              </div>
            )}
            {signaturePreparing && <p role="status">Preparing picture…</p>}
            {signatureError && (
              <p role="alert" className="notice error">
                {signatureError}
              </p>
            )}
            <div className="dialog-actions">
              <button
                onClick={() => {
                  setSignatureOpen(false);
                  setMode("select");
                }}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={signatureSource === "upload" && signaturePreparing}
                onClick={useSignature}
              >
                Place signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
