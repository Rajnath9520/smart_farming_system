import { useEffect, useRef } from "react";

export default function FarmBoundaryMap({ onBoundaryChange, initialHint }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const drawnItems = useRef(null);

  useEffect(() => {
    let map;

    const init = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      await import("leaflet-draw/dist/leaflet.draw.css");
      await import("leaflet-draw");

      if (!mapRef.current || mapInstance.current) return;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      map = L.map(mapRef.current, {
        zoomControl: true,
        // ✅ Prevent map drag interfering with drawing
        tap: true,
      }).setView([21.25, 81.6], 13);
      mapInstance.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const items = new L.FeatureGroup();
      drawnItems.current = items;
      map.addLayer(items);

      // ✅ KEY FIX: Patch the Polygon handler's _finishShape to block finish < 4 points
      const OriginalPolygon = L.Draw.Polygon;
      L.Draw.Polygon = OriginalPolygon.extend({
        _finishShape() {
          const pointCount = this._markers ? this._markers.length : 0;
          if (pointCount < 4) {
            // Show a tooltip hint instead of closing
            if (this._tooltip) {
              this._tooltip.updateContent({
                text: `Add ${4 - pointCount} more point${4 - pointCount !== 1 ? "s" : ""} to finish`,
              });
            }
            return; // Block closing
          }
          OriginalPolygon.prototype._finishShape.call(this);
        },
      });

      const drawControl = new L.Control.Draw({
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: false,
            shapeOptions: {
              color: "#059669",
              fillColor: "#10B981",
              fillOpacity: 0.2,
              weight: 2,
            },
            // Guide tooltip shown while drawing
            drawError: {
              color: "#e1e100",
              message: "<strong>Error:</strong> Shape edges cannot cross!",
            },
            metric: true,
          },
          rectangle:    false,
          circle:       false,
          circlemarker: false,
          marker:       false,
          polyline:     false,
        },
        edit: { featureGroup: items },
      });
      map.addControl(drawControl);

      // ✅ Disable drag while drawing so map doesn't pan on click
      map.on(L.Draw.Event.DRAWSTART, () => {
        map.dragging.disable();
        map.doubleClickZoom.disable();
      });

      map.on(L.Draw.Event.DRAWSTOP, () => {
        map.dragging.enable();
        map.doubleClickZoom.enable();
        // Restore original so subsequent draws work
        L.Draw.Polygon = OriginalPolygon;
      });

      map.on(L.Draw.Event.CREATED, (e) => {
        items.clearLayers();
        items.addLayer(e.layer);
        const latlngs = e.layer.getLatLngs()[0];
        const boundary = latlngs.map((p) => [p.lng, p.lat]);
        boundary.push(boundary[0]); // close polygon
        onBoundaryChange(boundary);
      });

      map.on(L.Draw.Event.DELETED, () => {
        onBoundaryChange([]);
      });

      setTimeout(() => map.invalidateSize(), 200);
    };

    init();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div style={{ position: "relative", height: "380px", width: "100%" }}>
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}