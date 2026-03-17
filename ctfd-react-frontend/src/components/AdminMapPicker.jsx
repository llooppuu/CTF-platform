import { useMemo, useRef, useState } from "react";
import { getGeoBounds, projectPoint, unprojectPoint } from "../lib/map";

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

const CATEGORY_COLORS = {
  web: "#6f42c1",
  crypto: "#0d6efd",
  pwn: "#dc3545",
  forensics: "#198754",
  reversing: "#fd7e14",
  misc: "#20c997",
  radio: "#0dcaf0",
  osint: "#6610f2",
  hardware: "#6c757d"
};

export default function AdminMapPicker({
  geoJson,
  challenges,
  selectedId,
  currentCoords,
  locked,
  onPick
}) {
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef(null);
  const shellRef = useRef(null);
  const bounds = useMemo(() => getGeoBounds(geoJson), [geoJson]);

  const markers = useMemo(() => {
    if (!bounds) return [];
    return challenges
      .filter((challenge) => Number.isFinite(Number(challenge.lat)) && Number.isFinite(Number(challenge.lng)))
      .map((challenge) => {
        const point = projectPoint(
          { lat: Number(challenge.lat), lng: Number(challenge.lng) },
          bounds,
          MAP_IMAGE.contentBox.width,
          MAP_IMAGE.contentBox.height
        );

        return {
          ...challenge,
          leftPercent: ((MAP_IMAGE.contentBox.left + point.x) / MAP_IMAGE.width) * 100,
          topPercent: ((MAP_IMAGE.contentBox.top + point.y) / MAP_IMAGE.height) * 100
        };
      });
  }, [bounds, challenges]);

  function toMapCoords(event) {
    const shell = shellRef.current;
    if (!shell) return null;
    const rect = shell.getBoundingClientRect();
    const localX = (event.clientX - rect.left) / zoom;
    const localY = (event.clientY - rect.top) / zoom;

    const x = localX - MAP_IMAGE.contentBox.left;
    const y = localY - MAP_IMAGE.contentBox.top;

    if (x < 0 || y < 0 || x > MAP_IMAGE.contentBox.width || y > MAP_IMAGE.contentBox.height) {
      return null;
    }

    return { x, y };
  }

  function pickFromClick(event) {
    if (!bounds || locked) return;
    const xy = toMapCoords(event);
    if (!xy) return;

    const coords = unprojectPoint(xy, bounds, MAP_IMAGE.contentBox.width, MAP_IMAGE.contentBox.height);
    onPick({
      lat: Number(coords.lat.toFixed(6)),
      lng: Number(coords.lng.toFixed(6))
    });
  }

  function startDragging(event) {
    if (locked || !bounds || !selectedMarker) return;
    const startedOnMarker = event.target.closest(".admin-map-cursor-marker");
    if (!startedOnMarker) return;
    dragRef.current = event.pointerId;
    shellRef.current?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function dragMarker(event) {
    if (dragRef.current !== event.pointerId || locked || !bounds) return;
    const xy = toMapCoords(event);
    if (!xy) return;
    const coords = unprojectPoint(xy, bounds, MAP_IMAGE.contentBox.width, MAP_IMAGE.contentBox.height);
    onPick({
      lat: Number(coords.lat.toFixed(6)),
      lng: Number(coords.lng.toFixed(6))
    });
  }

  function stopDragging(event) {
    if (dragRef.current !== event.pointerId) return;
    shellRef.current?.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
  }

  const selectedMarker = useMemo(() => {
    if (!bounds || !currentCoords) return null;
    const lat = Number(currentCoords.lat);
    const lng = Number(currentCoords.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const point = projectPoint({ lat, lng }, bounds, MAP_IMAGE.contentBox.width, MAP_IMAGE.contentBox.height);
    return {
      leftPercent: ((MAP_IMAGE.contentBox.left + point.x) / MAP_IMAGE.width) * 100,
      topPercent: ((MAP_IMAGE.contentBox.top + point.y) / MAP_IMAGE.height) * 100
    };
  }, [bounds, currentCoords]);

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <div className="small text-uppercase text-warning fw-semibold">Map placement</div>
          <strong>{locked ? "Marker locked" : "Click or drag marker to set coordinates"}</strong>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => setZoom((old) => Math.min(3, old + 0.2))}>+</button>
          <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => setZoom((old) => Math.max(1, old - 0.2))}>-</button>
          <span className="btn btn-outline-dark btn-sm disabled">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
      <div className="card-body">
        <div className="admin-map-scroll">
          <div
            ref={shellRef}
            className="admin-map-shell"
            role="button"
            tabIndex={0}
            onClick={pickFromClick}
            onPointerDown={startDragging}
            onPointerMove={dragMarker}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onWheel={(event) => {
              event.preventDefault();
              setZoom((old) => {
                const delta = event.deltaY < 0 ? 0.15 : -0.15;
                return Math.max(1, Math.min(3, Number((old + delta).toFixed(2))));
              });
            }}
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          >
            <img src="/assets/estonia-admin-map.png" alt="Estonia map" className="admin-map-image" draggable="false" />
            <div className="admin-markers-layer">
              {markers.map((challenge) => (
                <span
                  key={challenge.id}
                  className={`admin-map-marker ${challenge.id === selectedId ? "is-selected" : ""}`}
                  style={{
                    left: `${challenge.leftPercent}%`,
                    top: `${challenge.topPercent}%`,
                    "--marker-color": CATEGORY_COLORS[challenge.category] || "#0d6efd"
                  }}
                  title={`${challenge.title} (${challenge.lat}, ${challenge.lng})`}
                />
              ))}

              {selectedMarker ? (
                <button
                  type="button"
                  className={`admin-map-cursor-marker ${locked ? "is-locked" : ""}`}
                  style={{
                    left: `${selectedMarker.leftPercent}%`,
                    top: `${selectedMarker.topPercent}%`
                  }}
                  title={locked ? "Marker is locked" : "Drag me"}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
