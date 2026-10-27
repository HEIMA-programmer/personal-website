import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, Box, Button, DialogTitle, IconButton, Link, Modal, ModalClose, ModalDialog, Stack, Typography } from "@mui/joy";
import ZoomInRoundedIcon from "@mui/icons-material/ZoomInRounded";
import ZoomOutRoundedIcon from "@mui/icons-material/ZoomOutRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

export interface Figure {
  url: string; label: string; caption: string; sourceUrl: string; license: string; licenseUrl: string; credit: string;
  nonCommercial?: boolean; noDerivatives?: boolean; verifiedAt?: string;
}

export default function FigureLightbox({ figure, onClose }: { figure: Figure | null; onClose: () => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(null);
  const attachViewport = useCallback((element: HTMLDivElement | null) => {
    viewport.current = element;
    setViewportElement(element);
  }, []);
  const displayedImage = useRef<HTMLImageElement>(null);
  const center = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  const aspect = natural.width && natural.height ? natural.width / natural.height : 1;
  const fitWidth = Math.max(1, Math.min(size.width - 24, (size.height - 24) * aspect, natural.width || Infinity));
  const width = fitWidth * zoom, height = width / aspect;

  useEffect(() => {
    setZoom(1); setNatural({ width: displayedImage.current?.naturalWidth || 0, height: displayedImage.current?.naturalHeight || 0 }); setFailed(false); center.current = null;
  }, [figure]);

  // Modal portals may mount after the figure effect. Observe the mounted element,
  // not only the requested figure, so first-open fit uses its real dimensions.
  useLayoutEffect(() => {
    const element = viewportElement;
    if (!figure || !element) return;
    // clientHeight/clientWidth round fractional CSS pixels up, which can make
    // the fit canvas overflow by a fraction and toggle scrollbars repeatedly.
    const measure = ({ width, height }: { width: number; height: number }) => {
      const next = { width: Math.floor(width), height: Math.floor(height) };
      setSize(current => current.width === next.width && current.height === next.height ? current : next);
    };
    measure(element.getBoundingClientRect());
    const observer = new ResizeObserver(entries => {
      if (entries[0]) measure(entries[0].contentRect);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [figure, viewportElement]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !center.current) return;
    element.scrollLeft = center.current.x * element.scrollWidth - element.clientWidth / 2;
    element.scrollTop = center.current.y * element.scrollHeight - element.clientHeight / 2;
    center.current = null;
  }, [zoom, width, height]);

  const changeZoom = (next: number) => {
    const element = viewport.current;
    if (element) center.current = {
      x: (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth,
      y: (element.scrollTop + element.clientHeight / 2) / element.scrollHeight,
    };
    setZoom(Math.max(1, Math.min(6, next)));
  };

  return figure ? <Modal open onClose={onClose}>
    <ModalDialog aria-labelledby="figure-viewer-title" sx={{ width: "94vw", maxWidth: 1400, height: "92dvh", p: { xs: 1.25, sm: 2 }, gap: 1 }}>
      <ModalClose aria-label="Close enlarged figure" />
        <DialogTitle id="figure-viewer-title" sx={{ pr: 4 }}>{figure.label}</DialogTitle>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <IconButton size="sm" variant="soft" aria-label="Zoom out figure" disabled={zoom <= 1} onClick={() => changeZoom(zoom / 1.5)}><ZoomOutRoundedIcon /></IconButton>
          <Typography level="body-sm" sx={{ minWidth: 43, textAlign: "center" }}>{Math.round(zoom * 100)}%</Typography>
          <IconButton size="sm" variant="soft" aria-label="Zoom in figure" disabled={zoom >= 6} onClick={() => changeZoom(zoom * 1.5)}><ZoomInRoundedIcon /></IconButton>
          <Button size="sm" variant="plain" onClick={() => { center.current = null; setZoom(1); }}>Fit</Button>
          <Button size="sm" variant="plain" component="a" href={figure.url} target="_blank" rel="noopener noreferrer" startDecorator={<OpenInNewRoundedIcon />} sx={{ ml: "auto" }}>Original image</Button>
        </Stack>
        <Box ref={attachViewport} tabIndex={0} role="region" aria-label="Enlarged article figure; use zoom controls, then scroll or drag to inspect" sx={{ flex: 1, minHeight: 0, overflow: "auto", bgcolor: "#f8f9fa", borderRadius: "sm", cursor: zoom > 1 ? "grab" : "default", "&:active": { cursor: zoom > 1 ? "grabbing" : "default" }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500" } }}
          onPointerDown={event => {
            if (event.pointerType !== "mouse" || event.button !== 0 || zoom <= 1) return;
            const element = event.currentTarget;
            drag.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
            element.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            if (!drag.current) return;
            event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
            event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y);
          }}
          onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => { drag.current = null; }}>
          {failed ? <Alert color="warning">This image could not be loaded. <Link href={figure.sourceUrl} target="_blank" rel="noopener noreferrer">Open the article</Link></Alert> : <Box sx={{ width: Math.max(size.width, width + 24), minHeight: Math.max(size.height, height + 24), display: "grid", placeItems: "center" }}>
            <img ref={displayedImage} src={figure.url} alt={`${figure.label}: ${figure.caption}`} draggable={false} onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setFailed(true)} style={{ display: "block", width, height, maxWidth: "none", objectFit: "contain" }} />
          </Box>}
        </Box>
        <Typography level="body-xs">Scroll or drag after zooming. The original figure is shown without cropping.</Typography>
        <Typography level="body-xs" sx={{ overflowWrap: "anywhere" }}><Link href={figure.sourceUrl} target="_blank" rel="noopener noreferrer">Article source</Link> · <Link href={figure.licenseUrl} target="_blank" rel="noopener noreferrer">{figure.license}</Link> · {figure.credit}</Typography>
    </ModalDialog>
  </Modal> : null;
}
