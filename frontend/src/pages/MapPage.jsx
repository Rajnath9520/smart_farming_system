import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Layers, Maximize2, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { farmAPI } from '../services/api';
import { Card, Button, SectionHeader } from '../components/ui';
import toast from 'react-hot-toast';


const MAP_ID = 'irrigation-map';

export default function MapPage() {
  const { dbUser, refreshDbUser } = useAuth();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const polygonRef = useRef(null);
  const [farmArea, setFarmArea] = useState(null);
  const [boundary, setBoundary] = useState([]);
  const [drawMode, setDrawMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const farm = dbUser?.farms?.[dbUser?.activeFarmIndex || 0];
  const coords = farm?.location?.coordinates;
  const lat = coords?.[1] || 20.5937;
  const lon = coords?.[0] || 78.9629;

  useEffect(() => {
    if (mapInstanceRef.current) return;


    const initMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(MAP_ID, { zoomControl: true }).setView([lat, lon], 14);

      // Satellite + street layers
      const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      });
      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri' }
      );

      street.addTo(map);


      //this is not complete at this time