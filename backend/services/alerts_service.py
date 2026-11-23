import sqlite3
import json
from typing import Dict, List, Any, Optional

from backend.config import SQLITE_DB_PATH

class AlertsService:
    @staticmethod
    def get_active_alerts(category: Optional[str] = None, route_no: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()

        query = "SELECT id, title, category, severity, message, affected_routes, active_from, active_to, created_at FROM alerts WHERE 1=1"
        params = []

        if category and category != "ALL":
            query += " AND category = ?"
            params.append(category)

        query += " ORDER BY id DESC"
        cur.execute(query, params)
        rows = cur.fetchall()
        conn.close()

        alerts = []
        for r in rows:
            routes_list = []
            if r[5]:
                try:
                    routes_list = json.loads(r[5].replace("'", '"'))
                except Exception:
                    routes_list = [r[5]]

            if route_no and route_no not in routes_list and "ALL" not in routes_list:
                continue

            alerts.append({
                "id": r[0],
                "title": r[1],
                "category": r[2],
                "severity": r[3],
                "message": r[4],
                "affected_routes": routes_list,
                "active_from": r[6],
                "active_to": r[7],
                "created_at": r[8]
            })

        return alerts

    @staticmethod
    def create_alert(
        title: str,
        category: str,
        severity: str,
        message: str,
        affected_routes: list,
        active_from: str,
        active_to: str
    ) -> Dict[str, Any]:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        routes_json = json.dumps(affected_routes)

        cur.execute("""
            INSERT INTO alerts (title, category, severity, message, affected_routes, active_from, active_to)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (title, category, severity, message, routes_json, active_from, active_to))
        new_id = cur.lastrowid
        conn.commit()
        conn.close()

        return {"success": True, "alert_id": new_id, "message": "Alert published successfully"}

    @staticmethod
    def delete_alert(alert_id: int) -> bool:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM alerts WHERE id = ?", (alert_id,))
        conn.commit()
        conn.close()
        return True
