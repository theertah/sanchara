import uuid
import datetime
from typing import Dict, Any, Optional

class FareEngine:
    """
    Official multi-schedule BMTC fare engine implementing:
    1. Ordinary Services
    2. Vajra Services (AC Volvo)
    3. Vayu Vajra (Airport Services)
    4. Mofussil Outskirts
    5. NICE Road Express Services
    """

    @staticmethod
    def calculate_ordinary_fare(stages: int) -> int:
        if stages <= 1:
            return 5
        elif stages <= 2:
            return 10
        elif stages <= 4:
            return 15
        elif stages <= 6:
            return 20
        elif stages <= 9:
            return 25
        elif stages <= 14:
            return 30
        else:
            return 35

    @staticmethod
    def calculate_vajra_fare(stages: int) -> int:
        if stages <= 1:
            return 10
        elif stages <= 2:
            return 15
        elif stages <= 3:
            return 20
        elif stages <= 5:
            return 25
        elif stages <= 8:
            return 30
        elif stages <= 11:
            return 35
        elif stages <= 15:
            return 40
        else:
            return 45

    @staticmethod
    def calculate_vayu_vajra_fare(distance_km: float) -> int:
        if distance_km <= 5.0:
            return 60
        elif distance_km <= 15.0:
            return 120
        elif distance_km <= 25.0:
            return 180
        elif distance_km <= 35.0:
            return 240
        elif distance_km <= 45.0:
            return 280
        else:
            return 320

    @staticmethod
    def calculate_mofussil_fare(stages: int) -> int:
        if stages <= 2:
            return 7
        elif stages <= 4:
            return 12
        elif stages <= 6:
            return 18
        elif stages <= 9:
            return 24
        elif stages <= 13:
            return 30
        else:
            return 38

    @staticmethod
    def calculate_nice_road_fare(base_fare: int) -> int:
        toll_surcharge = 30
        return base_fare + toll_surcharge

    def compute_fare(
        self,
        service: str,
        distance_km: float,
        stages: Optional[int] = None,
        passenger_count: int = 1,
        concession: str = "General", # "General", "Senior", "Child", "Student", "DailyPass"
        include_gst: bool = True
    ) -> Dict[str, Any]:
        """Compute fare breakdown according to official BMTC stage formulas."""
        if stages is None or stages <= 0:
            # Stage length is roughly 2.0 km in BMTC network
            stages = max(1, int(round(distance_km / 2.0)))

        svc_clean = service.strip()
        is_ac = "Vajra" in svc_clean or "AC" in svc_clean

        base_unit_fare = 0
        schedule_name = "BMTC Ordinary City Service"
        gst_amount = 0.0

        if "Vayu Vajra" in svc_clean or "Airport" in svc_clean:
            schedule_name = "Vayu Vajra (KIA Airport Express)"
            base_unit_fare = self.calculate_vayu_vajra_fare(distance_km)
            if include_gst:
                gst_amount = round(base_unit_fare * 0.05, 2)
        elif "Vajra" in svc_clean or "Volvo" in svc_clean:
            schedule_name = "Vajra AC Volvo City Service"
            base_unit_fare = self.calculate_vajra_fare(stages)
            if include_gst:
                gst_amount = round(base_unit_fare * 0.05, 2)
        elif "NICE" in svc_clean:
            schedule_name = "NICE Road Express Service (with Toll Surcharge)"
            ord_base = self.calculate_ordinary_fare(stages)
            base_unit_fare = self.calculate_nice_road_fare(ord_base)
        elif "Mofussil" in svc_clean:
            schedule_name = "BMTC Mofussil Sub-Urban Schedule"
            base_unit_fare = self.calculate_mofussil_fare(stages)
        else:
            schedule_name = "BMTC Ordinary City Service"
            base_unit_fare = self.calculate_ordinary_fare(stages)

        # Concessions
        discount_pct = 0.0
        concession_desc = "Standard Adult Tariff"

        if concession == "DailyPass":
            pass_price = 120 if is_ac else 70
            return {
                "service": service,
                "schedule_name": schedule_name,
                "stages": stages,
                "distance_km": distance_km,
                "passenger_count": passenger_count,
                "concession": "Daily Transit Pass",
                "unit_fare": pass_price,
                "gst": 0.0,
                "total_fare": pass_price * passenger_count,
                "pass_type": "Vajra Gold Pass" if is_ac else "Ordinary Daily Pass",
                "validity": "Full Day until 23:59 IST"
            }
        elif concession == "Senior":
            discount_pct = 0.25
            concession_desc = "Senior Citizen Concession (25% off)"
        elif concession == "Child":
            discount_pct = 0.50
            concession_desc = "Child Fare (5-12 yrs, 50% off)"
        elif concession == "Student":
            # Ordinary travel is free with valid BMTC pass, Vajra 50%
            if not is_ac:
                discount_pct = 1.0
                concession_desc = "BMTC Student Transit Pass (100% off)"
            else:
                discount_pct = 0.50
                concession_desc = "Student AC Concession (50% off)"

        unit_discount = round(base_unit_fare * discount_pct, 2)
        final_unit_fare = max(0, round(base_unit_fare - unit_discount + gst_amount))
        total_fare = final_unit_fare * passenger_count

        return {
            "service": service,
            "schedule_name": schedule_name,
            "stages": stages,
            "distance_km": round(distance_km, 2),
            "base_unit_fare": base_unit_fare,
            "concession_type": concession,
            "concession_desc": concession_desc,
            "unit_discount": unit_discount,
            "gst_unit": gst_amount,
            "final_unit_fare": final_unit_fare,
            "passenger_count": passenger_count,
            "total_fare": total_fare,
            "smart_card_saving": round(total_fare * 0.05, 2) # 5% extra discount on BMTC smart cards
        }

    def generate_simulated_ticket(
        self,
        origin: str,
        destination: str,
        routes: list,
        service: str,
        total_fare: int,
        passenger_count: int = 1,
        payment_method: str = "UPI"
    ) -> Dict[str, Any]:
        """Generate simulated digital m-Ticket with QR data and verification token."""
        ticket_id = f"BMTC-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.datetime.now()
        expiry = now + datetime.timedelta(hours=2)

        return {
            "ticket_id": ticket_id,
            "issued_at": now.strftime("%d %b %Y, %I:%M %p"),
            "valid_until": expiry.strftime("%d %b %Y, %I:%M %p"),
            "status": "ACTIVE / VALID",
            "origin": origin,
            "destination": destination,
            "routes": routes,
            "service": service,
            "passenger_count": passenger_count,
            "fare_paid": total_fare,
            "payment_method": payment_method,
            "transaction_ref": f"TXN-SIM-{uuid.uuid4().hex[:8].upper()}",
            "qr_payload": f"SANCHARA|BMTC|{ticket_id}|{routes}|{total_fare}|{expiry.isoformat()}"
        }

# Global singleton
_fare_engine_instance = None
def get_fare_engine() -> FareEngine:
    global _fare_engine_instance
    if _fare_engine_instance is None:
        _fare_engine_instance = FareEngine()
    return _fare_engine_instance
