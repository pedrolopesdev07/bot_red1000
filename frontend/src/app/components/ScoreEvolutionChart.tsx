import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ScorePoint {
  label: string;
  nota: number | null;
}

export default function ScoreEvolutionChart({ data }: { data: ScorePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(109,40,217,0.12)" />
        <XAxis dataKey="label" tick={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, fill: "#776A89" }} axisLine={false} tickLine={false} />
        <YAxis domain={[500, 1000]} tick={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, fill: "#776A89" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#FFFFFF", border: "2px solid rgba(109,40,217,0.22)", borderRadius: 10, fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#2F2341" }}
          cursor={{ stroke: "rgba(139,92,246,0.3)" }}
        />
        <Line type="monotone" dataKey="nota" stroke="#8B5CF6" strokeWidth={2.5} dot={{ fill: "#8B5CF6", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#A78BFA", strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
