
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";

export function FarmHealthRadar({ moisture, temp, humidity, rain, cropHealth, efficiency }) {
  const data = [
    { subject: "Moisture",   A: Math.min(100, moisture ?? 55) },
    { subject: "Crop Health",A: cropHealth ?? 72 },
    { subject: "Efficiency", A: efficiency ?? 68 },
    { subject: "Humidity",   A: Math.min(100, humidity ?? 60) },
    { subject: "Rain Risk",  A: 100 - Math.min(100, rain ?? 30) },
  ];
  return (
    <ResponsiveContainer width="100%" height={190}>
      <RadarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
        <PolarGrid stroke="rgba(16,185,129,0.15)" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#96B3A5", fontFamily: "'DM Sans',sans-serif" }} />
        <Radar name="Farm" dataKey="A" stroke="#10B981" fill="#10B981" fillOpacity={0.18} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
 

 