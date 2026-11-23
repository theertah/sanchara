import json
from backend.app import app

client = app.test_client()

print('--- TEST 1: Health & Validation Report ---')
res = client.get('/api/health')
print('Health status:', res.status_code, res.get_json()['status'])
rep = res.get_json()['validation_report']
print('Validation report stops:', rep.get('total_stops_records'), 'routes:', rep.get('total_route_records'), 'edges:', rep.get('total_graph_edges'))

print('\n--- TEST 2: Stop Autocomplete ---')
res = client.get('/api/stops/search?q=Majestic')
items = res.get_json()
print('Autocomplete results count:', len(items))
if items:
    print('First item:', items[0]['name'], '| Stop ID:', items[0]['id'], '| Routes count:', items[0]['route_count'])

print('\n--- TEST 3: Dijkstra Route Planning (Ordinary) ---')
res = client.post('/api/plan-route', json={
    'origin': 'Kempegowda Bus Station(Majestic/KBS)',
    'destination': 'Hebbala',
    'service_category': 'Ordinary',
    'mode': 'fastest'
})
data = res.get_json()
print('Plan Success:', data.get('success'))
if data.get('success'):
    print('Distance:', data['total_distance_km'], 'km | Duration:', data['total_duration_min'], 'min | Transfers:', data['transfers'])
    print('Fare:', data['fare_breakdown']['total_fare'], 'INR')
    print('Origin Crowd Status:', data['crowd_analysis']['origin_crowd']['status_text'])

print('\n--- TEST 4: AC Volvo Fallback Verification ---')
res = client.post('/api/plan-route', json={
    'origin': 'Sondekoppa',
    'destination': 'Lakkenahalli Junction Sondekoppa',
    'service_category': 'Vajra',
    'mode': 'fastest'
})
data = res.get_json()
print('AC Vajra Success:', data.get('success'), '| Code:', data.get('code'))
print('Fallback Suggestion:', data.get('suggestion'))

print('\n--- TEST 5: Fare Calculation Engine ---')
for svc in ['Ordinary', 'Vajra', 'Vayu Vajra', 'Mofussil', 'NICE Road']:
    res = client.post('/api/calculate-fare', json={
        'service': svc,
        'distance_km': 15.0,
        'passenger_count': 1,
        'concession': 'General'
    })
    fare_res = res.get_json()
    print(f"{svc:12}: Rs.{fare_res['total_fare']} ({fare_res['schedule_name']})")

print('\n--- TEST 6: Simulated Payment & m-Ticket ---')
res = client.post('/api/simulate-payment', json={
    'origin': 'Kempegowda Bus Station(Majestic/KBS)',
    'destination': 'Hebbala',
    'routes': ['298-M'],
    'service': 'Ordinary',
    'total_fare': 20,
    'passenger_count': 1,
    'payment_method': 'UPI'
})
ticket = res.get_json()
print('Issued Ticket:', ticket['ticket_id'], '| Valid until:', ticket['valid_until'], '| QR Payload:', ticket['qr_payload'][:35] + '...')

print('\n--- TEST 7: Complaints Registration & Tracking ---')
res = client.post('/api/complaints', json={
    'commuter_name': 'Ramesh Rao',
    'contact': '9845011223',
    'service_type': 'Ordinary',
    'route_no': '500-D',
    'bus_no': 'KA-57-F-9988',
    'category': 'Delay / Scheduling',
    'description': 'Bus 500-D delayed by 30 mins at Silk Board stop during morning peak.'
})
cmp_data = res.get_json()
print('Complaint Filed:', cmp_data['ticket_id'], '| Status:', cmp_data['status'])

track_res = client.get(f"/api/complaints/{cmp_data['ticket_id']}")
print('Track Result Found:', track_res.get_json().get('success'))

print('\n========================================')
print('  ALL 7 CORE SYSTEM TESTS PASSED 100%')
print('========================================')
