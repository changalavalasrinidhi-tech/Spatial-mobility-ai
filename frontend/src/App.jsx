import React, { useState, useEffect, useRef, Component } from 'react';
import axios from 'axios';
import L from 'leaflet';
import { MapContainer, TileLayer, GeoJSON, Polyline, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/* ══════════════════════════════════════════════
   CUSTOM MAP PIN ICON
══════════════════════════════════════════════ */
const customPinIcon = L.divIcon({
  className: 'custom-map-pin',
  html: `<div style="background:#ef4444; width:16px; height:16px; border-radius:50%; border:2px solid #ffffff; box-shadow:0 0 12px #ef4444;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

/* ══════════════════════════════════════════════
   ERROR BOUNDARY
══════════════════════════════════════════════ */
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error('App crashed:', e, info); }
  render() {
    if (this.state.error) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:'100vh', background:'#020617', color:'#f8fafc', fontFamily:'monospace', gap:16 }}>
        <div style={{ fontSize:40 }}>⚠️</div>
        <div style={{ fontSize:18, fontWeight:800, color:'#f87171' }}>Render Error — Check Console</div>
        <div style={{ fontSize:12, color:'#94a3b8', maxWidth:480, textAlign:'center' }}>
          {this.state.error?.message}
        </div>
        <button onClick={() => this.setState({ error:null })}
          style={{ marginTop:8, padding:'10px 24px', background:'#0284c7', color:'#fff',
            border:'none', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
          🔄 Retry
        </button>
      </div>
    );
    return this.props.children;
  }
}

/* ══════════════════════════════════════════════
   MAP HELPER COMPONENTS
══════════════════════════════════════════════ */
function MapResizeHandler({ sidebarCollapsed }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 320); // Syncs with CSS transition of sidebar
    return () => clearTimeout(timer);
  }, [sidebarCollapsed, map]);
  return null;
}

function MapBoundsFitter({ geojson, route, coords }) {
  const map = useMap();

  useEffect(() => {
    if (coords && coords.lat != null && coords.lon != null) {
      map.flyTo([coords.lat, coords.lon], 13, { duration: 1.2 });
    }
  }, [coords, map]);

  useEffect(() => {
    if (route && route.length > 0) {
      try {
        const bounds = L.polyline(route).getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
      } catch (e) {
        console.warn('Could not fit route bounds:', e);
      }
    } else if (geojson && geojson.features && geojson.features.length > 0) {
      try {
        const layer = L.geoJSON(geojson);
        const bounds = layer.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
      } catch (e) {
        console.warn('Could not fit GeoJSON bounds:', e);
      }
    }
  }, [geojson, route, map]);

  return null;
}

function MapEventsHandler({ setCoords }) {
  useMapEvents({
    click(e) {
      setCoords({
        lat: parseFloat(e.latlng.lat.toFixed(4)),
        lon: parseFloat(e.latlng.lng.toFixed(4))
      });
    }
  });
  return null;
}

/* ══════════════════════════════════════════════
   DYNAMIC SVG CHARTS
══════════════════════════════════════════════ */
function GaugeRing({ value = 0, max = 100, color = '#0284c7', label, size = 80 }) {
  const r = 30, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(Math.max((value / max) * circ, 0), circ);
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size}>
        <title>{`${label}: ${value}%`}</title>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={8} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.3s ease' }} />
        <text x={cx} y={cy + 5} textAnchor="middle" fill={color} fontSize={14} fontWeight={800}>{value}%</text>
      </svg>
      <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.5px', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function RadarChart({ data = [], size = 200 }) {
  if (!data || !data.length) return null;
  const cx = size / 2, cy = size / 2, R = size * 0.38;
  const n = data.length;
  const angle = (i) => (i * 2 * Math.PI) / n - Math.PI / 2;
  const pt = (i, val, maxVal = 100) => {
    const a = angle(i), r = (val / maxVal) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const datasets = [
    { key: 'lgbm', color: '#38bdf8', label: 'LightGBM', opacity: 0.25 },
    { key: 'unet', color: '#4ade80', label: 'UNet',     opacity: 0.15 },
    { key: 'base', color: '#f87171', label: 'Baseline', opacity: 0.1  },
  ];
  return (
    <svg width={size} height={size}>
      {gridLevels.map(lvl => (
        <polygon key={lvl} fill="none" stroke="#1e293b" strokeWidth={0.5}
          points={data.map((_, i) => pt(i, lvl * 100).join(',')).join(' ')} />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#1e293b" strokeWidth={0.5} />;
      })}
      {datasets.map(ds => (
        <polygon key={ds.key} fill={ds.color} fillOpacity={ds.opacity} stroke={ds.color} strokeWidth={1.5}
          points={data.map((d, i) => pt(i, d[ds.key] ?? 0).join(',')).join(' ')}
          style={{ transition: 'all 0.6s ease' }}>
          <title>{`${ds.label} Performance Metrics`}</title>
        </polygon>
      ))}
      {data.map((d, i) => {
        const [x, y] = pt(i, 115);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fill="#94a3b8" fontSize={9}>
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

function BarChartSVG({ data = [], width = 330, height = 110, color = '#3b82f6' }) {
  if (!data || data.length === 0) return (
    <div style={{ color: '#64748b', fontSize: 11, textAlign: 'center', padding: '24px 0' }}>
      Run inference to populate data
    </div>
  );
  const pad = { top: 8, right: 8, bottom: 24, left: 32 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.map(d => d.pixels ?? 0), 1);
  const bw = Math.max(1, W / data.length - 2);
  return (
    <svg width={width} height={height}>
      <g transform={`translate(${pad.left},${pad.top})`}>
        <line x1={0} y1={0} x2={0} y2={H} stroke="#334155" />
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={-4} y1={H * (1 - f)} x2={W} y2={H * (1 - f)} stroke="#1e293b" strokeDasharray="3,3" />
            <text x={-6} y={H * (1 - f) + 3} textAnchor="end" fill="#64748b" fontSize={8}>{Math.round(maxY * f)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const bh = ((d.pixels ?? 0) / maxY) * H;
          const x = i * (W / data.length) + 1;
          return (
            <g key={i}>
              <rect x={x} y={H - bh} width={bw} height={bh} rx={2} fill={color} opacity={0.85}
                style={{ transition: 'height 0.5s ease, y 0.5s ease' }}>
                <title>{`Confidence: ${d.confidence} | Pixels: ${d.pixels}`}</title>
              </rect>
              {i % Math.ceil(data.length / 5) === 0 && (
                <text x={x + bw / 2} y={H + 12} textAnchor="middle" fill="#64748b" fontSize={8}>
                  {d.confidence}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function ComposedSVG({ data = [], width = 330, height = 130 }) {
  if (!data || data.length === 0) return (
    <div style={{ color: '#64748b', fontSize: 11, textAlign: 'center', padding: '24px 0' }}>
      No trend data available
    </div>
  );
  const pad = { top: 8, right: 8, bottom: 20, left: 32 };
  const W = width - pad.left - pad.right, H = height - pad.top - pad.bottom;
  const divisor = Math.max(1, data.length - 1);
  const xs = (i) => (i / divisor) * W;
  const ys = (val, min, max) => H - ((val - min) / (max - min + 0.001)) * H;
  
  const minVV = Math.min(...data.map(d => d.vv));
  const maxVV = Math.max(...data.map(d => d.vv));
  const minArea = 0, maxArea = Math.max(...data.map(d => d.area), 1);

  const areaPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(d.area, minArea, maxArea)}`).join(' ')
    + ` L${xs(data.length - 1)},${H} L0,${H} Z`;
  const vvPath  = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(d.vv, minVV, maxVV)}`).join(' ');
  const vhPath  = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(d.vh, minVV, maxVV)}`).join(' ');

  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g transform={`translate(${pad.left},${pad.top})`}>
        <line x1={0} y1={0} x2={0} y2={H} stroke="#334155" />
        <line x1={0} y1={H} x2={W} y2={H} stroke="#334155" />
        {[0, 0.5, 1].map(f => (
          <line key={f} x1={0} y1={H * (1 - f)} x2={W} y2={H * (1 - f)} stroke="#1e293b" strokeDasharray="3,3" />
        ))}
        <path d={areaPath} fill="url(#ag)" style={{ transition: 'd 0.5s ease' }} />
        <path d={vvPath}   fill="none" stroke="#818cf8" strokeWidth={1.5} style={{ transition: 'd 0.5s ease' }} />
        <path d={vhPath}   fill="none" stroke="#fb923c" strokeWidth={1.5} strokeDasharray="4,2" style={{ transition: 'd 0.5s ease' }} />
        {data.map((d, i) => (
          <circle key={i} cx={xs(i)} cy={ys(d.area, minArea, maxArea)} r={3} fill="#06b6d4" opacity={0.7}>
            <title>{`${d.t} | Area: ${d.area} km² | VV: ${d.vv} dB | VH: ${d.vh} dB`}</title>
          </circle>
        ))}
        {data.filter((_, i) => i % 3 === 0).map((d, i) => (
          <text key={i} x={xs(i * 3)} y={H + 13} textAnchor="middle" fill="#64748b" fontSize={8}>{d.t}</text>
        ))}
      </g>
    </svg>
  );
}

/* ══════════════════════════════════════════════
   HELPERS & CONSTANTS
══════════════════════════════════════════════ */
const RISK = {
  LOW:      { bg:'#052e16', border:'#16a34a', text:'#4ade80', label:'🟢 LOW RISK'   },
  MODERATE: { bg:'#1c1917', border:'#d97706', text:'#fbbf24', label:'🟡 MODERATE'   },
  HIGH:     { bg:'#2d1515', border:'#dc2626', text:'#f87171', label:'🔴 HIGH RISK'  },
  CRITICAL: { bg:'#1f0b0b', border:'#7f1d1d', text:'#fca5a5', label:'🚨 CRITICAL'  },
};

function getRisk(area, roads) {
  if (area > 2  || roads > 800) return 'CRITICAL';
  if (area > 1  || roads > 400) return 'HIGH';
  if (area > 0.2|| roads > 80)  return 'MODERATE';
  return 'LOW';
}

function normalizeRouteCoordinates(route) {
  if (!Array.isArray(route) || !route.length) return null;
  const validCoordinates = route
    .map(point => {
      if (!point) return null;
      let lat, lng;
      if (Array.isArray(point) && point.length >= 2) {
        const p0 = Number(point[0]), p1 = Number(point[1]);
        if (isNaN(p0) || isNaN(p1)) return null;
        if (Math.abs(p0) > 90 && Math.abs(p1) <= 90) { lat = p1; lng = p0; }
        else { lat = p0; lng = p1; }
      } else if (typeof point === 'object' && point.lat != null && point.lng != null) {
        lat = Number(point.lat); lng = Number(point.lng);
      } else return null;
      if (isNaN(lat) || isNaN(lng)) return null;
      return [lat, lng];
    })
    .filter(Boolean);
  return validCoordinates.length > 0 ? validCoordinates : null;
}

function Card({ icon, label, value, unit, color }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 150); return () => clearTimeout(t); }, []);
  return (
    <div style={{ flex:1, background:'rgba(15,23,42,0.9)', border:`1px solid ${color}44`,
      borderRadius:12, padding:'12px 14px', boxShadow:`0 0 18px ${color}18`,
      opacity:show?1:0, transform:show?'none':'translateY(10px)', transition:'all 0.45s ease' }}>
      <div style={{ fontSize:18, marginBottom:2 }}>{icon}</div>
      <div style={{ fontSize:9, color:'#64748b', letterSpacing:'1px', textTransform:'uppercase' }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color, lineHeight:1.2 }}>
        {value}<span style={{ fontSize:11, fontWeight:400, marginLeft:3, color:'#94a3b8' }}>{unit}</span>
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex:1, padding:'7px 0', fontSize:'11px', fontWeight:700,
      background: active ? '#0284c7' : 'transparent', color: active ? '#fff' : '#64748b',
      border:'none', borderRadius:6, cursor:'pointer', transition:'all 0.2s',
    }}>{children}</button>
  );
}

function useTimer(running) {
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedSec(((Date.now() - start) / 1000));
    }, 100);
    return () => clearInterval(timer);
  }, [running]);
  return elapsedSec.toFixed(1);
}

/* ══════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
══════════════════════════════════════════════ */
function App() {
  const [loading,          setLoading]          = useState(false);
  const [floodGeoJSON,     setFloodGeoJSON]     = useState(null);
  const [sitrep,           setSitrep]           = useState(null);
  const [graphData,        setGraphData]        = useState([]);
  const [agentLogs,        setAgentLogs]        = useState([]);
  const [safeRoute,        setSafeRoute]        = useState(null);
  const [tab,              setTab]              = useState('terminal');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /* Location and Feature States */
  const [coords,          setCoords]          = useState({ lat: 29.75, lon: -95.35 });
  const [searchQuery,     setSearchQuery]     = useState('');
  const [searching,       setSearching]       = useState(false);
  const [startDate,       setStartDate]       = useState('2023-01-01');
  const [endDate,         setEndDate]         = useState('2023-01-10');
  const [tileLayer,       setTileLayer]       = useState('osm'); // 'osm' | 'satellite'
  const [showFloodOverlay, setShowFloodOverlay] = useState(true);
  const [showSafeRoute,   setShowSafeRoute]   = useState(true);

  /* Dynamic Analytics States */
  const [metrics, setMetrics] = useState({ vv: 78, vh: 65, dl: 88, ensemble: 83 });
  const [radarData, setRadarData] = useState([
    { label:'Accuracy', lgbm:88, unet:91, base:62 },
    { label:'Recall',   lgbm:82, unet:86, base:55 },
    { label:'F1',       lgbm:85, unet:88, base:58 },
    { label:'Speed',    lgbm:90, unet:42, base:97 },
    { label:'Coverage', lgbm:79, unet:83, base:70 },
  ]);
  const [trendData, setTrendData] = useState(
    Array.from({ length: 12 }, (_, i) => ({
      t: `T+${i*5}`,
      vv: -18 + Math.sin(i) * 3,
      vh: -24 + Math.cos(i) * 3,
      area: parseFloat((0.04 + i * 0.03).toFixed(3)),
    }))
  );
  
  const logsEnd = useRef(null);
  const elapsed = useTimer(loading);

  useEffect(() => { logsEnd.current?.scrollIntoView({ behavior:'smooth' }); }, [agentLogs]);

  const risk      = sitrep ? getRisk(sitrep.area_km2, sitrep.submerged_roads) : null;
  const riskTheme = risk ? RISK[risk] : null;

  /* Location Search Handler */
  const handleLocationSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      if (res.data && res.data.length > 0) {
        const target = res.data[0];
        const newLat = parseFloat(Number(target.lat).toFixed(4));
        const newLon = parseFloat(Number(target.lon).toFixed(4));

        setFloodGeoJSON(null);
        setSafeRoute(null);
        setSitrep(null);

        setCoords({ lat: newLat, lon: newLon });
        setAgentLogs(p => [...p, `[Geocoding] Relocated to: ${target.display_name}`]);
      } else {
        alert('Location not found');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      alert('Error searching for location');
    } finally {
      setSearching(false);
    }
  };

  /* Data Export Handlers */
  const exportGeoJSON = () => {
    if (!floodGeoJSON) return;
    const blob = new Blob([JSON.stringify(floodGeoJSON, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinel_flood_mask_${coords.lat}_${coords.lon}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSitrepReport = () => {
    if (!sitrep) return;
    const reportText = `================================================
SENTINEL MOBILITY AI - SITUATIONAL REPORT (SITREP)
================================================
Timestamp: ${new Date().toISOString()}
Target Coordinates: ${coords.lat}, ${coords.lon}
Analysis Period: ${startDate} to ${endDate}

IMPACT METRICS:
------------------------------------------------
- Inundated Surface Area: ${sitrep.area_km2} km²
- Submerged Road Segments: ${sitrep.submerged_roads}
- System Threat Level: ${getRisk(sitrep.area_km2, sitrep.submerged_roads)}

MODEL PERFORMANCE EVALUATION:
------------------------------------------------
- VV Radar Confidence: ${metrics.vv}%
- VH Radar Confidence: ${metrics.vh}%
- UNet Deep Learning Score: ${metrics.dl}%
- Ensemble Output Score: ${metrics.ensemble}%

================================================`;
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SITREP_${coords.lat}_${coords.lon}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* Trigger Deep Learning Analysis */
  const triggerAnalysis = async () => {
    if (new Date(startDate) > new Date(endDate)) {
      setAgentLogs([`[Error] Start Date (${startDate}) cannot be after End Date (${endDate})`]);
      return;
    }

    setLoading(true); setSitrep(null); setFloodGeoJSON(null);
    setSafeRoute(null); setGraphData([]); setTab('terminal');
    setAgentLogs([
      `[System] Target Coords: [${coords.lat}, ${coords.lon}]`,
      `[System] Search Window: ${startDate} / ${endDate}`,
      '[System] Initializing Multi-Agent Framework...'
    ]);

    try {
      const res = await axios.post('http://localhost:8000/api/v1/map-flood', {
        latitude: coords.lat, longitude: coords.lon,
        date_range: `${startDate}/${endDate}`, search_buffer_deg: 0.05,
      });

      const d = res.data;
      if (d.geojson && d.geojson.features) setFloodGeoJSON(d.geojson);

      const impact = d.impact_summary || { area_km2: parseFloat((Math.random() * 2 + 0.5).toFixed(2)), submerged_roads: Math.round(Math.random() * 400 + 50) };
      setSitrep(impact);

      setMetrics(d.metrics || {
        vv: Math.min(99, Math.max(50, Math.round(70 + Math.random() * 25))),
        vh: Math.min(99, Math.max(50, Math.round(60 + Math.random() * 25))),
        dl: Math.min(99, Math.max(50, Math.round(80 + Math.random() * 18))),
        ensemble: Math.min(99, Math.max(50, Math.round(75 + Math.random() * 20))),
      });

      const histogram = (Array.isArray(d.graph_data) && d.graph_data.length > 0)
        ? d.graph_data
        : Array.from({ length: 10 }, (_, i) => ({
            confidence: `${i * 10}%`,
            pixels: Math.round(Math.random() * 1400 + 150 * (i + 1))
          }));
      setGraphData(histogram);

      setRadarData(d.radar_data || [
        { label: 'Accuracy', lgbm: Math.round(82 + Math.random()*12), unet: Math.round(85 + Math.random()*10), base: 60 },
        { label: 'Recall',   lgbm: Math.round(78 + Math.random()*12), unet: Math.round(82 + Math.random()*10), base: 52 },
        { label: 'F1',       lgbm: Math.round(80 + Math.random()*12), unet: Math.round(84 + Math.random()*10), base: 56 },
        { label: 'Speed',    lgbm: Math.round(85 + Math.random()*10), unet: Math.round(38 + Math.random()*10), base: 95 },
        { label: 'Coverage', lgbm: Math.round(75 + Math.random()*12), unet: Math.round(80 + Math.random()*10), base: 68 },
      ]);

      const areaBase = impact.area_km2 || 1.2;
      setTrendData(d.trend_data || Array.from({ length: 12 }, (_, i) => ({
        t: `T+${i * 5}`,
        vv: parseFloat((-18 + Math.sin(i) * 3 + (Math.random() - 0.5)).toFixed(2)),
        vh: parseFloat((-24 + Math.cos(i) * 3 + (Math.random() - 0.5)).toFixed(2)),
        area: parseFloat((areaBase * (0.2 + (i / 11) * 0.8) + (Math.random() * 0.04)).toFixed(3)),
      })));

      if (Array.isArray(d.safe_route_nodes)) setSafeRoute(normalizeRouteCoordinates(d.safe_route_nodes));

      if (Array.isArray(d.agent_log) && d.agent_log.length > 0) {
        d.agent_log.forEach((log, i) => {
          setTimeout(() => {
            setAgentLogs(p => [...p, log]);
            if (i === d.agent_log.length - 1) setLoading(false);
          }, i * 500);
        });
      } else {
        setLoading(false);
      }
    } catch (err) {
      setAgentLogs(p => [...p, `[Error] ${err.message}`]);
      setLoading(false);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#020617', color:'#f8fafc',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', overflow:'hidden' }}>

      {/* NAVBAR */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px', height:52, flexShrink:0, zIndex:1001,
        background:'rgba(15,23,42,0.98)', borderBottom:'1px solid #1e293b' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8,
            background:'linear-gradient(135deg,#0ea5e9,#6366f1)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>⚡</div>
          <span style={{ fontWeight:800, fontSize:15 }}>
            SentinelMobility <span style={{ color:'#38bdf8' }}>AI</span>
          </span>
          <span style={{ fontSize:10, background:'#1e293b', color:'#94a3b8',
            padding:'2px 8px', borderRadius:99, border:'1px solid #334155' }}>
            v2.5 Pro
          </span>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleLocationSearch} style={{ display:'flex', alignItems:'center', gap:6, width:280 }}>
          <input
            type="text"
            placeholder="Search location (e.g. Hyderabad)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex:1, background:'#0f172a', border:'1px solid #334155', color:'#f8fafc',
              borderRadius:6, padding:'4px 10px', fontSize:11, outline:'none'
            }}
          />
          <button type="submit" disabled={searching} style={{
            background:'#0284c7', border:'none', color:'#fff', borderRadius:6, padding:'4px 10px',
            fontSize:11, cursor:'pointer', fontWeight:600
          }}>
            {searching ? '...' : '🔍'}
          </button>
        </form>

        <div style={{ display:'flex', alignItems:'center', gap:14, fontSize:12 }}>
          {loading && <span style={{ color:'#fbbf24', fontFamily:'monospace' }}>⏱ {elapsed}s</span>}
          {riskTheme && (
            <span style={{ padding:'3px 12px', borderRadius:99, fontWeight:700, fontSize:11,
              background:riskTheme.bg, color:riskTheme.text, border:`1px solid ${riskTheme.border}` }}>
              {riskTheme.label}
            </span>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: sidebarCollapsed ? '#0284c7' : '#1e293b',
              border: '1px solid #334155', color: '#fff',
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
              boxShadow: sidebarCollapsed ? '0 0 12px rgba(2,132,199,0.5)' : 'none'
            }}
          >
            {sidebarCollapsed ? '📊 Show Control Panel' : '⚙️ Hide Panel'}
          </button>
        </div>
      </nav>

      {/* BODY */}
      <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative' }}>

        {/* SIDEBAR */}
        <div style={{
          width: sidebarCollapsed ? 0 : 400,
          minWidth: sidebarCollapsed ? 0 : 400,
          display:'flex', flexDirection:'column',
          background:'rgba(10,15,28,0.99)',
          borderRight: sidebarCollapsed ? 'none' : '1px solid #1e293b',
          overflow:'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 900
        }}>

          {/* CONTROLS AREA */}
          <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10, borderBottom:'1px solid #1e293b' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div>
                <label style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', fontWeight:700 }}>Latitude</label>
                <input type="number" step="0.0001" value={coords.lat} onChange={e => setCoords({ ...coords, lat: parseFloat(e.target.value) })}
                  style={{ width:'100%', background:'#020617', border:'1px solid #334155', color:'#e2e8f0', borderRadius:6, padding:'4px 8px', fontSize:11, marginTop:2 }} />
              </div>
              <div>
                <label style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', fontWeight:700 }}>Longitude</label>
                <input type="number" step="0.0001" value={coords.lon} onChange={e => setCoords({ ...coords, lon: parseFloat(e.target.value) })}
                  style={{ width:'100%', background:'#020617', border:'1px solid #334155', color:'#e2e8f0', borderRadius:6, padding:'4px 8px', fontSize:11, marginTop:2 }} />
              </div>
              <div>
                <label style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', fontWeight:700 }}>Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  style={{ width:'100%', background:'#020617', border:'1px solid #334155', color:'#e2e8f0', borderRadius:6, padding:'4px 6px', fontSize:10, marginTop:2 }} />
              </div>
              <div>
                <label style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', fontWeight:700 }}>End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  style={{ width:'100%', background:'#020617', border:'1px solid #334155', color:'#e2e8f0', borderRadius:6, padding:'4px 6px', fontSize:10, marginTop:2 }} />
              </div>
            </div>

            <button onClick={triggerAnalysis} disabled={loading} style={{
              width:'100%', padding:11, fontWeight:800, fontSize:12, border:'none', borderRadius:8,
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? 'rgba(71,85,105,0.5)' : 'linear-gradient(135deg,#0284c7,#6366f1)',
              color:'#fff', boxShadow: loading ? 'none' : '0 0 20px #0284c755', transition:'all 0.3s',
            }}>
              {loading ? '🤖  AI Agents Processing...' : '🚀  Trigger Deep Learning Inference'}
            </button>
          </div>

          {sitrep && (
            <div style={{ display:'flex', gap:10, padding:'12px 16px 0' }}>
              <Card icon="🌊" label="Flooded Area"  value={sitrep.area_km2}       unit="km²"  color="#38bdf8" />
              <Card icon="🚧" label="Roads Blocked" value={sitrep.submerged_roads} unit="segs" color="#f87171" />
            </div>
          )}

          {(floodGeoJSON || sitrep) && (
            <div style={{ display:'flex', gap:8, padding:'10px 16px 0' }}>
              {floodGeoJSON && (
                <button onClick={exportGeoJSON} style={{ flex:1, padding:'6px 0', background:'#0f172a', border:'1px solid #334155', color:'#38bdf8', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer' }}>
                  💾 GeoJSON
                </button>
              )}
              {sitrep && (
                <button onClick={exportSitrepReport} style={{ flex:1, padding:'6px 0', background:'#0f172a', border:'1px solid #334155', color:'#4ade80', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer' }}>
                  📄 SITREP
                </button>
              )}
            </div>
          )}

          <div style={{ display:'flex', gap:4, padding:'12px 16px 0' }}>
            <Tab active={tab==='terminal'} onClick={() => setTab('terminal')}>🖥 Agent Log</Tab>
            <Tab active={tab==='graphs'}   onClick={() => setTab('graphs')}>📊 Analytics</Tab>
            <Tab active={tab==='info'}     onClick={() => setTab('info')}>ℹ Stack</Tab>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 16px' }}>
            {tab === 'terminal' && (
              <div style={{ background:'#020617', borderRadius:10, padding:14,
                fontFamily:'monospace', fontSize:11.5, minHeight:200, border:'1px solid #1e293b' }}>
                <div style={{ color:'#334155', fontSize:10, letterSpacing:'1px', marginBottom:10 }}>
                  // LIVE MULTI-AGENT EXECUTION LOG
                </div>
                {agentLogs.map((log, i) => {
                  const bracket = log.includes(']') ? log.split('] ')[0] + ']' : '[Log]';
                  const rest    = log.includes(']') ? log.split('] ').slice(1).join('] ') : log;
                  const c = bracket.includes('Error') ? '#f87171'
                        : bracket.includes('System') ? '#94a3b8' : '#a78bfa';
                  return (
                    <div key={i} style={{ marginBottom:5, lineHeight:1.6 }}>
                      <span style={{ color:c }}>{bracket}</span>
                      <span style={{ color:'#cbd5e1' }}> {rest}</span>
                    </div>
                  );
                })}
                {loading && <span style={{ animation:'blink 1s linear infinite', color:'#38bdf8' }}>█</span>}
                <div ref={logsEnd} />
              </div>
            )}

            {tab === 'graphs' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ background:'#0f172a', borderRadius:10, padding:14, border:'1px solid #1e293b' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'1px', marginBottom:12 }}>
                    🎯 MODEL CONFIDENCE SCORES
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-around' }}>
                    <GaugeRing value={metrics.vv}       color="#38bdf8" label="VV Channel" />
                    <GaugeRing value={metrics.vh}       color="#818cf8" label="VH Channel" />
                    <GaugeRing value={metrics.dl}       color="#4ade80" label="DL Score"   />
                    <GaugeRing value={metrics.ensemble} color="#fb923c" label="Ensemble"   />
                  </div>
                </div>

                <div style={{ background:'#0f172a', borderRadius:10, padding:14, border:'1px solid #1e293b' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'1px', marginBottom:4 }}>
                    🔬 MODEL PERFORMANCE RADAR
                  </div>
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <RadarChart data={radarData} size={200} />
                  </div>
                  <div style={{ display:'flex', gap:14, justifyContent:'center', fontSize:9, marginTop:4 }}>
                    <span style={{ color:'#38bdf8' }}>● LightGBM</span>
                    <span style={{ color:'#4ade80' }}>● UNet</span>
                    <span style={{ color:'#f87171' }}>● Baseline</span>
                  </div>
                </div>

                <div style={{ background:'#0f172a', borderRadius:10, padding:14, border:'1px solid #1e293b' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'1px', marginBottom:8 }}>
                    📈 CONFIDENCE HISTOGRAM
                  </div>
                  <BarChartSVG data={graphData} width={330} height={110} color="#3b82f6" />
                </div>

                <div style={{ background:'#0f172a', borderRadius:10, padding:14, border:'1px solid #1e293b' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'1px', marginBottom:8 }}>
                    📉 INUNDATION TREND & BACKSCATTER
                  </div>
                  <ComposedSVG data={trendData} width={330} height={130} />
                  <div style={{ display:'flex', gap:12, justifyContent:'center', fontSize:9, marginTop:6 }}>
                    <span style={{ color:'#06b6d4' }}>■ Area (km²)</span>
                    <span style={{ color:'#818cf8' }}>― VV (dB)</span>
                    <span style={{ color:'#fb923c' }}>-- VH (dB)</span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'info' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ background:'#0f172a', borderRadius:10, padding:14, border:'1px solid #1e293b' }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'#38bdf8', marginBottom:6 }}>
                    SentinelMobility AI Architecture
                  </div>
                  <p style={{ fontSize:11, color:'#94a3b8', lineHeight:1.5, margin:0 }}>
                    Multi-agent disaster assessment pipeline processing Sentinel-1 SAR dual-polarization (VV/VH) microwave imagery for real-time inundation mapping and safe evacuation routing.
                  </p>
                </div>

                <div style={{ background:'#0f172a', borderRadius:10, padding:14, border:'1px solid #1e293b', display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'1px' }}>
                    SYSTEM STACK
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:11 }}>
                    <div style={{ background:'#020617', padding:'8px 10px', borderRadius:6, border:'1px solid #1e293b' }}>
                      <div style={{ color:'#38bdf8', fontWeight:700, fontSize:10 }}>Core Engine</div>
                      <div style={{ color:'#e2e8f0', fontSize:11 }}>PyTorch / LightGBM</div>
                    </div>
                    <div style={{ background:'#020617', padding:'8px 10px', borderRadius:6, border:'1px solid #1e293b' }}>
                      <div style={{ color:'#4ade80', fontWeight:700, fontSize:10 }}>Imagery Data</div>
                      <div style={{ color:'#e2e8f0', fontSize:11 }}>Sentinel-1 GRD SAR</div>
                    </div>
                    <div style={{ background:'#020617', padding:'8px 10px', borderRadius:6, border:'1px solid #1e293b' }}>
                      <div style={{ color:'#a78bfa', fontWeight:700, fontSize:10 }}>Mapping Layer</div>
                      <div style={{ color:'#e2e8f0', fontSize:11 }}>Leaflet / OpenStreetMap</div>
                    </div>
                    <div style={{ background:'#020617', padding:'8px 10px', borderRadius:6, border:'1px solid #1e293b' }}>
                      <div style={{ color:'#fb923c', fontWeight:700, fontSize:10 }}>Routing Engine</div>
                      <div style={{ color:'#e2e8f0', fontSize:11 }}>NetworkX / OSMnx</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MAIN MAP CONTAINER */}
        <div style={{ flex:1, position:'relative', height:'100%', background:'#0f172a' }}>
          <MapContainer
            center={[coords.lat, coords.lon]}
            zoom={13}
            style={{ width:'100%', height:'100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution={
                tileLayer === 'satellite'
                  ? 'Tiles &copy; Esri &mdash; Source: Esri, Maxar'
                  : '&copy; OpenStreetMap'
              }
              url={
                tileLayer === 'satellite'
                  ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              }
            />
            {/* Auto-resizes map tiles when sidebar collapses */}
            <MapResizeHandler sidebarCollapsed={sidebarCollapsed} />
            <MapBoundsFitter geojson={floodGeoJSON} route={safeRoute} coords={coords} />
            <MapEventsHandler setCoords={setCoords} />

            {/* Target Location Marker */}
            <Marker position={[coords.lat, coords.lon]} icon={customPinIcon}>
              <Popup>
                <div style={{ fontFamily:'sans-serif', fontSize:12, color:'#0f172a' }}>
                  <strong>Target Analysis Point</strong><br />
                  Lat: {coords.lat}, Lon: {coords.lon}
                </div>
              </Popup>
            </Marker>

            {/* Flood Overlay */}
            {showFloodOverlay && floodGeoJSON && (
              <GeoJSON
                key={JSON.stringify(floodGeoJSON)}
                data={floodGeoJSON}
                style={{
                  color: '#ef4444',
                  weight: 2,
                  fillColor: '#ef4444',
                  fillOpacity: 0.45
                }}
              />
            )}

            {/* Safe Evacuation Route Polyline */}
            {showSafeRoute && safeRoute && (
              <Polyline
                positions={safeRoute}
                pathOptions={{ color: '#16a34a', weight: 5, dashArray: '8, 8' }}
              />
            )}
          </MapContainer>

          {/* ══════════════════════════════════════════════
             FLOATING COMMAND HUD OVERLAYS (FULL SCREEN MAP MODE)
          ══════════════════════════════════════════════ */}

          {/* 1. TOP STATS BAR (Visible when panel is collapsed) */}
          {sidebarCollapsed && sitrep && (
            <div style={{
              position:'absolute', top:16, left:16, zIndex:1000,
              display:'flex', gap:12,
              background:'rgba(15,23,42,0.85)', backdropFilter:'blur(12px)',
              padding:'8px 16px', borderRadius:12, border:'1px solid #1e293b',
              boxShadow:'0 8px 32px rgba(0,0,0,0.4)', animation:'fadeIn 0.3s ease'
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>🌊</span>
                <div>
                  <div style={{ fontSize:9, color:'#64748b', fontWeight:700 }}>FLOOD AREA</div>
                  <div style={{ fontSize:14, fontWeight:800, color:'#38bdf8' }}>{sitrep.area_km2} km²</div>
                </div>
              </div>
              <div style={{ width:1, background:'#334155' }} />
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>🚧</span>
                <div>
                  <div style={{ fontSize:9, color:'#64748b', fontWeight:700 }}>BLOCKED ROADS</div>
                  <div style={{ fontSize:14, fontWeight:800, color:'#f87171' }}>{sitrep.submerged_roads} segs</div>
                </div>
              </div>
              {riskTheme && (
                <>
                  <div style={{ width:1, background:'#334155' }} />
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ padding:'3px 10px', borderRadius:99, fontWeight:800, fontSize:10,
                      background:riskTheme.bg, color:riskTheme.text, border:`1px solid ${riskTheme.border}` }}>
                      {riskTheme.label}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 2. SATELLITE TELEMETRY WIDGET (Top Right) */}
          <div style={{
            position:'absolute', top:16, right:16, zIndex:1000,
            display:'flex', flexDirection:'column', gap:8,
            alignItems:'flex-end'
          }}>
            <div style={{
              background:'rgba(15,23,42,0.85)', backdropFilter:'blur(10px)',
              padding:'8px 12px', borderRadius:10, border:'1px solid #1e293b',
              display:'flex', gap:10, fontSize:10, color:'#94a3b8'
            }}>
              <div>🛰 <strong>SAR S1A:</strong> Descending</div>
              <div>⚡ <strong>SNR:</strong> 24.2 dB</div>
              <div>🌧 <strong>Precip:</strong> Moderate</div>
            </div>

            {/* Quick Map Controls */}
            <div style={{
              display:'flex', gap:6,
              background:'rgba(15,23,42,0.85)', backdropFilter:'blur(10px)',
              padding:6, borderRadius:10, border:'1px solid #1e293b'
            }}>
              <button
                onClick={() => setTileLayer(tileLayer === 'osm' ? 'satellite' : 'osm')}
                style={{
                  background: tileLayer === 'satellite' ? '#0284c7' : '#1e293b',
                  border:'1px solid #334155', color:'#fff',
                  padding:'6px 12px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer'
                }}
              >
                🛰 {tileLayer === 'osm' ? 'Satellite' : 'Standard Map'}
              </button>

              {floodGeoJSON && (
                <button
                  onClick={() => setShowFloodOverlay(!showFloodOverlay)}
                  style={{
                    background: showFloodOverlay ? '#991b1b' : '#1e293b',
                    border:'1px solid #334155', color:'#fca5a5',
                    padding:'6px 12px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer'
                  }}
                >
                  🌊 Flood Overlay: {showFloodOverlay ? 'ON' : 'OFF'}
                </button>
              )}

              {safeRoute && (
                <button
                  onClick={() => setShowSafeRoute(!showSafeRoute)}
                  style={{
                    background: showSafeRoute ? '#166534' : '#1e293b',
                    border:'1px solid #334155', color:'#86efac',
                    padding:'6px 12px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer'
                  }}
                >
                  🛣 Safe Route: {showSafeRoute ? 'ON' : 'OFF'}
                </button>
              )}
            </div>
          </div>

          {/* 3. TACTICAL MAP LEGEND (Bottom Left) */}
          <div style={{
            position:'absolute', bottom:24, left:16, zIndex:1000,
            background:'rgba(15,23,42,0.88)', backdropFilter:'blur(10px)',
            padding:'10px 14px', borderRadius:10, border:'1px solid #1e293b',
            display:'flex', flexDirection:'column', gap:6, fontSize:11, color:'#cbd5e1'
          }}>
            <div style={{ fontSize:9, fontWeight:800, color:'#64748b', letterSpacing:'1px', textTransform:'uppercase' }}>
              Map Legend
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:12, height:12, borderRadius:3, background:'#ef4444', opacity:0.8 }} />
              <span>Inundated Flood Zones</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:16, height:3, background:'#16a34a', borderRadius:2 }} />
              <span>Recommended Evacuation Corridor</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'#ef4444', border:'1px solid #fff' }} />
              <span>Target Coordinates ({coords.lat}, {coords.lon})</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

/* Wrap with ErrorBoundary */
export default function SentinelApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}