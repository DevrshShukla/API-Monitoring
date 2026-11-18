import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { LatencyTimeSeriesPoint } from '@api-monitoring/shared';

interface UptimeChartProps {
  data: LatencyTimeSeriesPoint[];
  height?: number;
}

export const UptimeChart: React.FC<UptimeChartProps> = ({ data, height = 240 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50 border border-boundary rounded-lg text-sm text-ink-secondary">
        No checks data recorded
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
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatXAxis}
            stroke="#94A3B8"
            fontSize={12}
            tickLine={false}
          />
          <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
              borderRadius: '0.5rem',
              fontSize: '12px',
            }}
            formatter={(value: any) => [`${value} checks`, 'Completed Checks']}
            labelFormatter={(label) => new Date(label).toLocaleString()}
          />
          <Bar dataKey="sampleCount" fill="#4338CA" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
