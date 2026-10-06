import geopandas as gpd
import networkx as nx
import osmnx as ox
import rasterio
from rasterio.features import shapes

def vector_and_reroute(binary_mask, affine_transform, lat: float, lon: float):
    if affine_transform is None:
        affine_transform = rasterio.transform.from_origin(lon - 0.05, lat + 0.05, 0.0001, 0.0001)
        
    results = [
        {"properties": {"inundated": 1}, "geometry": s}
        for s, val in shapes(binary_mask, mask=(binary_mask == 1), transform=affine_transform)
    ]
    
    if not results:
        return {"type": "FeatureCollection", "features": []}, 0, []
        
    flood_gdf = gpd.GeoDataFrame.from_features(results, crs="EPSG:4326")
    flood_gdf["geometry"] = flood_gdf["geometry"].simplify(0.0001)
    
    try:
        G = ox.graph_from_point((lat, lon), dist=5000, network_type="drive")
        gdf_edges = ox.graph_to_gdfs(G, nodes=False)
        submerged_edges = gpd.sjoin(gdf_edges, flood_gdf, predicate="intersects")
        
        for u, v, key in submerged_edges.index:
            if G.has_edge(u, v, key):
                G.remove_edge(u, v, key)
                
        orig_node = ox.distance.nearest_nodes(G, lon, lat)
        dest_node = list(G.nodes())[-1]
        safe_route = nx.shortest_path(G, orig_node, dest_node, weight="length")
        num_submerged = len(submerged_edges)
    except Exception as e:
        print(f"Routing failed: {e}")
        num_submerged = 0
        safe_route = []
        
    return flood_gdf.__geo_interface__, num_submerged, safe_route
