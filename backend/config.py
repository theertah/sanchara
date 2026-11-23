import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(BASE_DIR, 'data')
RAW_DATA_DIR = os.path.join(DATA_DIR, 'raw')
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

# Data file paths
STOPS_CSV = os.path.join(RAW_DATA_DIR, 'stops.csv')
ROUTES_CSV = os.path.join(RAW_DATA_DIR, 'routes.csv')
AGGREGATED_CSV = os.path.join(RAW_DATA_DIR, 'aggregated.csv')
CLASSIFICATION_CSV = os.path.join(RAW_DATA_DIR, 'route_service_classification.csv')
OFFICIAL_GEO_CSV = os.path.join(RAW_DATA_DIR, 'official_bmtc_stops_geocoded.csv')
AC_BUSES_CSV = os.path.join(RAW_DATA_DIR, 'ac_buses.csv')
NON_AC_BUSES_CSV = os.path.join(RAW_DATA_DIR, 'non_ac_buses.csv')

# Preprocessed output paths
GEOCODED_STOPS_JSON = os.path.join(DATA_DIR, 'bmtc_stops_geocoded.json')
NETWORK_LINES_JSON = os.path.join(DATA_DIR, 'bmtc_network_lines.json')
TRANSPORT_GRAPH_JSON = os.path.join(DATA_DIR, 'transport_graph.json')
VALIDATION_REPORT_JSON = os.path.join(DATA_DIR, 'validation_report.json')
SQLITE_DB_PATH = os.path.join(DATA_DIR, 'sanchara.db')

# Service classification defaults
SERVICE_ORDINARY = 'Ordinary'
SERVICE_VAJRA = 'Vajra'
SERVICE_VAYU_VAJRA = 'Vayu Vajra'
SERVICE_MOFUSSIL = 'Mofussil'
SERVICE_NICE_ROAD = 'NICE Road'
SERVICE_UNKNOWN = 'Unknown'

# Transit modeling parameters
SPEED_KMH = {
    SERVICE_ORDINARY: 18.0,
    SERVICE_VAJRA: 22.0,
    SERVICE_VAYU_VAJRA: 30.0,
    SERVICE_MOFUSSIL: 24.0,
    SERVICE_NICE_ROAD: 38.0,
    SERVICE_UNKNOWN: 18.0
}
DEFAULT_DWELL_MIN = 1.0
ROAD_DETOUR_FACTOR = 1.25  # Haversine to urban street routing adjustment
TRANSFER_PENALTY_MINUTES = 12.0  # Average wait time between transfers
TRANSFER_PENALTY_KM = 0.5        # Distance equivalent penalty
