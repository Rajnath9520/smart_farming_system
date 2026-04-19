

import { useEffect, useRef } from "react";

/**
 * Props
 * -----
 * @param {[number,number]}     center      [lng, lat] – farm location point
 * @param {[number,number][][]} boundary    GeoJSON Polygon coordinates (first ring used)
 * @param {string}              farmName
 * @param {string}              address
 * @param {number}              area        acres
 */
export function FarmMap({ center, boundary, farmName, address, area }) {
  const mapRef  = useRef(null);   // DOM node
  const leafRef = useRef(null);   // Leaflet map instance

  useEffect(() => {
    // Leaflet requires a browser environment
    if (typeof window === "undefined" || !mapRef.current) return;

    // ── Load Leaflet CSS once ────────────────────────────────────────────────
    if (!document.getElementById("leaflet-css")) {
      const link  = document.createElement("link");
      link.id     = "leaflet-css";
      link.rel    = "stylesheet";
      link.href   = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // ── Load Leaflet JS then init map ────────────────────────────────────────
    const initMap = (L) => {
      if (leafRef.current) return; // already mounted

      // GeoJSON uses [lng, lat] but Leaflet wants [lat, lng]
      const toLL  = ([lng, lat]) => [lat, lng];
      const latlng = center ? toLL(center) : [21.98333, 82.23333];

      const map = L.map(mapRef.current, {
        center:           latlng,
        zoom:             14,
        zoomControl:      true,
        attributionControl: false,
        scrollWheelZoom:  false,   // nicer UX inside a card
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // ── Farm boundary polygon ──────────────────────────────────────────────
      const ring = boundary?.[0];
      if (ring && ring.length >= 3) {
        const coords = ring.map(toLL);

        const poly = L.polygon(coords, {
          color:       "#10B981",
          weight:      2.5,
          opacity:     0.95,
          fillColor:   "#10B981",
          fillOpacity: 0.18,
          dashArray:   "0",
          lineJoin:    "round",
        }).addTo(map);

        map.fitBounds(poly.getBounds(), { padding: [32, 32] });
      }

      // ── Center marker ──────────────────────────────────────────────────────
      if (center) {
        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width:36px;height:36px;border-radius:50%;
              background:rgba(16,185,129,0.15);
              border:2.5px solid #10B981;
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 0 0 6px rgba(16,185,129,0.08);
            ">
              <div style="width:10px;height:10px;border-radius:50%;background:#10B981;"></div>
            </div>`,
          iconSize:   [36, 36],
          iconAnchor: [18, 18],
        });

        L.marker(toLL(center), { icon })
          .addTo(map)
          .bindPopup(
            `<b style="color:#059669">${farmName || "Farm"}</b><br/>
             <span style="font-size:11px;color:#6B7280">${address || ""}</span>`,
            { offset: [0, -10] }
          );
      }

      leafRef.current = map;
    };

    // If Leaflet is already on window (e.g. React hot-reload) use it directly
    if (window.L) {
      initMap(window.L);
      return;
    }

    const script   = document.createElement("script");
    script.src     = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async   = true;
    script.onload  = () => initMap(window.L);
    document.head.appendChild(script);

    return () => {
      if (leafRef.current) {
        leafRef.current.remove();
        leafRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If center / boundary change after first mount, fly to new position
  useEffect(() => {
    const map  = leafRef.current;
    if (!map || !center) return;
    map.flyTo([center[1], center[0]], 14, { duration: 1.2 });
  }, [center]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "100%", minHeight: "320px", borderRadius: "inherit" }}
    />
  );
}