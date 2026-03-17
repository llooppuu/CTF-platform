import { useEffect, useMemo, useRef, useState } from "react";
import { getGeoBounds, resolveChallengePoint } from "../lib/map";

const CATEGORY_COLORS = {
  web: "#6f42c1",
  crypto: "#0d6efd",
  pwn: "#dc3545",
  forensics: "#198754",
  reverse: "#fd7e14",
  reversing: "#fd7e14",
  binary: "#a855f7",
  misc: "#20c997",
  radio: "#0dcaf0",
  osint: "#6610f2",
  hardware: "#6c757d"
};

const MAP_IMAGE = {
  width: 1280,
  height: 905,
  contentBox: {
    left: 51,
    top: 101,
    width: 1173,
    height: 766
  }
};

const WORLD = {
  width: 1800,
  height: 1120,
  mapFrame: {
    left: 300,
    top: 110,
    width: 1200,
    height: 848
  }
};

const MAP_SOURCE = "/assets/estonia-admin-map.png";
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.2;
const ENABLE_COUNTY_INVISIBILITY = false;

const COUNTY_LABEL_POINTS = [
  { name: "Harju maakond", x: 575, y: 270 },
  { name: "Hiiu maakond", x: 145, y: 390 },
  { name: "Ida-Viru maakond", x: 1085, y: 265 },
  { name: "Järva maakond", x: 770, y: 385 },
  { name: "Jõgeva maakond", x: 925, y: 425 },
  { name: "Lääne maakond", x: 395, y: 400 },
  { name: "Lääne-Viru maakond", x: 865, y: 265 },
  { name: "Pärnu maakond", x: 570, y: 535 },
  { name: "Põlva maakond", x: 1040, y: 670 },
  { name: "Rapla maakond", x: 585, y: 390 },
  { name: "Saare maakond", x: 175, y: 565 },
  { name: "Tartu maakond", x: 930, y: 560 },
  { name: "Valga maakond", x: 860, y: 735 },
  { name: "Viljandi maakond", x: 730, y: 585 },
  { name: "Võru maakond", x: 1010, y: 805 }
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isNearBlack(r, g, b) {
  return r + g + b < 70;
}

function sampleCountyColor(ctx, x, y) {
  const radius = 3;
  const counts = new Map();

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const sx = clamp(Math.round(x + dx), 0, MAP_IMAGE.width - 1);
      const sy = clamp(Math.round(y + dy), 0, MAP_IMAGE.height - 1);
      const [r, g, b, a] = ctx.getImageData(sx, sy, 1, 1).data;
      if (a < 180 || isNearBlack(r, g, b)) continue;
      const key = `${r},${g},${b}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  let picked = null;
  let bestCount = 0;
  counts.forEach((count, key) => {
    if (count > bestCount) {
      bestCount = count;
      picked = key;
    }
  });

  return picked;
}

export default function MapBoard({ geoJson, challenges, selectedId, onSelect }) {
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const mapCanvasRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hiddenCountyCount, setHiddenCountyCount] = useState(0);
  const [countyLabels, setCountyLabels] = useState([]);

  const bounds = useMemo(() => getGeoBounds(geoJson), [geoJson]);

  const markers = useMemo(() => {
    if (!geoJson || !bounds) return [];

    return challenges.map((challenge) => {
      const marker = resolveChallengePoint(
        challenge,
        geoJson,
        bounds,
        MAP_IMAGE.contentBox.width,
        MAP_IMAGE.contentBox.height
      );

      return {
        ...challenge,
        marker,
        leftPercent: ((MAP_IMAGE.contentBox.left + marker.x) / MAP_IMAGE.width) * 100,
        topPercent: ((MAP_IMAGE.contentBox.top + marker.y) / MAP_IMAGE.height) * 100
      };
    });
  }, [geoJson, bounds, challenges]);

  const countyAnchors = useMemo(() => COUNTY_LABEL_POINTS.map((county) => ({
    ...county,
    leftPercent: (county.x / MAP_IMAGE.width) * 100,
    topPercent: (county.y / MAP_IMAGE.height) * 100
  })), []);

  function centerViewport(behavior = "smooth") {
    const frame = frameRef.current;
    if (!frame) return;

    frame.scrollTo({
      left: Math.max(0, (WORLD.width - frame.clientWidth) / 2),
      top: Math.max(0, (WORLD.height - frame.clientHeight) / 2 - 30),
      behavior
    });
  }

  function applyZoom(nextZoom, focusClientPoint) {
    const frame = frameRef.current;
    if (!frame) {
      setZoom(nextZoom);
      return;
    }

    const rect = frame.getBoundingClientRect();
    const focusX = focusClientPoint ? (focusClientPoint.x - rect.left) : frame.clientWidth / 2;
    const focusY = focusClientPoint ? (focusClientPoint.y - rect.top) : frame.clientHeight / 2;
    const worldX = (frame.scrollLeft + focusX) / zoom;
    const worldY = (frame.scrollTop + focusY) / zoom;

    setZoom(nextZoom);

    requestAnimationFrame(() => {
      frame.scrollLeft = clamp(worldX * nextZoom - focusX, 0, WORLD.width * nextZoom - frame.clientWidth);
      frame.scrollTop = clamp(worldY * nextZoom - focusY, 0, WORLD.height * nextZoom - frame.clientHeight);
    });
  }

  function handleZoom(direction, focusClientPoint) {
    const nextZoom = direction === "in"
      ? Math.min(zoom + ZOOM_STEP, ZOOM_MAX)
      : Math.max(zoom - ZOOM_STEP, ZOOM_MIN);

    if (nextZoom === zoom) return;
    applyZoom(nextZoom, focusClientPoint);
  }

  function handleWheel(event) {
    event.preventDefault();
    handleZoom(event.deltaY < 0 ? "in" : "out", { x: event.clientX, y: event.clientY });
  }

  useEffect(() => {
    centerViewport("auto");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const canvas = mapCanvasRef.current;
    if (!canvas) return undefined;

    const image = new Image();
    image.src = MAP_SOURCE;

    image.onload = () => {
      if (cancelled || !mapCanvasRef.current) return;

      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = MAP_IMAGE.width;
      sourceCanvas.height = MAP_IMAGE.height;
      const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
      if (!sourceCtx) return;

      sourceCtx.drawImage(image, 0, 0, MAP_IMAGE.width, MAP_IMAGE.height);

      const countyStats = new Map();
      markers.forEach((challenge) => {
        const px = MAP_IMAGE.contentBox.left + challenge.marker.x;
        const py = MAP_IMAGE.contentBox.top + challenge.marker.y;
        const countyColor = sampleCountyColor(sourceCtx, px, py);
        if (!countyColor) return;

        const stats = countyStats.get(countyColor) || { total: 0, solved: 0 };
        stats.total += 1;
        if (challenge.solved) stats.solved += 1;
        countyStats.set(countyColor, stats);
      });

      const hiddenCounties = new Set(
        Array.from(countyStats.entries())
          .filter(([, stats]) => stats.total > 0 && stats.total === stats.solved)
          .map(([countyColor]) => countyColor)
      );

      const activeHiddenCounties = ENABLE_COUNTY_INVISIBILITY ? hiddenCounties : new Set();

      const labels = countyAnchors
        .map((county) => {
          const countyColor = sampleCountyColor(sourceCtx, county.x, county.y);
          if (!countyColor) {
            return {
              ...county,
              countyColor: null,
              hidden: false
            };
          }

          return {
            ...county,
            countyColor,
            hidden: activeHiddenCounties.has(countyColor)
          };
        })
        .filter(Boolean);

      const outCtx = mapCanvasRef.current.getContext("2d");
      if (!outCtx) return;

      const imageData = sourceCtx.getImageData(0, 0, MAP_IMAGE.width, MAP_IMAGE.height);
      const pixels = imageData.data;
      if (ENABLE_COUNTY_INVISIBILITY) {
        for (let i = 0; i < pixels.length; i += 4) {
          const key = `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`;
          if (activeHiddenCounties.has(key)) {
            pixels[i + 3] = 0;
          }
        }
      }

      outCtx.clearRect(0, 0, MAP_IMAGE.width, MAP_IMAGE.height);
      outCtx.putImageData(imageData, 0, 0);
      setHiddenCountyCount(activeHiddenCounties.size);
      setCountyLabels(labels);
    };

    image.onerror = () => {
      const fallbackCtx = mapCanvasRef.current?.getContext("2d");
      if (!fallbackCtx || cancelled) return;
      setHiddenCountyCount(0);
      setCountyLabels([]);
    };

    return () => {
      cancelled = true;
    };
  }, [markers, countyAnchors]);

  function handlePointerDown(event) {
    if (event.target.closest(".challenge-marker")) return;

    const frame = frameRef.current;
    if (!frame) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: frame.scrollLeft,
      scrollTop: frame.scrollTop
    };

    frame.setPointerCapture?.(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event) {
    const frame = frameRef.current;
    const dragState = dragRef.current;
    if (!frame || !dragState || dragState.pointerId !== event.pointerId) return;

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;

    frame.scrollLeft = dragState.scrollLeft - dx;
    frame.scrollTop = dragState.scrollTop - dy;
  }

  function endDragging(event) {
    const frame = frameRef.current;
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    frame?.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  }

  if (!geoJson) {
    return <div className="card border-0 shadow-sm"><div className="card-body">Loading Estonia map…</div></div>;
  }

  return (
    <div className="attack-map-shell card border-0 shadow-sm overflow-hidden">
      <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
        <div>
          <div className="small text-uppercase text-warning fw-semibold">Challenge view</div>
          <h2 className="h4 mb-0">Attack Map</h2>
        </div>
        <div className="small text-end text-white-50">
          <div>{challenges.length} available</div>
          <div>{challenges.filter((challenge) => challenge.solved).length} solved</div>
          <div>{hiddenCountyCount} counties cleared</div>
        </div>
      </div>

      <div className="attack-map-toolbar d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
        <div className="small text-secondary">
          Drag inside the map frame to move it independently from the page. Challenge markers still open the modal.
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => handleZoom("in")} title="Zoom in (scroll to focus)">
            +
          </button>
          <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => handleZoom("out")} title="Zoom out (scroll to focus)">
            −
          </button>
          <span className="btn btn-outline-dark btn-sm disabled">{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => centerViewport()}>
            Center map
          </button>
        </div>
      </div>

      <div
        ref={frameRef}
        className={`map-scroll-frame ${dragging ? "is-dragging" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDragging}
        onPointerCancel={endDragging}
        onWheel={handleWheel}
      >
        <div className="map-world" style={{ width: `${WORLD.width * zoom}px`, height: `${WORLD.height * zoom}px` }}>
          <div
            className="map-image-shell"
            style={{
              left: `${WORLD.mapFrame.left * zoom}px`,
              top: `${WORLD.mapFrame.top * zoom}px`,
              width: `${WORLD.mapFrame.width * zoom}px`,
              height: `${WORLD.mapFrame.height * zoom}px`
            }}
          >
            <canvas
              ref={mapCanvasRef}
              width={MAP_IMAGE.width}
              height={MAP_IMAGE.height}
              aria-label="Administrative map of Estonia"
              className="map-image"
            />

            <div className="county-label-layer" aria-hidden="true">
              {countyLabels.filter((county) => !county.hidden).map((county) => (
                <span
                  key={county.name}
                  className="county-name-chip"
                  style={{
                    left: `${county.leftPercent}%`,
                    top: `${county.topPercent}%`
                  }}
                  title={county.name}
                >
                  {county.name}
                </span>
              ))}
            </div>

            <div className="markers-layer">
              {markers.map((challenge) => {
                const color = challenge.solved ? "#1cc24b" : (CATEGORY_COLORS[challenge.category] || "#0d6efd");
                return (
                  <button
                    type="button"
                    key={challenge.id}
                    className={`challenge-marker ${selectedId === challenge.id ? "is-selected" : ""} ${challenge.solved ? "is-solved" : ""}`}
                    style={{
                      left: `${challenge.leftPercent}%`,
                      top: `${challenge.topPercent}%`,
                      "--marker-color": color
                    }}
                    onClick={() => onSelect(challenge)}
                    title={`${challenge.title} (${challenge.points} pts)`}
                  >
                    <span className="marker-dot" />
                    <span className="marker-label">{challenge.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
