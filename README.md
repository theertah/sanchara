# SANCHARA – BMTC COMMUTER TRANSIT ENGINE

**SANCHARA** is a public transport and commuter guidance web application built for Bengaluru citizens and travelers.

---

## 🌟 Key Architecture & Features

### 1. Brand Identity & Design System
* **Navy Blue**: `#173B64` & **Deep Navy**: `#102B49`
* **Cream**: `#F5EDDC` & **Warm Cream**: `#FFF9EF`
* **Coral**: `#D97662` (Action/Alert Accent)
* **Typography**: Cormorant Garamond (Headings) & Manrope (Commuter UI)

### 2. Signature Animated Bus Page Transitions
* **Page 1 (Opening Page)**: Clicking the BMTC card launches a blue BMTC-style illustrated city bus that drives across the screen on a highway track, transitioning the passenger into the BMTC section.
* **Page 2 (Service Selection)**: Displays two bus depot platforms:
  * **Platform 01**: BMTC Ordinary Services (Illustrated Blue City Bus)
  * **Platform 02**: AC Volvo / Vajra & Vayu Vajra Airport Services (Illustrated Metallic Luxury Coach)
* **Departure Animations**: Clicking either option animates the bus departing forward smoothly into the selected dashboard.
* **AC Volvo Fallback**: If an AC Vajra journey is not directly connected, an alert informs the commuter and offers an *"Explore BMTC alternatives"* action, animating the bus back into the Ordinary dashboard while preserving the source and destination.

### 3. Pure-Python Dijkstra Routing Engine
* Operates on a **Directed Multigraph** ($G = (V, E)$) of **10,128 stops** and **245,645 edges**.
* Supports both **⚡ Fastest Journey** (travel-time weighted with transfer penalties) and **📏 Shortest Distance** modes.
* Edge-level service category filtering (Ordinary vs. Vajra AC).

### 4. Interactive Bangalore Transport Map
* Built with **Leaflet** and **OpenStreetMap**.
* Clustered rendering of **7,964 geocoded stops** inside Bengaluru with stop names, IDs, and route counts.
* Multi-color polylines for distinct journey legs (Leg 1: Deep Navy, Leg 2: Coral, Leg 3: Teal) with Boarding, Transfer Interchange, and Destination pins.

### 5. Complete 8-Step Commuter Progression Timeline
1. **Step 1**: Walk to Boarding Stop (~250m, 3 mins)
2. **Step 2**: Boarding Stop Hub & Crowd Details (Bay & Platform guidelines)
3. **Step 3**: Bus Identification (Route badge, headsign, bus type)
4. **Step 4**: Onboard Leg & Intermediate Stops (accordion listing all stops)
5. **Step 5**: Transfer Interchange Guide (connecting bay, estimated transfer buffer wait)
6. **Step 6**: Connecting Bus Leg (route number, distance, duration)
7. **Step 7**: Approaching Destination Alert (bell beacon indicator)
8. **Step 8**: Arrival & Safe Alighting

### 6. Official Multi-Schedule Fare Engine & Simulated Payment
* Implements verified BMTC stage tariff structures:
  * **Ordinary Services** (₹5, ₹10, ₹15, ₹20, ₹25, ₹30, ₹35)
  * **Vajra AC Volvo** (₹10, ₹15, ₹20, ₹25, ₹30, ₹35, ₹40, ₹45 + 5% GST)
  * **Vayu Vajra Airport Express** (Corridor stages from ₹60 to ₹320)
  * **Mofussil Outskirts** (Rural graduated schedule)
  * **NICE Road Express** (with toll surcharge)
* Concessions: Senior Citizen (25%), Child (50%), Student Pass (Free Ordinary / 50% Vajra), Daily Passes (₹70 Ord / ₹120 Vajra).
* **Simulated m-Ticket**: Generates digital ticket with official QR code, ticket ID, and print action.

### 7. Real-Time Crowd Prediction
* Diurnal peak curve modeling morning peak (08:00 - 11:30), evening peak (16:30 - 20:30), and off-peak periods.
* Passenger crowdsourcing form to report live bus occupancy (Low / Moderate / High / Full).

### 8. Smart Service Alerts & Grievance Complaint Box
* Live disruption alerts for metro construction, weather flooding, and route detours.
* Commuter Grievance Box: submits grievance, generates reference ticket (e.g. `BMTC-CMP-...`), and provides a live status tracker.
* **Admin Control Center** (`/bmtc/admin`) to monitor network metrics, broadcast alerts, and resolve complaints.

---

## 🚀 How to Run the Server

```bash
# From the project root
python run_server.py
```

* **Opening Landing Page**: `http://localhost:5000/`
* **BMTC Service Selection**: `http://localhost:5000/bmtc/`
* **Transit Dashboard**: `http://localhost:5000/bmtc/dashboard`
* **Admin Operations Center**: `http://localhost:5000/bmtc/admin`

---

## 🧪 Run Automated Verification Tests

```bash
python test_system.py
```
