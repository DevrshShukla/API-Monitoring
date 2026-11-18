import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { StatusCodeDistributionItem } from '@api-monitoring/shared';

interface StatusDistributionChartProps {
  data?: StatusCodeDistributionItem[];
  successCount?: number;
  degradedCount?: number;
  failedCount?: number;
  height?: number;
}

const STATUS_COLORS: Record<string, string> = {
  '2xx': '#16A34A', // Green
  '3xx': '#0284C7', // Sky
  '4xx': '#D97706', // Amber
  '5xx': '#DC2626', // Red
  operational: '#16A34A',
  degraded: '#D97706',
  failed: '#DC2626',
};

function getColorForStatus(code: number): string {
  if (code >= 200 && code < 300) return STATUS_COLORS['2xx'];
  if (code >= 300 && code < 400) return STATUS_COLORS['3xx'];
  if (code >= 400 && code < 500) return STATUS_COLORS['4xx'];
  if (code >= 500) return STATUS_COLORS['5xx'];
  return '#94A3B8';
}

export const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({
  data,
  successCount,
  degradedCount,
  failedCount,
  height = 260,
}) => {
  let chartData: Array<{ name: string; value: number; percentage: number; color: string }> = [];

  if (data && data.length > 0) {
    chartData = data.map((item) => ({
      name: `HTTP ${item.statusCode}`,
      value: item.count,
      percentage: item.percentage,
      color: getColorForStatus(item.statusCode),
    }));
  } else if (
    successCount !== undefined ||
    degradedCount !== undefined ||
    failedCount !== undefined
  ) {
    const s = successCount || 0;
    const d = degradedCount || 0;
    const f = failedCount || 0;
    const total = s + d + f;
    if (total > 0) {
      if (s > 0) {
        chartData.push({
          name: 'Operational / 2xx',
          value: s,
          percentage: Math.round((s / total) * 100),
          color: STATUS_COLORS.operational,
        });
      }
      if (d > 0) {
        chartData.push({
          name: 'Degraded / Slow',
          value: d,
          percentage: Math.round((d / total) * 100),
          color: STATUS_COLORS.degraded,
        });
      }
      if (f > 0) {
        chartData.push({
          name: 'Down / Errors',
          value: f,
          percentage: Math.round((f / total) * 100),
          color: STATUS_COLORS.failed,
        });
      }
    }
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-56 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-500">
        No status observations recorded
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
              borderRadius: '0.5rem',
              fontSize: '12px',
            }}
            formatter={(value: any, name: any, item: any) => [
              `${value} checks (${item.payload.percentage}%)`,
              name,
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
