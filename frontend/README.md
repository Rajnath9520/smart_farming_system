# AgroSense

## Quick Start

```bash
cd frontend
npm install
cp .env   
npm run dev           
```

## Project Structure

```
src/
├── components/
│   ├── ui/
        ├──Button.jsx 
        ├──Badge.jsx
        ├──Input.jsx
        ├──Input.jsx
        ├──Toggle.jsx
        ├──Modal.jsx etc......            
│   ├── layout/MainLayout.jsx           # Sidebar + TopBar + Mobile Nav
│   ├── dashboard/SensorCard.jsx        # SensorCard, MotorWidget, CropTimeline
│   ├── irrigation/IrrigationControls.jsx # DecisionEngine, HistoryTable, Stats
│   ├── crops/CropComponents.jsx        # CropSelector, ActiveCropBanner, StageTable
│   ├── weather/WeatherComponents.jsx   # CurrentWeatherHero, ForecastCards
│   ├── analytics/AnalyticsComponents.jsx # KpiCard, EfficiencyGauge, MoistureHeatmap
│   ├── admin/AdminComponents.jsx       # AdminKpiGrid, FarmersTable, SystemStatus
│   └── notifications/NotifComponents.jsx # NotifCard, NotifList
├── pages/
│   ├── LoginPage.jsx                   
│   ├── RegisterPage.jsx                
│   ├── DashboardPage.jsx               
│   ├── IrrigationPage.jsx         
│   ├── CropsPage.jsx                
│   ├── WeatherPage.jsx                 
│   ├── AnalyticsPage.jsx             
│   ├── NotificationsPage.jsx          
│   ├── AdminPage.jsx                 
│   └── SettingsPage.jsx          
├── services/
│   ├── firebase.js                    
│   └── api.js                       
├── context/
│   └── AuthContext.jsx              
└── App.jsx                            
```

## Design System

- **Background**: Warm greenish-white `#F0F7F4`
- **Cards**: Pure white with green border shadows
- **Primary**: `#10B981` (Emerald green)
- **Teal accent**: `#14B8A6`
- **Typography**: Sora (display) + DM Sans (body) + JetBrains Mono (numbers)

## Backend API Routes Used

| Feature        | Routes                                            |
|----------------|---------------------------------------------------|
| Auth           | POST /auth/register, POST /auth/login, GET /auth/me |
| Sensors        | GET /sensors/latest, /sensors/history, /sensors/stats |
| Irrigation     | GET /irrigation/status, POST /irrigation/control   |
| Weather        | GET /weather/current, /weather/forecast            |
| Crops          | GET /crops/active, POST /crops/schedules           |
| Analytics      | GET /analytics/overview, /heatmap, /moisture-trend |
| Admin          | GET /admin/dashboard, /admin/farmers               |

## Firebase Realtime DB

Live sensor data is read directly from:
```
irrigation_control/{farmId}/
  SensorReading: <float>   # soil moisture %
  switch: "ON" | "OFF"     # motor state
  precipitation: <float>   # rain probability
```