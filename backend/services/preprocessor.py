import os
import re
import ast
import json
import math
import sqlite3
import pandas as pd
from typing import Dict, List, Tuple, Any

from backend.config import (
    BASE_DIR, DATA_DIR, STOPS_CSV, ROUTES_CSV, AGGREGATED_CSV,
    CLASSIFICATION_CSV, OFFICIAL_GEO_CSV, AC_BUSES_CSV, NON_AC_BUSES_CSV,
    GEOCODED_STOPS_JSON, TRANSPORT_GRAPH_JSON, VALIDATION_REPORT_JSON,
    SQLITE_DB_PATH, SERVICE_ORDINARY, SERVICE_VAJRA, SERVICE_VAYU_VAJRA,
    SERVICE_MOFUSSIL, SERVICE_NICE_ROAD, SERVICE_UNKNOWN, SPEED_KMH, DEFAULT_DWELL_MIN,
    ROAD_DETOUR_FACTOR
)

def normalize_text(text: str) -> str:
    """Normalize text by lowercasing and stripping non-alphanumeric chars."""
    if not isinstance(text, str):
        return ""
    return re.sub(r'[^a-z0-9]', '', text.lower())

def clean_stop_tokens(name: str) -> str:
    """Strip common suffix tokens to assist fuzzy matching."""
    if not isinstance(name, str):
        return ""
    n = name.lower()
    for token in ['bus stop', 'bus station', 'kbs', 'majestic', 'circle', 'cross', 'gate', 'junction', 'road', 'stage']:
        n = n.replace(token, '')
    return re.sub(r'[^a-z0-9]', '', n)

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate Great Circle distance between two points in km."""
    R = 6371.0 # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def safe_parse_list(val: Any) -> List[str]:
    """Safely parse python list strings or JSON arrays."""
    if isinstance(val, list):
        return val
    if not isinstance(val, str) or not val.strip():
        return []
    s = val.strip()
    try:
        parsed = ast.literal_eval(s)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if x]
    except Exception:
        pass
    try:
        parsed = json.loads(s.replace("'", '"'))
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if x]
    except Exception:
        pass
    # Fallback to comma separation
    s_clean = s.strip('[]()')
    return [x.strip().strip("'\"") for x in s_clean.split(',') if x.strip()]

class TransportPreprocessor:
    def __init__(self):
        self.validation_report = {}
        self.geocoded_stops: Dict[str, Dict[str, Any]] = {}
        self.stop_name_to_ids: Dict[str, List[str]] = {}
        self.stop_records: Dict[str, Dict[str, Any]] = {}
        self.routes_records: List[Dict[str, Any]] = []
        self.graph = {
            "stops": {},
            "adjacency": {},
            "routes": {},
            "terminals": []
        }

    def load_official_geocodes(self) -> Dict[str, Tuple[float, float]]:
        """Load coordinates from official BMTC geocoded stops."""
        geo_map = {}
        if not os.path.exists(OFFICIAL_GEO_CSV):
            print(f"[WARN] Official geocoded CSV not found at {OFFICIAL_GEO_CSV}")
            return geo_map

        df = pd.read_csv(OFFICIAL_GEO_CSV, low_memory=False)
        df['lat_num'] = pd.to_numeric(df.get('Latitude'), errors='coerce')
        df['lng_num'] = pd.to_numeric(df.get('Longitude'), errors='coerce')
        df = df.dropna(subset=['lat_num', 'lng_num'])

        # Filter strictly within greater Bangalore boundary
        df = df[(df['lat_num'] >= 12.60) & (df['lat_num'] <= 13.40) &
                (df['lng_num'] >= 77.20) & (df['lng_num'] <= 78.00)]

        for _, row in df.iterrows():
            stop_name = str(row.get('Stop Name', '')).strip()
            norm = normalize_text(stop_name)
            if norm and norm not in geo_map:
                geo_map[norm] = (float(row['lat_num']), float(row['lng_num']))
            tok = clean_stop_tokens(stop_name)
            if tok and tok not in geo_map:
                geo_map[tok] = (float(row['lat_num']), float(row['lng_num']))

        print(f"[INFO] Loaded {len(geo_map)} geocoded aliases from official BMTC database.")
        return geo_map

    def process_stops(self, official_geo: Dict[str, Tuple[float, float]]):
        """Parse stops.csv, match coordinates, and register stop metadata."""
        if not os.path.exists(STOPS_CSV):
            raise FileNotFoundError(f"Missing stops.csv at {STOPS_CSV}")

        df_stops = pd.read_csv(STOPS_CSV, low_memory=False)
        total_records = len(df_stops)
        unique_ids = df_stops['id'].nunique()
        unique_names = df_stops['name'].nunique()

        # Load existing cached coordinates if available
        existing_cache = {}
        if os.path.exists(GEOCODED_STOPS_JSON):
            try:
                with open(GEOCODED_STOPS_JSON, 'r', encoding='utf-8') as f:
                    existing_cache = json.load(f)
            except Exception:
                pass

        matched_count = 0
        interpolated_count = 0

        # Anchor coordinates for core Bangalore terminals
        TERMINAL_ANCHORS = {
            'kempegowdabusstationmajestic': (12.9774, 77.5726),
            'majestic': (12.9774, 77.5726),
            'kempegowdainternationalairport': (13.1986, 77.7066),
            'shivajinagarbusstation': (12.9863, 77.6033),
            'shantinagarbusstation': (12.9538, 77.5947),
            'banashankaribusstation': (12.9255, 77.5750),
            'jayanagar9thblock': (12.9174, 77.5910),
            'electroniccity': (12.8452, 77.6602),
            'whitefieldbusstop': (12.9698, 77.7500),
            'hebbal': (13.0358, 77.5970),
            'yeshwanthpur': (13.0238, 77.5529),
            'krpuram': (13.0075, 77.6959),
            'silkboard': (12.9172, 77.6228),
            'marathahalli': (12.9591, 77.6974),
            'kengeri': (12.9081, 77.4842),
            'yelahanka': (13.1007, 77.5963),
            'vijayanagar': (12.9680, 77.5348),
            'indiranagar': (12.9719, 77.6412),
            'koramangala': (12.9352, 77.6245),
            'domlur': (12.9609, 77.6387)
        }

        for _, row in df_stops.iterrows():
            sid = str(row['id']).strip()
            name = str(row['name']).strip()
            n_norm = normalize_text(name)
            n_tok = clean_stop_tokens(name)

            routes = safe_parse_list(row.get('route_list'))
            trips = safe_parse_list(row.get('trip_list'))

            lat, lng, source = None, None, "unmatched"

            # Check cache
            if sid in existing_cache and existing_cache[sid].get('lat') is not None:
                lat = existing_cache[sid]['lat']
                lng = existing_cache[sid]['lng']
                source = existing_cache[sid].get('source', 'cache')
                matched_count += 1
            # Check terminal anchors
            elif n_norm in TERMINAL_ANCHORS:
                lat, lng = TERMINAL_ANCHORS[n_norm]
                source = "anchor_terminal"
                matched_count += 1
            # Check official geocoded dataset
            elif n_norm in official_geo:
                lat, lng = official_geo[n_norm]
                source = "official_bmtc"
                matched_count += 1
            elif n_tok in official_geo:
                lat, lng = official_geo[n_tok]
                source = "official_bmtc_token"
                matched_count += 1

            self.stop_records[sid] = {
                "id": sid,
                "name": name,
                "normalized_name": n_norm,
                "lat": lat,
                "lng": lng,
                "geo_source": source,
                "route_count": int(row.get('route_count', len(routes))),
                "routes": routes,
                "trip_count": int(row.get('trip_count', len(trips))),
                "activity_index": len(trips)
            }

            if name not in self.stop_name_to_ids:
                self.stop_name_to_ids[name] = []
            self.stop_name_to_ids[name].append(sid)

        print(f"[INFO] Processed {total_records} stops. Initially resolved coordinates for {matched_count} stops.")

    def process_routes_and_interpolate(self):
        """Parse routes.csv, classify services, and interpolate intermediate stop coordinates."""
        if not os.path.exists(ROUTES_CSV):
            raise FileNotFoundError(f"Missing routes.csv at {ROUTES_CSV}")

        # Load verified classifications (only accept verified entries, ignore Pending)
        class_map = {}
        if os.path.exists(CLASSIFICATION_CSV):
            try:
                c_df = pd.read_csv(CLASSIFICATION_CSV)
                for _, row in c_df.iterrows():
                    verif = str(row.get('Verification', '')).strip().lower()
                    if verif == 'verified':
                        s_type = str(row.get('Service type', '')).strip()
                        r_id = str(row.get('Route ID', '')).strip()
                        r_name = str(row.get('Route name', '')).strip().upper()
                        if r_id:
                            class_map[r_id] = s_type
                        if r_name:
                            class_map[r_name] = s_type
            except Exception as e:
                print(f"[WARN] Error reading classification: {e}")

        # Load AC buses verified list from Excel/ac_buses.csv
        ac_routes = set()
        ac_route_ids = set()
        if os.path.exists(AC_BUSES_CSV):
            try:
                ac_df = pd.read_csv(AC_BUSES_CSV)
                for _, row in ac_df.iterrows():
                    r_name = str(row.get('name', '')).strip().upper()
                    r_id = str(row.get('id', '')).strip()
                    if r_name:
                        ac_routes.add(r_name)
                        ac_routes.add(r_name.split(' ')[0])
                    if r_id:
                        ac_route_ids.add(r_id)
            except Exception as e:
                print(f"[WARN] Error reading AC buses: {e}")

        # Load Non-AC buses verified list
        non_ac_route_ids = set()
        if os.path.exists(NON_AC_BUSES_CSV):
            try:
                non_ac_df = pd.read_csv(NON_AC_BUSES_CSV)
                for _, row in non_ac_df.iterrows():
                    r_id = str(row.get('id', '')).strip()
                    if r_id:
                        non_ac_route_ids.add(r_id)
            except Exception as e:
                print(f"[WARN] Error reading Non-AC buses: {e}")

        df_routes = pd.read_csv(ROUTES_CSV, low_memory=False)
        total_routes = len(df_routes)
        unique_route_ids = df_routes['id'].nunique()
        unique_route_names = df_routes['name'].nunique()

        missing_stop_refs = set()
        invalid_sequences = 0

        interpolated_stops = 0

        for _, row in df_routes.iterrows():
            rid = str(row['id']).strip()
            name = str(row['name']).strip()
            full_name = str(row.get('full_name', name)).strip()
            dir_id = int(row.get('direction_id', 0))
            raw_stops = safe_parse_list(row.get('stop_list'))
            trips = safe_parse_list(row.get('trip_list'))

            if len(raw_stops) < 2:
                invalid_sequences += 1
                continue

            # Strict verified classification
            # Preserve route ID and direction ID
            u_name = name.upper()
            base_u_name = u_name.split(' ')[0]

            is_ac = (rid in ac_route_ids or u_name in ac_routes or base_u_name in ac_routes)

            if is_ac:
                # Differentiate Vajra vs Vayu Vajra; do not assume all AC is Vajra
                if u_name.startswith('VV-') or u_name.startswith('KIA-') or ('KIA' in u_name and 'KIADB' not in u_name):
                    service = SERVICE_VAYU_VAJRA
                elif u_name.startswith('V-') and not u_name.startswith('V-NICE') and not u_name.startswith('V-MF'):
                    service = SERVICE_VAJRA
                else:
                    service = SERVICE_UNKNOWN
            elif rid in class_map:
                service = class_map[rid]
            elif u_name in class_map:
                service = class_map[u_name]
            else:
                # Non-AC route: do not assume Non-AC automatically means Ordinary.
                # Do not infer Mofussil or NICE Road from name prefixes.
                # Specialized routes (school, army, depot, express NICE, feeder MF without verified documentation) are Unknown.
                if any(u_name.startswith(p) for p in ['NICE', 'EXP NICE', 'MF', 'ARMY', 'HSS', 'SJBHS', 'SPHS', 'CALLBUS', 'ADITI', 'BELGS', 'BEMLA']):
                    service = SERVICE_UNKNOWN
                elif re.match(r'^[0-9]', u_name) or u_name.startswith('G-') or u_name.startswith('KBS') or u_name.startswith('SBS') or u_name.startswith('CHAKRA') or u_name.startswith('BC-'):
                    service = SERVICE_ORDINARY
                else:
                    service = SERVICE_UNKNOWN

            route_record = {
                "id": rid,
                "name": name,
                "full_name": full_name,
                "direction_id": dir_id,
                "service": service,
                "stop_names": raw_stops,
                "stop_count": len(raw_stops),
                "trip_count": len(trips),
                "trip_list": trips
            }
            self.routes_records.append(route_record)

            # Interpolate missing stop coordinates along this route sequence
            # First map stop names to known coordinates
            stop_coords = []
            for sname in raw_stops:
                sid_list = self.stop_name_to_ids.get(sname, [])
                coord = None
                for sid in sid_list:
                    if self.stop_records[sid]['lat'] is not None:
                        coord = (self.stop_records[sid]['lat'], self.stop_records[sid]['lng'])
                        break
                if not coord:
                    missing_stop_refs.add(sname)
                stop_coords.append(coord)

            # Route interpolation between known anchor indices
            n_pts = len(stop_coords)
            i = 0
            while i < n_pts:
                if stop_coords[i] is None:
                    # Find previous known and next known
                    prev_idx = i - 1
                    while prev_idx >= 0 and stop_coords[prev_idx] is None:
                        prev_idx -= 1
                    
                    next_idx = i + 1
                    while next_idx < n_pts and stop_coords[next_idx] is None:
                        next_idx += 1

                    if prev_idx >= 0 and next_idx < n_pts:
                        p_lat, p_lng = stop_coords[prev_idx]
                        n_lat, n_lng = stop_coords[next_idx]
                        span = next_idx - prev_idx
                        for k in range(prev_idx + 1, next_idx):
                            frac = (k - prev_idx) / span
                            int_lat = p_lat + frac * (n_lat - p_lat)
                            int_lng = p_lng + frac * (n_lng - p_lng)
                            stop_coords[k] = (round(int_lat, 6), round(int_lng, 6))
                            sname_k = raw_stops[k]
                            for sid in self.stop_name_to_ids.get(sname_k, []):
                                if self.stop_records[sid]['lat'] is None:
                                    self.stop_records[sid]['lat'] = round(int_lat, 6)
                                    self.stop_records[sid]['lng'] = round(int_lng, 6)
                                    self.stop_records[sid]['geo_source'] = "interpolated_route"
                                    interpolated_stops += 1
                        i = next_idx
                    else:
                        i += 1
                else:
                    i += 1

        print(f"[INFO] Processed {len(self.routes_records)} routes. Interpolated coordinates for {interpolated_stops} stops.")

    def construct_graph(self):
        """Build directed adjacency graph for Dijkstra routing and map rendering."""
        print("[INFO] Constructing multi-service directed transport graph...")
        # 1. Register stops into graph
        for sid, sdata in self.stop_records.items():
            self.graph["stops"][sid] = {
                "id": sid,
                "name": sdata["name"],
                "lat": sdata["lat"],
                "lng": sdata["lng"],
                "geo_source": sdata["geo_source"],
                "route_count": sdata["route_count"],
                "routes": sdata["routes"],
                "trip_count": sdata["trip_count"]
            }
            self.graph["adjacency"][sid] = []

        # 2. Add edges from route stop sequences
        edge_set = set()
        total_edges = 0

        for r in self.routes_records:
            r_id = r["id"]
            r_name = r["name"]
            service = r["service"]
            dir_id = r["direction_id"]
            stops = r["stop_names"]

            speed = SPEED_KMH.get(service, 18.0)

            for i in range(len(stops) - 1):
                u_name = stops[i]
                v_name = stops[i + 1]

                # Map to stop IDs
                u_ids = self.stop_name_to_ids.get(u_name, [])
                v_ids = self.stop_name_to_ids.get(v_name, [])

                if not u_ids or not v_ids:
                    continue

                u_id = u_ids[0]
                v_id = v_ids[0]

                if u_id == v_id:
                    continue

                # Edge deduplication key for same route and direction
                edge_key = (u_id, v_id, r_name, dir_id)
                if edge_key in edge_set:
                    continue
                edge_set.add(edge_key)

                # Distance calculation
                u_lat, u_lng = self.stop_records[u_id]['lat'], self.stop_records[u_id]['lng']
                v_lat, v_lng = self.stop_records[v_id]['lat'], self.stop_records[v_id]['lng']

                if u_lat is not None and v_lat is not None:
                    dist_km = haversine_km(u_lat, u_lng, v_lat, v_lng) * ROAD_DETOUR_FACTOR
                    dist_km = max(0.4, round(dist_km, 2))
                else:
                    dist_km = 1.2 # Standard average Bangalore bus stop interval

                duration_min = round((dist_km / speed) * 60.0 + DEFAULT_DWELL_MIN, 1)

                edge = {
                    "to_stop_id": v_id,
                    "to_stop_name": v_name,
                    "route_id": r_id,
                    "route_name": r_name,
                    "direction_id": dir_id,
                    "service": service,
                    "distance_km": dist_km,
                    "duration_min": duration_min
                }

                if u_id in self.graph["adjacency"]:
                    self.graph["adjacency"][u_id].append(edge)
                    total_edges += 1

            self.graph["routes"][r_name] = {
                "name": r_name,
                "full_name": r["full_name"],
                "service": service,
                "direction_id": dir_id,
                "stops": stops,
                "stop_count": len(stops),
                "trip_count": r["trip_count"]
            }

        print(f"[INFO] Transport graph constructed with {len(self.graph['stops'])} stops and {total_edges} directed edges.")

    def export_artifacts(self):
        """Export clean JSON artifacts and initialize SQLite database."""
        # 1. Geocoded stops cache
        geocoded_dict = {}
        geocoded_count = 0
        for sid, s in self.stop_records.items():
            if s['lat'] is not None and s['lng'] is not None:
                geocoded_dict[sid] = {
                    "id": sid,
                    "name": s["name"],
                    "lat": s["lat"],
                    "lng": s["lng"],
                    "source": s["geo_source"]
                }
                geocoded_count += 1

        with open(GEOCODED_STOPS_JSON, 'w', encoding='utf-8') as f:
            json.dump(geocoded_dict, f, indent=2)
        print(f"[SUCCESS] Exported {geocoded_count} geocoded stops to {GEOCODED_STOPS_JSON}")

        # 2. Transport graph
        with open(TRANSPORT_GRAPH_JSON, 'w', encoding='utf-8') as f:
            json.dump(self.graph, f)
        print(f"[SUCCESS] Exported transport graph to {TRANSPORT_GRAPH_JSON}")

        # 3. Validation report
        service_counts = {}
        for r in self.routes_records:
            s = r["service"]
            service_counts[s] = service_counts.get(s, 0) + 1

        self.validation_report = {
            "total_stops_records": len(self.stop_records),
            "unique_stop_names": len(self.stop_name_to_ids),
            "stops_with_coordinates": geocoded_count,
            "geocoding_coverage_pct": round((geocoded_count / max(1, len(self.stop_records))) * 100, 2),
            "total_route_records": len(self.routes_records),
            "unique_route_names": len(self.graph["routes"]),
            "service_breakdown": service_counts,
            "total_graph_edges": sum(len(edges) for edges in self.graph["adjacency"].values())
        }

        with open(VALIDATION_REPORT_JSON, 'w', encoding='utf-8') as f:
            json.dump(self.validation_report, f, indent=2)
        print(f"[SUCCESS] Exported validation report to {VALIDATION_REPORT_JSON}")

        # 4. Initialize SQLite Database
        self.init_sqlite()

    def init_sqlite(self):
        """Initialize SQLite database for fast queries, alerts, and complaints."""
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS stops (
                id TEXT PRIMARY KEY,
                name TEXT,
                normalized_name TEXT,
                lat REAL,
                lng REAL,
                geo_source TEXT,
                route_count INTEGER,
                trip_count INTEGER
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS routes (
                id TEXT,
                name TEXT,
                full_name TEXT,
                direction_id INTEGER,
                service_category TEXT,
                stop_count INTEGER,
                trip_count INTEGER,
                stop_list_json TEXT,
                PRIMARY KEY (name, direction_id)
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                affected_routes TEXT,
                active_from TEXT,
                active_to TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS complaints (
                ticket_id TEXT PRIMARY KEY,
                commuter_name TEXT,
                contact TEXT,
                service_type TEXT,
                route_no TEXT,
                bus_no TEXT,
                category TEXT,
                description TEXT,
                status TEXT DEFAULT 'Under Review',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS crowd_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stop_id TEXT,
                stop_name TEXT,
                route_no TEXT,
                crowd_level TEXT,
                passenger_count INTEGER,
                reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Insert stops
        stops_rows = [
            (s['id'], s['name'], s['normalized_name'], s['lat'], s['lng'],
             s['geo_source'], s['route_count'], s['trip_count'])
            for s in self.stop_records.values()
        ]
        cur.executemany("INSERT OR REPLACE INTO stops VALUES (?,?,?,?,?,?,?,?)", stops_rows)

        # Insert routes
        routes_rows = [
            (r['id'], r['name'], r['full_name'], r['direction_id'], r['service'],
             r['stop_count'], r['trip_count'], json.dumps(r['stop_names']))
            for r in self.routes_records
        ]
        cur.executemany("INSERT OR REPLACE INTO routes VALUES (?,?,?,?,?,?,?,?)", routes_rows)

        # Seed initial smart service alerts
        cur.execute("SELECT COUNT(*) FROM alerts")
        if cur.fetchone()[0] == 0:
            sample_alerts = [
                ("Silk Board Junction Metro Construction", "Metro Construction", "High",
                 "Diversion active on Hosur Road near Silk Board. Anticipate 15-20 min delays during peak hours.",
                 "['500-D', '365', 'KIA-14']", "2026-11-13", "2026-11-30"),
                ("Heavy Rain & Waterlogging at Hebbal Flyover", "Weather", "Moderate",
                 "Slow-moving traffic near Hebbal towards KIA. Extra airport shuttle frequency deployed.",
                 "['KIA-9', 'KIA-8', '500-A']", "2026-11-13", "2026-11-15"),
                ("Bannerghatta Road Pipeline Maintenance", "Road Maintenance", "Low",
                 "Single-lane transit operation near Bilekahalli signal.",
                 "['365-P', 'V-365']", "2026-11-13", "2026-11-20")
            ]
            cur.executemany("""
                INSERT INTO alerts (title, category, severity, message, affected_routes, active_from, active_to)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, sample_alerts)

        conn.commit()
        conn.close()
        print(f"[SUCCESS] SQLite database populated at {SQLITE_DB_PATH}")

    def run(self):
        """Execute full preprocessing pipeline."""
        print("=== STARTING BMTC PREPROCESSING PIPELINE ===")
        official_geo = self.load_official_geocodes()
        self.process_stops(official_geo)
        self.process_routes_and_interpolate()
        self.construct_graph()
        self.export_artifacts()
        print("=== PREPROCESSING PIPELINE COMPLETED SUCCESSFULLY ===")

if __name__ == '__main__':
    preprocessor = TransportPreprocessor()
    preprocessor.run()
