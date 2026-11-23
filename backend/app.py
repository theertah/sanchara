import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from backend.config import (
    FRONTEND_DIR, GEOCODED_STOPS_JSON, NETWORK_LINES_JSON, VALIDATION_REPORT_JSON
)
from backend.services.dijkstra import get_router
from backend.services.fare_engine import get_fare_engine
from backend.services.crowd_predictor import get_crowd_predictor
from backend.services.alerts_service import AlertsService
from backend.services.complaints_service import ComplaintsService

app = Flask(__name__, static_folder=FRONTEND_DIR)
CORS(app)

# Pre-load services
router = get_router()
fare_engine = get_fare_engine()
crowd_predictor = get_crowd_predictor()

# ==========================================
# PAGE ROUTING & STATIC ASSET DELIVERY
# ==========================================

@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/bmtc/')
@app.route('/bmtc/index.html')
def serve_bmtc_selection():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'bmtc'), 'index.html')

@app.route('/bmtc/dashboard')
@app.route('/bmtc/dashboard.html')
def serve_bmtc_dashboard():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'bmtc'), 'dashboard.html')

@app.route('/bmtc/admin')
@app.route('/bmtc/admin.html')
def serve_bmtc_admin():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'bmtc'), 'admin.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)

# ==========================================
# CORE BMTC API ENDPOINTS
# ==========================================

@app.route('/api/health', methods=['GET'])
def api_health():
    val_report = {}
    if os.path.exists(VALIDATION_REPORT_JSON):
        try:
            with open(VALIDATION_REPORT_JSON, 'r', encoding='utf-8') as f:
                val_report = json.load(f)
        except Exception:
            pass
    return jsonify({
        "status": "healthy",
        "service": "SANCHARA - BMTC Intelligent Transit Engine",
        "validation_report": val_report
    })

@app.route('/api/stops/search', methods=['GET'])
def search_stops():
    query = request.args.get('q', '').strip().lower()
    if not query or len(query) < 2:
        return jsonify([])

    results = []
    seen_names = set()
    for name, ids in router.name_to_ids.items():
        if query in name.lower():
            if name in seen_names:
                continue
            seen_names.add(name)
            sid = ids[0]
            sinfo = router.stops.get(sid, {})
            results.append({
                "id": sid,
                "name": name,
                "lat": sinfo.get("lat"),
                "lng": sinfo.get("lng"),
                "route_count": sinfo.get("route_count", 0),
                "routes": sinfo.get("routes", [])[:10]
            })
            if len(results) >= 15:
                break

    return jsonify(results)

@app.route('/api/stops/all', methods=['GET'])
def get_all_stops():
    """Return all geocoded stops for Leaflet map markers and clustering."""
    if os.path.exists(GEOCODED_STOPS_JSON):
        try:
            with open(GEOCODED_STOPS_JSON, 'r', encoding='utf-8') as f:
                stops_data = json.load(f)
            return jsonify(stops_data)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify({})

@app.route('/api/routes/network', methods=['GET'])
def get_network_lines():
    """Return full arterial bus route network polylines for Bangalore cartography."""
    if os.path.exists(NETWORK_LINES_JSON):
        try:
            with open(NETWORK_LINES_JSON, 'r', encoding='utf-8') as f:
                lines = json.load(f)
            return jsonify(lines)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify([])

@app.route('/api/plan-route', methods=['POST'])
@app.route('/api/plan-route-alternatives', methods=['POST'])
def plan_route():
    data = request.get_json() or {}
    origin = data.get('origin', '').strip()
    destination = data.get('destination', '').strip()
    service = data.get('service_category', 'ALL') # 'ALL', 'Ordinary', 'Vajra'
    mode = data.get('mode', 'fastest')            # 'fastest' or 'shortest'

    if not origin or not destination:
        return jsonify({"success": False, "error": "Both origin and destination stops are required."}), 400

    journey = router.plan_journey(origin, destination, service_category=service, mode=mode)

    if not journey.get("success"):
        return jsonify(journey)

    # Calculate fare estimate for each alternative journey
    for alt in journey.get("alternatives", []):
        alt_leg_svc = alt["legs"][0]["service"] if (alt.get("legs") and len(alt["legs"]) > 0) else service
        alt_eff_svc = alt_leg_svc if (service == "ALL" or alt_leg_svc in ["Vayu Vajra", "Vajra", "Ordinary"]) else service
        alt_fare = fare_engine.compute_fare(
            service=alt_eff_svc,
            distance_km=alt["total_distance_km"],
            stages=alt.get("stages")
        )
        alt["fare_breakdown"] = alt_fare
        alt["total_fare"] = alt_fare.get("total_fare", 20)

    # Calculate fare estimate for the primary journey
    leg_service = journey["legs"][0]["service"] if (journey.get("legs") and len(journey["legs"]) > 0) else service
    effective_service = leg_service if (service == "ALL" or leg_service in ["Vayu Vajra", "Vajra", "Ordinary"]) else service
    fare_info = fare_engine.compute_fare(
        service=effective_service,
        distance_km=journey["total_distance_km"],
        stages=journey["stages"]
    )
    journey["fare_breakdown"] = fare_info
    journey["total_fare"] = fare_info.get("total_fare", 20)

    # Calculate origin & transfer point crowd levels
    journey["crowd_analysis"] = {
        "origin_crowd": crowd_predictor.predict_crowd(origin, journey["legs"][0]["route_name"]),
        "destination_crowd": crowd_predictor.predict_crowd(destination)
    }

    return jsonify(journey)

@app.route('/api/calculate-fare', methods=['POST'])
def calculate_fare():
    data = request.get_json() or {}
    origin = data.get('origin', '').strip()
    destination = data.get('destination', '').strip()
    service = data.get('service', 'Ordinary')
    passenger_count = int(data.get('passenger_count', 1))
    concession = data.get('concession', 'General')

    distance_km = None
    stages = None

    if origin and destination:
        # Check if stops can be resolved to compute real transit distance
        dist = router.estimate_distance_between_stops(origin, destination)
        if dist:
            distance_km = dist
            stages = max(1, int(round(distance_km / 2.0)))

    if distance_km is None:
        try:
            distance_km = float(data.get('distance_km', 10.0))
        except (ValueError, TypeError):
            distance_km = 10.0
        stages = data.get('stages')

    result = fare_engine.compute_fare(
        service=service,
        distance_km=distance_km,
        stages=stages,
        passenger_count=passenger_count,
        concession=concession
    )

    # Comparative fares for Ordinary vs AC Volvo Vajra
    ord_calc = fare_engine.compute_fare(service="Ordinary", distance_km=distance_km, stages=stages, passenger_count=passenger_count, concession=concession)
    vaj_calc = fare_engine.compute_fare(service="Vajra", distance_km=distance_km, stages=stages, passenger_count=passenger_count, concession=concession)

    # Foreigner-friendly currency equivalents
    inr_total = result["total_fare"]
    usd_val = round(inr_total / 86.0, 2)
    eur_val = round(inr_total / 93.0, 2)
    gbp_val = round(inr_total / 110.0, 2)

    result["origin"] = origin
    result["destination"] = destination
    result["distance_km"] = distance_km
    result["comparison"] = {
        "ordinary_fare": ord_calc["total_fare"],
        "vajra_fare": vaj_calc["total_fare"]
    }
    result["foreigner_friendly"] = {
        "usd": f"${usd_val:.2f}",
        "eur": f"€{eur_val:.2f}",
        "gbp": f"£{gbp_val:.2f}",
        "summary": f"₹{inr_total} (approx ${usd_val:.2f} USD / €{eur_val:.2f} EUR)",
        "tourist_advice": "Conductors accept UPI / Google Pay QR scan or cash in ₹10/₹20/₹50 notes. Unlimited Day Pass available from conductor: ₹70 (Ordinary) / ₹120 (AC Volvo)."
    }
    return jsonify(result)

@app.route('/api/simulate-payment', methods=['POST'])
def simulate_payment():
    data = request.get_json() or {}
    origin = data.get('origin', 'Origin Stop')
    destination = data.get('destination', 'Destination Stop')
    routes = data.get('routes', ['Direct'])
    service = data.get('service', 'Ordinary')
    total_fare = int(data.get('total_fare', 25))
    passenger_count = int(data.get('passenger_count', 1))
    payment_method = data.get('payment_method', 'UPI')

    ticket = fare_engine.generate_simulated_ticket(
        origin=origin,
        destination=destination,
        routes=routes,
        service=service,
        total_fare=total_fare,
        passenger_count=passenger_count,
        payment_method=payment_method
    )
    return jsonify(ticket)

@app.route('/api/crowd', methods=['GET'])
def get_crowd():
    stop = request.args.get('stop', 'Kempegowda Bus Station(Majestic/KBS)')
    route = request.args.get('route')
    prediction = crowd_predictor.predict_crowd(stop, route)
    return jsonify(prediction)

@app.route('/api/crowd/report', methods=['POST'])
def report_crowd():
    data = request.get_json() or {}
    stop = data.get('stop_name', '')
    route = data.get('route_no', '')
    level = data.get('crowd_level', 'Moderate')

    if not stop:
        return jsonify({"success": False, "error": "Stop name is required"}), 400

    ok = crowd_predictor.record_commuter_report(stop, route, level)
    return jsonify({"success": ok, "message": "Thank you! Your feedback helps fellow Bangalore commuters."})

@app.route('/api/alerts', methods=['GET', 'POST'])
def manage_alerts():
    if request.method == 'GET':
        category = request.args.get('category')
        route_no = request.args.get('route')
        alerts = AlertsService.get_active_alerts(category, route_no)
        return jsonify(alerts)
    else:
        data = request.get_json() or {}
        title = data.get('title')
        category = data.get('category', 'General')
        severity = data.get('severity', 'Moderate')
        message = data.get('message', '')
        affected = data.get('affected_routes', ['ALL'])
        active_from = data.get('active_from', '')
        active_to = data.get('active_to', '')

        if not title or not message:
            return jsonify({"success": False, "error": "Title and message are required"}), 400

        res = AlertsService.create_alert(title, category, severity, message, affected, active_from, active_to)
        return jsonify(res)

@app.route('/api/alerts/<int:alert_id>', methods=['DELETE'])
def delete_alert(alert_id):
    ok = AlertsService.delete_alert(alert_id)
    return jsonify({"success": ok})

@app.route('/api/complaints', methods=['POST', 'GET'])
def handle_complaints():
    if request.method == 'POST':
        data = request.get_json() or {}
        commuter_name = data.get('commuter_name', 'Anonymous Commuter')
        contact = data.get('contact', '')
        service_type = data.get('service_type', 'Ordinary')
        route_no = data.get('route_no', 'Unspecified')
        bus_no = data.get('bus_no', 'Unspecified')
        category = data.get('category', 'Delay / Scheduling')
        description = data.get('description', '')

        if not description:
            return jsonify({"success": False, "error": "Description is required"}), 400

        res = ComplaintsService.file_complaint(
            commuter_name, contact, service_type, route_no, bus_no, category, description
        )
        return jsonify(res)
    else:
        # GET recent complaints for admin review
        recent = ComplaintsService.list_recent_complaints()
        return jsonify(recent)

@app.route('/api/complaints/<ticket_id>', methods=['GET', 'PATCH'])
def manage_single_complaint(ticket_id):
    if request.method == 'GET':
        record = ComplaintsService.track_complaint(ticket_id)
        if not record:
            return jsonify({"success": False, "error": "Grievance ticket not found"}), 404
        return jsonify({"success": True, "complaint": record})
    else:
        data = request.get_json() or {}
        new_status = data.get('status', 'Resolved')
        ComplaintsService.update_status(ticket_id, new_status)
        return jsonify({"success": True, "message": f"Ticket status updated to {new_status}"})

@app.route('/api/admin/metrics', methods=['GET'])
def get_admin_metrics():
    val_report = {}
    if os.path.exists(VALIDATION_REPORT_JSON):
        try:
            with open(VALIDATION_REPORT_JSON, 'r', encoding='utf-8') as f:
                val_report = json.load(f)
        except Exception:
            pass

    alerts = AlertsService.get_active_alerts()
    complaints = ComplaintsService.list_recent_complaints(50)

    return jsonify({
        "network": val_report,
        "active_alerts_count": len(alerts),
        "total_complaints_count": len(complaints),
        "pending_complaints_count": sum(1 for c in complaints if c.get('status') == 'Under Review')
    })

if __name__ == '__main__':
    print("[SANCHARA] BMTC transit server booting on http://127.0.0.1:5000 ...")
    app.run(host='0.0.0.0', port=5000, debug=False)
