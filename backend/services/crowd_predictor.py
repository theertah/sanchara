import sqlite3
import datetime
from typing import Dict, Any, Optional

from backend.config import SQLITE_DB_PATH

class CrowdPredictor:
    """
    Real-Time Crowd Prediction Engine combining:
    1. Historical trip and route frequency from aggregated.csv / stops.csv
    2. Real-world Bangalore diurnal peak-hour traffic curve
    3. Live commuter crowdsourced reports stored in SQLite
    """

    @staticmethod
    def get_time_factor(hour: Optional[int] = None, minute: Optional[int] = None) -> float:
        if hour is None:
            now = datetime.datetime.now()
            hour = now.hour
            minute = now.minute

        time_val = hour + (minute / 60.0)

        # Diurnal BMTC commuter flow curve
        if 8.0 <= time_val <= 11.5:
            # Morning Office/College Peak
            return 1.85
        elif 16.5 <= time_val <= 20.5:
            # Evening Return Peak
            return 1.95
        elif 11.5 < time_val < 16.5:
            # Mid-day Normal
            return 1.05
        elif 20.5 < time_val <= 22.5:
            # Late evening taper
            return 0.85
        elif 5.0 <= time_val < 8.0:
            # Early morning build-up
            return 0.75
        else:
            # Night service
            return 0.40

    def predict_crowd(self, stop_id_or_name: str, route_no: Optional[str] = None) -> Dict[str, Any]:
        """Generate crowd index (0-100), categorization, and seat availability estimate."""
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()

        # Query stop activity
        cur.execute("""
            SELECT name, route_count, trip_count FROM stops
            WHERE id = ? OR name = ? OR normalized_name = ?
            LIMIT 1
        """, (stop_id_or_name, stop_id_or_name, stop_id_or_name.lower().replace(' ', '')))
        row = cur.fetchone()

        stop_name = stop_id_or_name
        route_count = 5
        trip_count = 20

        if row:
            stop_name, route_count, trip_count = row[0], row[1] or 5, row[2] or 20

        # Query recent live reports in the last 2 hours
        recent_reports = []
        try:
            cur.execute("""
                SELECT crowd_level FROM crowd_reports
                WHERE (stop_id = ? OR stop_name = ? OR route_no = ?)
                AND reported_at >= datetime('now', '-2 hours')
                ORDER BY reported_at DESC LIMIT 5
            """, (stop_id_or_name, stop_name, route_no or ''))
            recent_reports = [r[0] for r in cur.fetchall()]
        except Exception:
            pass

        conn.close()

        # Base stop intensity (normalized 0 to 40)
        base_intensity = min(40.0, (trip_count / 15.0) + (route_count * 0.8))

        # Time multiplier
        time_factor = self.get_time_factor()

        calculated_index = base_intensity * time_factor

        # Incorporate user reports if present
        if recent_reports:
            weight_map = {"Low": 25, "Moderate": 55, "High": 85, "Full": 98}
            reported_avg = sum(weight_map.get(r, 50) for r in recent_reports) / len(recent_reports)
            # Blend 60% dynamic report + 40% model
            calculated_index = (reported_avg * 0.6) + (calculated_index * 0.4)

        score = max(10, min(99, int(round(calculated_index))))

        if score < 35:
            level = "Low"
            status_text = "Seats Readily Available"
            color = "#2E7D32" # Forest Green
            badge_class = "crowd-low"
            advice = "Ideal time to board. High likelihood of getting a window seat."
        elif score < 65:
            level = "Moderate"
            status_text = "Comfortable / Standing Space Available"
            color = "#F57C00" # Warm Amber
            badge_class = "crowd-mod"
            advice = "Moderate occupancy. Few seats open, plenty of comfortable standing area."
        elif score < 85:
            level = "High"
            status_text = "Crowded / Peak Commuter Rush"
            color = "#D97662" # Brand Coral
            badge_class = "crowd-high"
            advice = "High passenger volume. Board from rear doors; consider taking the next bus if carrying large luggage."
        else:
            level = "Critical / Full"
            status_text = "Bus Running at Full Capacity"
            color = "#C62828" # Deep Crimson
            badge_class = "crowd-critical"
            advice = "Peak saturation. Boarding may be restricted. Recommend waiting 5-8 mins for trailing bus."

        now = datetime.datetime.now()
        return {
            "stop_name": stop_name,
            "route_no": route_no or "General Corridor",
            "crowd_index": score,
            "crowd_level": level,
            "status_text": status_text,
            "advice": advice,
            "color": color,
            "badge_class": badge_class,
            "peak_period": "Morning Peak" if (8 <= now.hour <= 11) else ("Evening Peak" if (16 <= now.hour <= 20) else "Regular Service"),
            "recent_commuter_reports_count": len(recent_reports)
        }

    def record_commuter_report(self, stop_name: str, route_no: str, crowd_level: str) -> bool:
        """Store crowdsourced commuter observation."""
        try:
            conn = sqlite3.connect(SQLITE_DB_PATH)
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO crowd_reports (stop_id, stop_name, route_no, crowd_level)
                VALUES (?, ?, ?, ?)
            """, (stop_name, stop_name, route_no, crowd_level))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"[CrowdPredictor] Error recording report: {e}")
            return False

# Global singleton
_crowd_predictor_instance = None
def get_crowd_predictor() -> CrowdPredictor:
    global _crowd_predictor_instance
    if _crowd_predictor_instance is None:
        _crowd_predictor_instance = CrowdPredictor()
    return _crowd_predictor_instance
