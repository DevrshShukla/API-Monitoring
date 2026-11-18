import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { LatencyTimeSeriesPoint } from '@api-monitoring/shared';

interface LatencyChartProps {
  data: LatencyTimeSeriesPoint[];
  height?: number;
}

export const LatencyChart: React.FC<LatencyChartProps> = ({ data, height = 300 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 border border-boundary rounded-lg text-sm text-ink-secondary">
        No latency data recorded for this period
      </div>
    );
  }

  const formatXAxis = (tickItem: string) => {
    try {
      const d = new Date(tickItem);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return tickItem;
    }
  };

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="p95Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#818CF8" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4338CA" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#4338CA" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatXAxis}
            stroke="#94A3B8"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="#94A3B8"
            fontSize={12}
            tickLine={false}
            unit="ms"
            domain={[0, 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
              borderRadius: '0.5rem',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '12px',
            }}
            formatter={(value: any, name: any) => [`${value} ms`, name]}
            labelFormatter={(label) => new Date(label).toLocaleString()}
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          <Area
            type="monotone"
            dataKey="p95"
            name="P95 Latency"
            stroke="#818CF8"
            strokeWidth={1.5}
            fillOpacity={1}
            fill="url(#p95Grad)"
          />
          <Area
            type="monotone"
            dataKey="p50"
            name="P50 Latency"
            stroke="#4338CA"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#p50Grad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
