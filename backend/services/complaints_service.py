import sqlite3
import uuid
import datetime
from typing import Dict, Any, Optional

from backend.config import SQLITE_DB_PATH

class ComplaintsService:
    @staticmethod
    def file_complaint(
        commuter_name: str,
        contact: str,
        service_type: str,
        route_no: str,
        bus_no: str,
        category: str,
        description: str
    ) -> Dict[str, Any]:
        """Generate official grievance ticket and store record."""
        ticket_id = f"BMTC-CMP-{datetime.datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:5].upper()}"

        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO complaints (
                ticket_id, commuter_name, contact, service_type,
                route_no, bus_no, category, description, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            ticket_id, commuter_name, contact, service_type,
            route_no, bus_no, category, description, "Under Review"
        ))
        conn.commit()
        conn.close()

        return {
            "success": True,
            "ticket_id": ticket_id,
            "status": "Under Review",
            "message": "Grievance lodged successfully. BMTC Grievance Cell has been notified.",
            "estimated_resolution": "48 Working Hours"
        }

    @staticmethod
    def track_complaint(ticket_id: str) -> Optional[Dict[str, Any]]:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            SELECT ticket_id, commuter_name, contact, service_type,
                   route_no, bus_no, category, description, status,
                   created_at, resolved_at
            FROM complaints WHERE ticket_id = ?
        """, (ticket_id.strip(),))
        row = cur.fetchone()
        conn.close()

        if not row:
            return None

        return {
            "ticket_id": row[0],
            "commuter_name": row[1],
            "contact": row[2],
            "service_type": row[3],
            "route_no": row[4],
            "bus_no": row[5],
            "category": row[6],
            "description": row[7],
            "status": row[8],
            "created_at": row[9],
            "resolved_at": row[10]
        }

    @staticmethod
    def list_recent_complaints(limit: int = 20) -> list:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            SELECT ticket_id, commuter_name, service_type, route_no, category, status, created_at
            FROM complaints ORDER BY created_at DESC LIMIT ?
        """, (limit,))
        rows = cur.fetchall()
        conn.close()

        return [
            {
                "ticket_id": r[0],
                "commuter_name": r[1],
                "service_type": r[2],
                "route_no": r[3],
                "category": r[4],
                "status": r[5],
                "created_at": r[6]
            }
            for r in rows
        ]

    @staticmethod
    def update_status(ticket_id: str, new_status: str) -> bool:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        resolved_at = datetime.datetime.now().isoformat() if new_status == "Resolved" else None
        cur.execute("""
            UPDATE complaints SET status = ?, resolved_at = ? WHERE ticket_id = ?
        """, (new_status, resolved_at, ticket_id))
        conn.commit()
        conn.close()
        return True
