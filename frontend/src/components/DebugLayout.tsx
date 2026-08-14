import { useCallback, useEffect, useState } from "react";

// Temporary diagnostic for the Firefox-Android scrollbar/overflow report.
// Renders only with ?debug=layout in the URL. Delete once the cause is found.

interface Overflowing {
  tag: string;
  cls: string;
  right: number;
  width: number;
  position: string;
}

function measure() {
  const de = document.documentElement;
  const vv = window.visualViewport;
  const limit = de.clientWidth;

  const overflowing: Overflowing[] = [];
  for (const el of document.querySelectorAll<HTMLElement>("body *")) {
    if (el.closest("[data-debug-layout]")) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.right <= limit + 1) continue;
    overflowing.push({
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === "string" ? el.className : "").slice(0, 60),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
      position: getComputedStyle(el).position,
    });
  }
  overflowing.sort((a, b) => b.right - a.right);

  return {
    innerWidth: window.innerWidth,
    clientWidth: de.clientWidth,
    scrollWidth: de.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    rootScrollbar: window.innerWidth - de.clientWidth,
    visualWidth: vv ? Math.round(vv.width) : null,
    visualScale: vv ? Number(vv.scale.toFixed(3)) : null,
    dpr: window.devicePixelRatio,
    pointerFine: matchMedia("(pointer: fine)").matches,
    anyPointerFine: matchMedia("(any-pointer: fine)").matches,
    hover: matchMedia("(hover: hover)").matches,
    gutter: getComputedStyle(de).scrollbarGutter || "(unsupported)",
    scrollbarWidthProp: getComputedStyle(de).scrollbarWidth || "(unsupported)",
    bodyOverflow: document.body.style.overflow || "(unset)",
    bodyPaddingRight: document.body.style.paddingRight || "(unset)",
    overflowing: overflowing.slice(0, 6),
  };
}

export default function DebugLayout() {
  const [data, setData] = useState(measure);
  const [open, setOpen] = useState(true);

  const refresh = useCallback(() => setData(measure()), []);

  useEffect(() => {
    const id = setInterval(refresh, 500);
    window.addEventListener("resize", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", refresh);
    };
  }, [refresh]);

  const rows: [string, string][] = [
    ["innerWidth", String(data.innerWidth)],
    ["clientWidth", String(data.clientWidth)],
    ["root scrollbar", `${data.rootScrollbar}px`],
    ["html scrollWidth", String(data.scrollWidth)],
    ["body scrollWidth", String(data.bodyScrollWidth)],
    ["visualViewport", `${data.visualWidth} @ ${data.visualScale}`],
    ["devicePixelRatio", String(data.dpr)],
    ["pointer:fine", String(data.pointerFine)],
    ["any-pointer:fine", String(data.anyPointerFine)],
    ["hover:hover", String(data.hover)],
    ["scrollbar-gutter", data.gutter],
    ["scrollbar-width", data.scrollbarWidthProp],
    ["body.overflow", data.bodyOverflow],
    ["body.paddingRight", data.bodyPaddingRight],
  ];

  return (
    <div
      data-debug-layout
      className="fixed bottom-0 left-0 z-[100] max-h-[60vh] w-full overflow-y-auto border-t border-border bg-surface/95 p-2 font-mono text-[10px] leading-tight text-text backdrop-blur-sm"
    >
      <button onClick={() => setOpen((o) => !o)} className="mb-1 underline">
        {open ? "hide" : "show"} layout debug
      </button>
      {open && (
        <>
          <div className="grid grid-cols-2 gap-x-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-muted">{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-border pt-1">
            <div className="text-muted">overflowing right edge ({data.overflowing.length}):</div>
            {data.overflowing.length === 0 && <div>none</div>}
            {data.overflowing.map((o, i) => (
              <div key={i} className="break-all">
                {o.tag}.{o.cls} — right {o.right} w {o.width} [{o.position}]
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
