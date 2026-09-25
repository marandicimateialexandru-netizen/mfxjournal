import { useRef, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;

/** Shared full-screen image viewer — click-to-zoom, scroll to zoom, drag to pan once zoomed,
 *  double-click to toggle, a red close button that only dismisses the image. Originally built for
 *  the New Trade screenshot preview; reused as-is everywhere else an uploaded screenshot needs a
 *  zoomable view (e.g. the trade detail modal) so every screenshot viewer in the app behaves
 *  identically instead of drifting into slightly different reimplementations.
 *
 *  A real nested Radix Dialog, not a hand-rolled `fixed` div — Radix already renders its content
 *  through its own portal to `document.body` and tracks its own stack of dismissable layers, so
 *  this reliably covers the true viewport (not just the parent dialog's own box, which a
 *  `position: fixed` descendant would be confined to if the parent has a CSS `transform` on it —
 *  as every `DialogContent` here does, to center itself) and outside-click/Escape only ever
 *  dismisses this topmost layer, leaving whatever opened it untouched. */
export function ImageLightbox({ path, label, onClose }: { path: string; label: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  function clampZoom(z: number) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  }

  function applyZoom(next: number) {
    const clamped = clampZoom(next);
    setZoom(clamped);
    if (clamped === ZOOM_MIN) setPan({ x: 0, y: 0 });
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    applyZoom(zoom - e.deltaY * 0.0018 * zoom);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (zoom <= ZOOM_MIN) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return;
    setPan({ x: dragRef.current.panX + (e.clientX - dragRef.current.startX), y: dragRef.current.panY + (e.clientY - dragRef.current.startY) });
  }
  function endDrag() {
    dragRef.current = null;
  }

  function toggleZoom() {
    if (zoom > ZOOM_MIN) applyZoom(1);
    else applyZoom(2.5);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        hideClose
        className="inset-0 top-0 left-0 right-0 bottom-0 flex h-screen max-h-screen w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center gap-0 rounded-none border-none bg-black/90 p-3 shadow-none"
        onClick={onClose}
      >
        <span className="absolute left-6 top-6 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
          <ZoomIn className="h-3.5 w-3.5" /> {label}
        </span>

        <div
          className="absolute right-6 top-6 flex items-center gap-1 rounded-full border border-white/10 bg-black/45 p-1.5 shadow-xl backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => applyZoom(zoom - 0.6)}
            title="Zoom out"
            className="rounded-full p-2 text-white transition-colors hover:bg-white/15"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[3.5ch] text-center text-xs font-medium tabular-nums text-white/85">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => applyZoom(zoom + 0.6)}
            title="Zoom in"
            className="rounded-full p-2 text-white transition-colors hover:bg-white/15"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="mx-1 h-5 w-px bg-white/15" />
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="rounded-full bg-[var(--color-danger)] p-2 text-white shadow-md transition-transform duration-150 hover:scale-110 hover:brightness-110 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
          <img
            src={convertFileSrc(path)}
            alt={label}
            draggable={false}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onDoubleClick={(e) => {
              e.stopPropagation();
              toggleZoom();
            }}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              cursor: zoom > ZOOM_MIN ? (dragRef.current ? "grabbing" : "grab") : "zoom-in",
            }}
            className="block max-h-[92vh] max-w-[92vw] select-none rounded-lg object-contain shadow-2xl transition-transform duration-150 ease-out"
          />
        </div>

        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">
          Scroll or use the buttons to zoom · drag to pan · double-click to reset
        </span>
      </DialogContent>
    </Dialog>
  );
}
