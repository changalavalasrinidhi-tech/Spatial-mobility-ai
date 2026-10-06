import React from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapView({ floodData, center }) {
  return (
    <div style={{ flex: 1, height: '100%' }}>
      <MapContainer center={[center.lat, center.lon]} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {floodData && (
          <GeoJSON 
            data={floodData} 
            style={{ fillColor: '#00E5FF', color: '#00E5FF', weight: 1.5, fillOpacity: 0.5 }} 
          />
        )}
      </MapContainer>
    </div>
  );
}
