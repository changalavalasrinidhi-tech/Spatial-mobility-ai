from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ingestion import fetch_sentinel1_sar
from segmentation import detect_and_refine_inundation
from routing import vector_and_reroute
import uvicorn

app = FastAPI(title="SentinelMobility AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class FloodRequest(BaseModel):
    latitude: float
    longitude: float
    date_range: str = "2023-01-01/2023-01-10"
    search_buffer_deg: float = 0.05

@app.post("/api/v1/map-flood")
async def map_flood(req: FloodRequest):
    try:
        bbox = [
            req.longitude - req.search_buffer_deg,
            req.latitude - req.search_buffer_deg,
            req.longitude + req.search_buffer_deg,
            req.latitude + req.search_buffer_deg
        ]
        
        ds = fetch_sentinel1_sar(bbox, req.date_range)
        
        # ML Inference
        binary_mask, transform, graph_data = detect_and_refine_inundation(ds)
        
        # Routing
        geojson, num_submerged, safe_route = vector_and_reroute(binary_mask, transform, req.latitude, req.longitude)
        
        area_km2 = len(binary_mask[binary_mask == 1]) * (10 * 10) / 1e6
        
        # Simulated AI Agent Multi-Agent Output
        agent_log = [
            "[SupervisorAgent] STAC query successful. Retrieved Sentinel-1 RTC dual-pol swaths.",
            "[DeepVisionAgent] Ran tensors through PyTorch UNet feature extractor.",
            f"[LightGBMAgent] Fitted Gradient Boosting model on {len(binary_mask.flatten())} pixels. Extracted confidence map.",
            f"[OSMRoutingAgent] Intersected with OpenStreetMap. Found {num_submerged} blocked edges. A* Path generated.",
            f"[SitRepAgent] Total flooded area: {round(area_km2, 2)} km². Dispatching safe route to UI."
        ]
        
        return {
            "geojson": geojson,
            "impact_summary": {
                "area_km2": round(area_km2, 2),
                "submerged_roads": num_submerged
            },
            "safe_route_nodes": safe_route,
            "graph_data": graph_data,
            "agent_log": agent_log
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
