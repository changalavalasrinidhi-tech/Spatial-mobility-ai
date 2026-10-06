import pystac_client
import stackstac
import planetary_computer

def fetch_sentinel1_sar(bbox: list, date_range: str):
    catalog = pystac_client.Client.open(
        "https://planetarycomputer.microsoft.com/api/stac/v1",
        modifier=planetary_computer.sign_inplace
    )
    search = catalog.search(
        collections=["sentinel-1-rtc"], 
        bbox=bbox,
        datetime=date_range,
        query={"sar:instrument_mode": {"eq": "IW"}}
    )
    items = list(search.items())
    if not items:
        raise ValueError("No Sentinel-1 SAR imagery found for specified BBOX.")
    
    return stackstac.stack(items, assets=["vv", "vh"], bounds=bbox, epsg=4326, resolution=0.0001)
