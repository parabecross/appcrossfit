"use client";

import { useTranslations } from "next-intl";
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

const tooltipStyle = {
  background: "#111",
  border: "1px solid #333",
  borderRadius: 8,
};

interface StatsTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string }>;
  label?: string | number;
  valueLabel: string;
  suffix?: string;
}

function StatsTooltip({
  active,
  payload,
  label,
  valueLabel,
  suffix = "",
}: StatsTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div
      style={tooltipStyle}
      className="px-3 py-2 text-sm shadow-lg"
    >
      {label != null && label !== "" && (
        <p style={{ color: "#fafafa", fontWeight: 600, marginBottom: 4 }}>
          {label}
        </p>
      )}
      <p style={{ color: "#888" }}>
        {valueLabel}:{" "}
        <span style={{ color: "#fafafa" }}>
          {value}
          {suffix}
        </span>
      </p>
    </div>
  );
}

export function FrequencyChart({
  data,
}: {
  data: { name: string; frequency: number }[];
}) {
  const t = useTranslations("stats");

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis type="number" tick={chartStyle} />
        <YAxis dataKey="name" type="category" width={60} tick={chartStyle} />
        <Tooltip
          content={(props) => (
            <StatsTooltip
              active={props.active}
              payload={props.payload as StatsTooltipProps["payload"]}
              label={props.label}
              valueLabel={t("tooltipFrequency")}
            />
          )}
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
  const t = useTranslations("stats");

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="slot"
          tick={chartStyle}
          angle={-25}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={chartStyle} />
        <Tooltip
          content={(props) => (
            <StatsTooltip
              active={props.active}
              payload={props.payload as StatsTooltipProps["payload"]}
              label={props.label}
              valueLabel={t("tooltipBookings")}
            />
          )}
        />
        <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({
  data,
  locale,
}: {
  data: { week: string; attendance: number }[];
  locale?: string;
}) {
  const t = useTranslations("stats");
  const loc = locale === "en" ? "en-US" : "es-MX";

  const formatWeek = (week: string) =>
    new Intl.DateTimeFormat(loc, {
      day: "numeric",
      month: "short",
    }).format(new Date(week));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="week"
          tick={chartStyle}
          tickFormatter={formatWeek}
        />
        <YAxis tick={chartStyle} />
        <Tooltip
          content={(props) => (
            <StatsTooltip
              active={props.active}
              payload={props.payload as StatsTooltipProps["payload"]}
              label={
                props.label != null ? formatWeek(String(props.label)) : ""
              }
              valueLabel={t("tooltipAttendance")}
            />
          )}
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
  const t = useTranslations("stats");

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="name"
          tick={chartStyle}
          angle={-25}
          textAnchor="end"
          height={70}
        />
        <YAxis tick={chartStyle} domain={[0, 100]} />
        <Tooltip
          content={(props) => (
            <StatsTooltip
              active={props.active}
              payload={props.payload as StatsTooltipProps["payload"]}
              label={props.label}
              valueLabel={t("tooltipOccupancy")}
              suffix="%"
            />
          )}
        />
        <Bar dataKey="occupancy" fill="#fb923c" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
