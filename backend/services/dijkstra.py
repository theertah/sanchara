import heapq
import json
import os
import math
from typing import Dict, List, Optional, Tuple, Any

from backend.config import (
    TRANSPORT_GRAPH_JSON, SERVICE_ORDINARY, SERVICE_VAJRA,
    SERVICE_VAYU_VAJRA, SERVICE_UNKNOWN, TRANSFER_PENALTY_MINUTES, TRANSFER_PENALTY_KM,
    SPEED_KMH, DEFAULT_DWELL_MIN, ROAD_DETOUR_FACTOR
)

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate Great Circle distance between two points in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return round(2 * R * math.asin(math.sqrt(max(0.0, min(1.0, a)))), 2)

class TransitRouter:
    def __init__(self, graph_path: Optional[str] = None):
        self.graph_path = graph_path or TRANSPORT_GRAPH_JSON
        self.stops: Dict[str, Any] = {}
        self.adjacency: Dict[str, List[Dict[str, Any]]] = {}
        self.routes: Dict[str, Any] = {}
        self.name_to_ids: Dict[str, List[str]] = {}
        self.load_graph()

    def load_graph(self):
        """Load preprocessed transport graph into memory."""
        if not os.path.exists(self.graph_path):
            raise FileNotFoundError(f"Transport graph missing at {self.graph_path}. Run preprocessor first.")

        with open(self.graph_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        self.stops = data.get("stops", {})
        self.adjacency = data.get("adjacency", {})
        self.routes = data.get("routes", {})

        for sid, sinfo in self.stops.items():
            name = sinfo.get("name", "")
            if name not in self.name_to_ids:
                self.name_to_ids[name] = []
            self.name_to_ids[name].append(sid)

        print(f"[TransitRouter] Ready. Loaded {len(self.stops)} stops, {len(self.routes)} routes.")

    def find_stop_ids(self, query: str) -> List[str]:
        """Resolve a search term or exact stop name/ID to candidate stop IDs."""
        q = query.strip()
        if q in self.stops:
            return [q]
        if q in self.name_to_ids:
            return self.name_to_ids[q]
        
        # Case-insensitive match
        q_lower = q.lower()
        matched = []
        for name, ids in self.name_to_ids.items():
            if name.lower() == q_lower:
                return ids
            if q_lower in name.lower():
                matched.extend(ids)
        return matched[:10]

    def _build_path_edges_from_stops(
        self,
        stop_names: List[str],
        route_name: str,
        route_id: str,
        direction_id: int,
        service: str
    ) -> List[Dict[str, Any]]:
        """Construct realistic path edges along a route stop sequence."""
        edges: List[Dict[str, Any]] = []
        speed = SPEED_KMH.get(service, 18.0)

        for i in range(len(stop_names) - 1):
            u_name = stop_names[i]
            v_name = stop_names[i + 1]

            u_ids = self.name_to_ids.get(u_name, [])
            v_ids = self.name_to_ids.get(v_name, [])
            u_id = u_ids[0] if u_ids else None
            v_id = v_ids[0] if v_ids else None

            # Look for precomputed edge in adjacency graph
            edge_match = None
            if u_id and u_id in self.adjacency:
                for e in self.adjacency[u_id]:
                    if e.get("to_stop_name") == v_name and e.get("route_name") == route_name:
                        edge_match = e
                        break
                if not edge_match:
                    for e in self.adjacency[u_id]:
                        if e.get("to_stop_name") == v_name:
                            edge_match = e
                            break

            if edge_match:
                edges.append(edge_match)
            else:
                u_meta = self.stops.get(u_id, {}) if u_id else {}
                v_meta = self.stops.get(v_id, {}) if v_id else {}
                if u_meta.get("lat") and v_meta.get("lat"):
                    d_km = round(haversine_distance_km(u_meta["lat"], u_meta["lng"], v_meta["lat"], v_meta["lng"]) * ROAD_DETOUR_FACTOR, 2)
                    d_km = max(0.4, d_km)
                else:
                    d_km = 1.2
                dur_min = round((d_km / speed) * 60.0 + DEFAULT_DWELL_MIN, 1)

                edges.append({
                    "to_stop_id": v_id or "unknown",
                    "to_stop_name": v_name,
                    "route_id": route_id,
                    "route_name": route_name,
                    "direction_id": direction_id,
                    "service": service,
                    "distance_km": d_km,
                    "duration_min": dur_min
                })

        return edges

    def plan_journey_alternatives(
        self,
        origin_query: str,
        dest_query: str,
        service_category: str = "ALL",
        mode: str = "fastest",
        max_alternatives: int = 5
    ) -> Dict[str, Any]:
        """
        Discover multiple useful bus journey alternatives:
        1. Direct routes connecting origin and destination (0 transfers)
        2. 1-transfer connections via verified interchange stops
        3. Multi-transfer alternatives via Dijkstra pathfinding fallback
        All ranked meaningfully with full commuter metrics and strictly service-filtered.
        """
        origin_ids = self.find_stop_ids(origin_query)
        dest_ids = self.find_stop_ids(dest_query)

        if not origin_ids:
            return {
                "success": False,
                "error": f"Origin stop '{origin_query}' could not be identified in BMTC records.",
                "code": "ORIGIN_NOT_FOUND"
            }
        if not dest_ids:
            return {
                "success": False,
                "error": f"Destination stop '{dest_query}' could not be identified in BMTC records.",
                "code": "DEST_NOT_FOUND"
            }

        # Check if origin and destination are identical
        if set(origin_ids) & set(dest_ids):
            return {
                "success": False,
                "error": "Source and destination are the same transit stop.",
                "code": "IDENTICAL_STOPS"
            }

        orig_names = set(self.stops[s]["name"] for s in origin_ids if s in self.stops)
        dest_names = set(self.stops[s]["name"] for s in dest_ids if s in self.stops)

        # Service filtering set
        svc_filter = (service_category or "ALL").strip().lower()
        if svc_filter in ["vajra", "ac"]:
            allowed_services = {SERVICE_VAJRA, SERVICE_VAYU_VAJRA}
        elif svc_filter == "ordinary":
            allowed_services = {SERVICE_ORDINARY}
        else:
            allowed_services = {SERVICE_ORDINARY, SERVICE_VAJRA, SERVICE_VAYU_VAJRA}

        # -------------------------------------------------------------
        # STAGE 1: Discover Direct Bus Routes (0 transfers)
        # -------------------------------------------------------------
        direct_journeys: List[Dict[str, Any]] = []
        seen_direct_base_routes = set()

        orig_side_routes: Dict[str, Tuple[int, str, Dict[str, Any]]] = {}
        dest_side_routes: Dict[str, Tuple[int, str, Dict[str, Any]]] = {}

        for rname, rinfo in self.routes.items():
            r_service = rinfo.get("service")
            if r_service not in allowed_services:
                continue

            stops = rinfo.get("stops", [])
            u_idx: Optional[int] = None
            v_idx: Optional[int] = None
            u_name_matched: Optional[str] = None
            v_name_matched: Optional[str] = None

            for idx, sname in enumerate(stops):
                if u_idx is None and sname in orig_names:
                    u_idx = idx
                    u_name_matched = sname
                if sname in dest_names:
                    v_idx = idx
                    v_name_matched = sname

            # Record origin-side and dest-side for transfer matching
            if u_idx is not None and u_name_matched:
                orig_side_routes[rname] = (u_idx, u_name_matched, rinfo)
            if v_idx is not None and v_name_matched:
                dest_side_routes[rname] = (v_idx, v_name_matched, rinfo)

            # Direct route condition: origin appears before destination in sequence
            if u_idx is not None and v_idx is not None and u_idx < v_idx:
                base_name = rname.split()[0]
                if base_name in seen_direct_base_routes:
                    continue
                seen_direct_base_routes.add(base_name)

                sub_stops = stops[u_idx:v_idx + 1]
                edges = self._build_path_edges_from_stops(
                    sub_stops,
                    rname,
                    rinfo.get("id", rname),
                    rinfo.get("direction_id", 0),
                    r_service
                )

                if edges:
                    journey = self._format_journey_result(
                        edges,
                        u_name_matched or origin_query,
                        v_name_matched or dest_query,
                        service_category,
                        mode
                    )
                    if journey.get("success"):
                        journey["transfers"] = 0
                        journey["transfer_type"] = "Direct Journey"
                        journey["transfer_badge_class"] = "badge-direct"
                        journey["transfer_stop"] = None
                        journey["route_label"] = f"Route {rname}"
                        journey["boarding_stop"] = sub_stops[0]
                        journey["destination_stop"] = sub_stops[-1]
                        journey["stop_count"] = v_idx - u_idx
                        journey["measurement_method"] = "Street Route (Detour-Adjusted Haversine)"
                        direct_journeys.append(journey)

        # Sort direct routes by duration
        direct_journeys.sort(key=lambda j: j["total_duration_min"])

        # -------------------------------------------------------------
        # STAGE 2: Discover 1-Transfer Journeys via Valid Interchanges
        # -------------------------------------------------------------
        one_transfer_journeys: List[Dict[str, Any]] = []
        seen_transfer_pairs = set()

        for r1_name, (u1_idx, u1_name, r1_info) in list(orig_side_routes.items())[:60]:
            r1_stops = r1_info.get("stops", [])
            # Stops visited after origin on Route 1
            r1_stops_after = {sname: idx for idx, sname in enumerate(r1_stops[u1_idx + 1:], u1_idx + 1)}

            for r2_name, (v2_idx, v2_name, r2_info) in list(dest_side_routes.items())[:60]:
                if r1_name == r2_name:
                    continue
                r2_stops = r2_info.get("stops", [])
                # Stops visited before destination on Route 2
                r2_stops_before = {sname: idx for idx, sname in enumerate(r2_stops[:v2_idx])}

                # Interchange candidate stops
                common_stops = set(r1_stops_after.keys()) & set(r2_stops_before.keys())
                # Exclude trivial transfers at origin or destination
                common_stops = [s for s in common_stops if s not in orig_names and s not in dest_names]

                if not common_stops:
                    continue

                # Pick the best interchange stop (midway)
                for x_stop in list(common_stops)[:1]:
                    pair_key = (r1_name.split()[0], r2_name.split()[0])
                    if pair_key in seen_transfer_pairs:
                        continue
                    seen_transfer_pairs.add(pair_key)

                    x1_idx = r1_stops_after[x_stop]
                    x2_idx = r2_stops_before[x_stop]

                    leg1_stops = r1_stops[u1_idx:x1_idx + 1]
                    leg2_stops = r2_stops[x2_idx:v2_idx + 1]

                    edges_leg1 = self._build_path_edges_from_stops(
                        leg1_stops,
                        r1_name,
                        r1_info.get("id", r1_name),
                        r1_info.get("direction_id", 0),
                        r1_info.get("service", SERVICE_ORDINARY)
                    )
                    edges_leg2 = self._build_path_edges_from_stops(
                        leg2_stops,
                        r2_name,
                        r2_info.get("id", r2_name),
                        r2_info.get("direction_id", 0),
                        r2_info.get("service", SERVICE_ORDINARY)
                    )

                    combined_edges = edges_leg1 + edges_leg2
                    if combined_edges:
                        journey = self._format_journey_result(
                            combined_edges,
                            u1_name,
                            v2_name,
                            service_category,
                            mode
                        )
                        if journey.get("success"):
                            journey["transfers"] = 1
                            journey["transfer_type"] = "1-Transfer Journey"
                            journey["transfer_badge_class"] = "badge-transfer"
                            journey["transfer_stop"] = x_stop
                            journey["route_label"] = f"Route {r1_name} ➔ Route {r2_name}"
                            journey["boarding_stop"] = u1_name
                            journey["destination_stop"] = v2_name
                            journey["stop_count"] = (x1_idx - u1_idx) + (v2_idx - x2_idx)
                            journey["measurement_method"] = "Street Route (Detour-Adjusted Haversine)"
                            one_transfer_journeys.append(journey)
                    break

        # Sort 1-transfer routes by total duration
        one_transfer_journeys.sort(key=lambda j: j["total_duration_min"])

        # -------------------------------------------------------------
        # STAGE 3: Merge, Rank, and Fallback
        # -------------------------------------------------------------
        alternatives: List[Dict[str, Any]] = []

        # Top direct options (up to 3)
        alternatives.extend(direct_journeys[:3])

        # Top 1-transfer options (up to 3)
        alternatives.extend(one_transfer_journeys[:3])

        # If still fewer than 2 alternatives, run Dijkstra single-source fallback
        if len(alternatives) < 2:
            dijkstra_res = self.plan_journey_dijkstra(
                origin_query,
                dest_query,
                service_category=service_category,
                mode=mode,
                max_transfers=3
            )
            if dijkstra_res.get("success"):
                d_routes = set(dijkstra_res.get("route_numbers", []))
                # Add if not duplicate
                is_duplicate = any(set(alt.get("route_numbers", [])) == d_routes for alt in alternatives)
                if not is_duplicate:
                    d_transfers = dijkstra_res.get("transfers", 0)
                    dijkstra_res["transfer_type"] = (
                        "Direct Journey" if d_transfers == 0 else
                        ("1-Transfer Journey" if d_transfers == 1 else "Multi-Transfer Journey")
                    )
                    dijkstra_res["transfer_badge_class"] = (
                        "badge-direct" if d_transfers == 0 else
                        ("badge-transfer" if d_transfers == 1 else "badge-multi-transfer")
                    )
                    dijkstra_res["measurement_method"] = "Street Route (Detour-Adjusted Haversine)"
                    alternatives.append(dijkstra_res)

        if not alternatives:
            if (service_category or "").strip().lower() in ["vajra", "ac"]:
                return {
                    "success": False,
                    "code": "NO_AC_ROUTE",
                    "error": "No direct or connecting AC Vajra service is currently available for this journey.",
                    "suggestion": "Ordinary BMTC services connect this route. Would you like to view BMTC alternatives?",
                    "origin": origin_query,
                    "destination": dest_query
                }
            return {
                "success": False,
                "code": "NO_PATH_FOUND",
                "error": f"No connected public transport route found between '{origin_query}' and '{dest_query}' within transfer limits.",
                "origin": origin_query,
                "destination": dest_query
            }

        # Rank: 0-transfer first, then 1-transfer, then by duration
        alternatives.sort(key=lambda j: (j.get("transfers", 0), j.get("total_duration_min", 9999)))
        alternatives = alternatives[:max_alternatives]

        for idx, alt in enumerate(alternatives):
            alt["alternative_id"] = f"alt-{idx + 1}"
            alt["rank"] = idx + 1

        primary = alternatives[0]
        result = dict(primary)
        result["alternatives"] = alternatives
        result["total_alternatives"] = len(alternatives)
        result["primary_journey"] = primary
        return result

    def plan_journey(
        self,
        origin_query: str,
        dest_query: str,
        service_category: str = "ALL",  # "ALL", "Ordinary", "Vajra"
        mode: str = "fastest",           # "fastest" or "shortest"
        max_transfers: int = 3
    ) -> Dict[str, Any]:
        """Backward-compatible entry point returning primary journey and full alternatives array."""
        return self.plan_journey_alternatives(
            origin_query=origin_query,
            dest_query=dest_query,
            service_category=service_category,
            mode=mode,
            max_alternatives=5
        )

    def plan_journey_dijkstra(
        self,
        origin_query: str,
        dest_query: str,
        service_category: str = "ALL",  # "ALL", "Ordinary", "Vajra"
        mode: str = "fastest",           # "fastest" or "shortest"
        max_transfers: int = 3
    ) -> Dict[str, Any]:
        """Dijkstra shortest path algorithm for exact shortest route calculation."""
        """
        Dijkstra multi-modal pathfinding engine with transfer penalties and leg aggregation.
        """
        origin_ids = self.find_stop_ids(origin_query)
        dest_ids = self.find_stop_ids(dest_query)

        if not origin_ids:
            return {
                "success": False,
                "error": f"Origin stop '{origin_query}' could not be identified in BMTC records.",
                "code": "ORIGIN_NOT_FOUND"
            }
        if not dest_ids:
            return {
                "success": False,
                "error": f"Destination stop '{dest_query}' could not be identified in BMTC records.",
                "code": "DEST_NOT_FOUND"
            }

        # Check if origin and destination are identical
        if set(origin_ids) & set(dest_ids):
            return {
                "success": False,
                "error": "Source and destination are the same transit stop.",
                "code": "IDENTICAL_STOPS"
            }

        dest_id_set = set(dest_ids)

        # Priority Queue: (cost, current_stop_id, current_route, transfer_count)
        # Cost is duration_minutes if mode=='fastest', else distance_km
        pq: List[Tuple[float, str, Optional[str], int]] = []
        
        # distances/durations store: (stop_id, current_route) -> best_cost
        best_costs: Dict[Tuple[str, Optional[str]], float] = {}
        # Predecessor mapping: (stop_id, current_route) -> (prev_stop_id, prev_route, edge_data)
        predecessors: Dict[Tuple[str, Optional[str]], Tuple[Optional[str], Optional[str], Optional[Dict[str, Any]]]] = {}

        for orig_id in origin_ids:
            best_costs[(orig_id, None)] = 0.0
            heapq.heappush(pq, (0.0, orig_id, None, 0))

        target_state: Optional[Tuple[str, Optional[str]]] = None
        min_total_cost = float('inf')

        # Run Dijkstra
        while pq:
            cost, u_id, current_route, transfers = heapq.heappop(pq)

            if cost > best_costs.get((u_id, current_route), float('inf')):
                continue

            if u_id in dest_id_set:
                target_state = (u_id, current_route)
                min_total_cost = cost
                break

            for edge in self.adjacency.get(u_id, []):
                v_id = edge["to_stop_id"]
                edge_route = edge["route_name"]
                edge_service = edge["service"]
                edge_dist = edge["distance_km"]
                edge_dur = edge["duration_min"]

                # Service filtering (strict: no mixing, Unknown routes never silently included)
                svc_cat = (service_category or "ALL").strip().lower()
                if svc_cat in ["vajra", "ac"]:
                    if edge_service not in [SERVICE_VAJRA, SERVICE_VAYU_VAJRA]:
                        continue
                elif svc_cat == "ordinary":
                    if edge_service != SERVICE_ORDINARY:
                        continue

                # Transfer evaluation
                is_transfer = (current_route is not None and edge_route != current_route)
                new_transfers = transfers + (1 if is_transfer else 0)

                if new_transfers > max_transfers:
                    continue

                if mode == "fastest":
                    step_cost = edge_dur + (TRANSFER_PENALTY_MINUTES if is_transfer else 0.0)
                else: # "shortest"
                    step_cost = edge_dist + (TRANSFER_PENALTY_KM if is_transfer else 0.0)

                new_cost = cost + step_cost
                next_state = (v_id, edge_route)

                if new_cost < best_costs.get(next_state, float('inf')):
                    best_costs[next_state] = new_cost
                    predecessors[next_state] = (u_id, current_route, edge)
                    heapq.heappush(pq, (new_cost, v_id, edge_route, new_transfers))

        if target_state is None:
            # Check if AC Vajra fallback should be indicated
            if (service_category or "").strip().lower() in ["vajra", "ac"]:
                return {
                    "success": False,
                    "code": "NO_AC_ROUTE",
                    "error": "No direct or connecting AC Vajra service is currently available for this journey.",
                    "suggestion": "Ordinary BMTC services connect this route. Would you like to view BMTC alternatives?",
                    "origin": origin_query,
                    "destination": dest_query
                }
            return {
                "success": False,
                "code": "NO_PATH_FOUND",
                "error": f"No connected public transport route found between '{origin_query}' and '{dest_query}' within transfer limits.",
                "origin": origin_query,
                "destination": dest_query
            }

        # Backtrack path
        path_edges: List[Dict[str, Any]] = []
        curr = target_state

        while curr in predecessors:
            prev_u, prev_route, edge_data = predecessors[curr]
            if edge_data is None:
                break
            path_edges.append(edge_data)
            curr = (prev_u, prev_route)

        path_edges.reverse()

        # Build journey legs and timeline
        return self._format_journey_result(path_edges, origin_query, dest_query, service_category, mode)

    def _format_journey_result(
        self,
        path_edges: List[Dict[str, Any]],
        origin_query: str,
        dest_query: str,
        service_category: str,
        mode: str
    ) -> Dict[str, Any]:
        """Aggregate edges into intuitive commuter legs and step-by-step itinerary."""
        if not path_edges:
            return {"success": False, "error": "Empty path extracted"}

        legs = []
        current_leg: Optional[Dict[str, Any]] = None

        total_distance = 0.0
        total_duration = 0.0
        all_stops_seq = []
        all_coords = []

        first_stop_name = origin_query
        # First stop metadata
        first_sid = path_edges[0]["route_id"] # will resolve via origin
        
        for i, edge in enumerate(path_edges):
            total_distance += edge["distance_km"]
            total_duration += edge["duration_min"]

            # Edge from stop name
            to_name = edge["to_stop_name"]
            to_sid = edge["to_stop_id"]
            to_stop_meta = self.stops.get(to_sid, {})
            to_lat = to_stop_meta.get("lat")
            to_lng = to_stop_meta.get("lng")

            if to_lat is not None and to_lng is not None:
                all_coords.append([to_lat, to_lng])

            if current_leg is None or edge["route_name"] != current_leg["route_name"]:
                if current_leg is not None:
                    legs.append(current_leg)
                    # Add transfer wait time
                    total_duration += TRANSFER_PENALTY_MINUTES

                current_leg = {
                    "leg_number": len(legs) + 1,
                    "route_name": edge["route_name"],
                    "route_id": edge["route_id"],
                    "service": edge["service"],
                    "direction_id": edge["direction_id"],
                    "board_stop": path_edges[i-1]["to_stop_name"] if i > 0 else origin_query,
                    "alight_stop": to_name,
                    "intermediate_stops": [],
                    "stop_count": 1,
                    "distance_km": round(edge["distance_km"], 2),
                    "duration_min": round(edge["duration_min"], 1),
                    "path_coordinates": []
                }
                if to_lat is not None and to_lng is not None:
                    current_leg["path_coordinates"].append([to_lat, to_lng])
            else:
                current_leg["alight_stop"] = to_name
                current_leg["intermediate_stops"].append(to_name)
                current_leg["stop_count"] += 1
                current_leg["distance_km"] = round(current_leg["distance_km"] + edge["distance_km"], 2)
                current_leg["duration_min"] = round(current_leg["duration_min"] + edge["duration_min"], 1)
                if to_lat is not None and to_lng is not None:
                    current_leg["path_coordinates"].append([to_lat, to_lng])

            all_stops_seq.append(to_name)

        if current_leg is not None:
            legs.append(current_leg)

        transfers = len(legs) - 1

        # Calculate estimated stages for fare
        # In BMTC, ~2 km = 1 stage
        stages_approx = max(1, math.ceil(total_distance / 2.0))

        return {
            "success": True,
            "origin": origin_query,
            "destination": dest_query,
            "mode": mode,
            "service_category": service_category,
            "total_distance_km": round(total_distance, 2),
            "total_duration_min": round(total_duration, 0),
            "transfers": transfers,
            "stages": stages_approx,
            "legs": legs,
            "route_numbers": [leg["route_name"] for leg in legs],
            "full_stop_sequence": all_stops_seq,
            "map_polyline": all_coords
        }

    def estimate_distance_between_stops(self, origin_query: str, dest_query: str) -> Optional[float]:
        """
        Estimate transit distance between two stops based on geocoded coordinates,
        incorporating Bangalore's urban road detour factor (1.25).
        """
        origin_ids = self.find_stop_ids(origin_query)
        dest_ids = self.find_stop_ids(dest_query)
        if not origin_ids or not dest_ids:
            return None
        o = self.stops.get(origin_ids[0])
        d = self.stops.get(dest_ids[0])
        if not o or not d or not o.get('lat') or not d.get('lat'):
            return None
        import math
        R = 6371.0
        lat1, lon1 = math.radians(o['lat']), math.radians(o['lng'])
        lat2, lon2 = math.radians(d['lat']), math.radians(d['lng'])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        dist_km = round(R * c * 1.25, 1)
        return max(1.5, dist_km)

# Global singleton router instance
_router_instance: Optional[TransitRouter] = None

def get_router() -> TransitRouter:
    global _router_instance
    if _router_instance is None:
        _router_instance = TransitRouter()
    return _router_instance
