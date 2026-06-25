"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const chartStyle = {
  fontSize: 12,
  fill: "#888",
};

export function FrequencyChart({
  data,
}: {
  data: { name: string; frequency: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis type="number" tick={chartStyle} />
        <YAxis dataKey="name" type="category" width={60} tick={chartStyle} />
        <Tooltip
          contentStyle={{
            background: "#111",
            border: "1px solid #333",
            borderRadius: 8,
          }}
        />
        <Bar dataKey="frequency" fill="#f97316" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DemandChart({
  data,
}: {
  data: { slot: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="slot" tick={chartStyle} angle={-25} textAnchor="end" height={60} />
        <YAxis tick={chartStyle} />
        <Tooltip
          contentStyle={{
            background: "#111",
            border: "1px solid #333",
            borderRadius: 8,
          }}
        />
        <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({
  data,
}: {
  data: { week: string; attendance: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="week" tick={chartStyle} />
        <YAxis tick={chartStyle} />
        <Tooltip
          contentStyle={{
            background: "#111",
            border: "1px solid #333",
            borderRadius: 8,
          }}
        />
        <Line
          type="monotone"
          dataKey="attendance"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ fill: "#f97316" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function OccupancyChart({
  data,
}: {
  data: { name: string; occupancy: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="name" tick={chartStyle} />
        <YAxis tick={chartStyle} domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            background: "#111",
            border: "1px solid #333",
            borderRadius: 8,
          }}
        />
        <Bar dataKey="occupancy" fill="#fb923c" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
