import axios from "axios";
import { auth } from "../config/firebase";

const http = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

http.interceptors.request.use(
  async (cfg) => {
    try {
      const u = auth.currentUser;

      if (u) {
        const token = await u.getIdToken();
        cfg.headers.Authorization = `Bearer ${token}`;
      }

      return cfg;
    } catch (err) {
      console.error("Token error:", err);
      return cfg;
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

http.interceptors.response.use(
  (r) => r,
  (e) => Promise.reject(new Error(e.response?.data?.message || e.message || "Network error"))
);

// helpers 
const get  = (url, params)     => http.get(url, { params });
const post = (url, body)       => http.post(url, body);
const put  = (url, body)       => http.put(url, body);
const del  = (url)             => http.delete(url);
const patch= (url, body)       => http.patch(url, body);

// AUTHENTICATION
export const authAPI = {
  register: (d) => post("/auth/register", d),
  login:    (d) => post("/auth/login", d),
  me:       ()  => get("/auth/me"),
  update:   (d) => put("/auth/profile", d),
  delete:   ()  => del("/auth/account"),
};

// SENSORS DATA
export const sensorAPI = {
  latest:  ()      => get("/sensors/latest"),
  history: (p)     => get("/sensors/history", p),
  stats:   ()      => get("/sensors/stats"),
};

// IRRIGATION 
export const irrigationAPI = {
  status:  ()             => get("/irrigation/status"),
  control: (action, confirmed=false) => post("/irrigation/control", { action, confirmed }),
  history: (p)            => get("/irrigation/history", p),
  stats:   ()             => get("/irrigation/stats"),
};

// WEATHER DATA
export const weatherAPI = {
  current:  () => get("/weather/current"),
  forecast: () => get("/weather/forecast"),
  refresh:  () => post("/weather/refresh"),
  history:  (limit) => get("/weather/history", { limit }),
};

// CROPS RELATED
export const cropAPI = {
  schedules: ()        => get("/crops/schedules"),
  active:    ()        => get("/crops/active"),
  create:    (d)       => post("/crops/schedules", d),
  update:    (id, d)   => put(`/crops/schedules/${id}`, d),
  delete:    (id)      => del(`/crops/schedules/${id}`),
  defaults:  (type)    => get(`/crops/defaults/${type}`),
};

//  ANALYTICS 
export const analyticsAPI= {
  overview: (period, offset = 0) => get("/analytics/overview", { period, offset }),
  moisture: (period) => get("/analytics/moisture-trend",        { period }),
  water:    (period) => get("/analytics/water-usage",           { period }),
  activity: (period) => get("/analytics/irrigation-activity",   { period }),
  heatmap:  (year)   => get("/analytics/heatmap",               { year }),
};

//  NOTIFICATIONS 
export const notifAPI = {
  list:     (p)   => get("/notifications", p),
  markRead: (ids) => patch("/notifications/read", { ids }),
};

// FARMS DATA
export const farmAPI = {
  list:      ()      => get("/farms"),
  add:       (d)     => post("/farms", d),
  update:    (i, d)  => put(`/farms/${i}`, d),
  setActive: (i)     => patch(`/farms/active/${i}`),
};

// DEVICES
export const deviceAPI = {
  verify:     (deviceId, activationCode)        => post("/devices/verify",   { deviceId, activationCode }),
  activate:   (deviceId, activationCode, extra) => post("/devices/activate", { deviceId, activationCode, ...extra }),
  myDevices:  ()                                => get("/devices/my"),

  all:        (p)           => get("/devices", p),
  seed:       (count, opts) => post("/devices/seed", { count, ...opts }),
  deactivate: (id, note)    => patch(`/devices/${id}/deactivate`, { note }),
};

/* ══ AI ENGINE ══════════════════════════════════════════ */
export const aiAPI = {
  digitalTwin: ()     => get("/ai/digital-twin"),
  stress:      ()     => get("/ai/stress"),
  simulate:    (body) => post("/ai/simulate", body),
};

// ADMIN 
export const adminAPI = {
  dashboard:   ()  => get("/admin/dashboard"),
  farmers:     (p) => get("/admin/farmers", p),
  systemStats: ()  => get("/admin/system-stats"),
  toggle:      (id)=> patch(`/admin/users/${id}/toggle`),
};

export default http;