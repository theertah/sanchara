import json
import pandas as pd
import ast
from backend.config import STOPS_CSV, ROUTES_CSV, GEOCODED_STOPS_JSON

stops_df = pd.read_csv(STOPS_CSV, low_memory=False)
with open(GEOCODED_STOPS_JSON, 'r', encoding='utf-8') as f:
    geocoded_stops = json.load(f)

geocoded_ids = set(geocoded_stops.keys())

all_stops_count = len(stops_df)
geocoded_count = len(geocoded_ids)
missing_count = all_stops_count - geocoded_count

print(f"Total records in stops.csv: {all_stops_count}")
print(f"Geocoded stops: {geocoded_count}")
print(f"Difference (not geocoded): {missing_count}")

ungeocoded_df = stops_df[~stops_df['id'].isin(geocoded_ids)]

# Check 1: Stop names uniqueness in ungeocoded vs geocoded
geocoded_names = set(stops_df[stops_df['id'].isin(geocoded_ids)]['name'].dropna().str.strip())
ungeocoded_names = set(ungeocoded_df['name'].dropna().str.strip())
shared_names = ungeocoded_names.intersection(geocoded_names)
unique_to_ungeocoded = ungeocoded_names - geocoded_names

shared_records_count = ungeocoded_df['name'].isin(shared_names).sum()
completely_ungeocoded_records_count = ungeocoded_df['name'].isin(unique_to_ungeocoded).sum()

print("\n--- FINDINGS BREAKDOWN ---")
print(f"1. Duplicate Stop Name Records: {shared_records_count} records")
print(f"   These {shared_records_count} records share identical names with stops that ARE already geocoded.")
print(f"   (E.g., opposite sides of the road, platform bay distinctions, or direction IDs for the same physical bus stop).")

print(f"\n2. Unique Stop Names with No Geocode: {completely_ungeocoded_records_count} records ({len(unique_to_ungeocoded)} unique stop names)")

# Check 2: Route association of ungeocoded records
routes_df = pd.read_csv(ROUTES_CSV, low_memory=False)
all_route_stops = set()
for sl in routes_df['stop_list'].dropna():
    try:
        for s in ast.literal_eval(sl):
            all_route_stops.add(str(s).strip())
    except Exception:
        pass

in_routes = ungeocoded_df['name'].isin(all_route_stops)
print(f"\n3. Route Active Status of the 2,164 un-geocoded records:")
print(f"   - Referenced in at least one active route: {in_routes.sum()} records")
print(f"   - NEVER referenced in any routes.csv line (Orphaned stops): {(~in_routes).sum()} records")

print("\nSample 10 un-geocoded stop names:")
for name in list(unique_to_ungeocoded)[:10]:
    print(" -", name)
