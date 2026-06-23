'use client';

import { useMemo, useState } from 'react';
import { Card, Col, Row, Segmented, Typography, theme } from 'antd';
import { Line, Bar, Pie } from '@ant-design/plots';
import dayjs from 'dayjs';
import type { QualityEvent } from '@/data/types';
import type { DateRange } from '@/components/DateRangeFilter';

const { Text } = Typography;


function countBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

function eventsOverTime(
  events: QualityEvent[],
  dateRange: DateRange | null,
): { date: string; count: number }[] {
  const countMap = countBy(events, e => e.date);

  if (!dateRange) {
    return Object.entries(countMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const [start, end] = dateRange;
  const result: { date: string; count: number }[] = [];
  let cur = start;
  while (!cur.isAfter(end)) {
    const d = cur.format('YYYY-MM-DD');
    result.push({ date: d, count: countMap[d] ?? 0 });
    cur = cur.add(1, 'day');
  }
  return result;
}

export function FieldIntake({
  events,
  dateRange,
}: {
  events: QualityEvent[];
  dateRange: DateRange | null;
}) {
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [donutMode, setDonutMode] = useState<'discrepancy' | 'product'>('discrepancy');
  const { token } = theme.useToken();

  // colorBgBase is '#000000' in dark algorithm, '#ffffff' in light
  const isDark = token.colorBgBase === '#000000';
  const plotTheme = isDark ? 'classicDark' : 'classic';
  const axisStyle = {
    labelFill:      token.colorText,
    labelFontSize:  token.fontSizeSM,
    gridStroke:     token.colorBorderSecondary,
    gridLineWidth:  1,
    lineStroke:     token.colorBorderSecondary,
    lineLineWidth:  1,
    tickStroke:     token.colorBorderSecondary,
    tickLineWidth:  1,
  };

  const timeData = useMemo(() => eventsOverTime(events, dateRange), [events, dateRange]);

  const BRANCH_STATUS_ORDER = ['Reported', 'Under Investigation', 'Validated/Invalidated'] as const;

  const branchStackData = useMemo(() => {
    const STATUS_GROUP: Record<string, string> = {
      'Reported':           'Reported',
      'Under Investigation': 'Under Investigation',
      'Validated':          'Validated/Invalidated',
      'Invalidated':        'Validated/Invalidated',
    };
    const countMap: Record<string, Record<string, number>> = {};
    const totals: Record<string, number> = {};
    for (const e of events) {
      const grp = STATUS_GROUP[e.status] ?? 'Other';
      if (!countMap[e.branch]) countMap[e.branch] = {};
      countMap[e.branch][grp] = (countMap[e.branch][grp] ?? 0) + 1;
      totals[e.branch] = (totals[e.branch] ?? 0) + 1;
    }
    const sortedBranches = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([b]) => b);
    return { sortedBranches, countMap };
  }, [events]);

  const discData = useMemo(() => {
    const counts = countBy(events, e => e.discrepancy);
    return Object.entries(counts)
      .map(([discrepancy, count]) => ({ discrepancy, count }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  const productData = useMemo(() => {
    const counts = countBy(events, e => e.product);
    return Object.entries(counts)
      .map(([product, count]) => ({ product, count }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  return (
    <div>
      <Text
        type="secondary"
        style={{ display: 'block', marginBottom: 8, fontSize: token.fontSizeSM, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}
      >
        Field Intake
      </Text>
      <Row gutter={token.marginSM} style={{ alignItems: 'flex-start' }}>

        {/* Events over time */}
        <Col xs={24} lg={8}>
          <Card size="small" title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Events Over Time</span>} style={{ marginBottom: token.marginSM }}>
            <Line
              key={plotTheme}
              data={timeData}
              xField="date"
              yField="count"
              height={240}
              theme={plotTheme}
              style={{ lineWidth: 1 }}
              point={{ shapeField: 'square', sizeField: 1 }}
              interaction={{ tooltip: { marker: false } }}
              axis={{
                x: { ...axisStyle, labelFormatter: (v: string) => dayjs(v).format('MMM D'), tickCount: 4 },
                y: { ...axisStyle, tickCount: 4 },
              }}
              tooltip={{ title: (d: { date: string }) => dayjs(d.date).format('MMM D, YYYY') }}
            />
          </Card>
        </Col>

        {/* By Branch */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Events by Branch{!showAllBranches ? ' (Top 5)' : ''}</span>}
            extra={
              branchStackData.sortedBranches.length > 5 && (
                <Typography.Link style={{ fontSize: token.fontSizeSM }} onClick={() => setShowAllBranches(v => !v)}>
                  {showAllBranches ? 'Show less' : `Show all ${branchStackData.sortedBranches.length}`}
                </Typography.Link>
              )
            }
            style={{ marginBottom: token.marginSM }}
          >
            {(() => {
              const { sortedBranches, countMap } = branchStackData;
              const visible = showAllBranches ? sortedBranches : sortedBranches.slice(0, 5);
              const chartData = visible.flatMap(branch =>
                BRANCH_STATUS_ORDER.map(status => ({
                  branch,
                  status,
                  count: countMap[branch]?.[status] ?? 0,
                }))
              );
              return (
                <Bar
                  key={plotTheme}
                  data={chartData}
                  xField="branch"
                  yField="count"
                  colorField="status"
                  stack={true}
                  height={showAllBranches ? 480 : 240}
                  theme={plotTheme}
                  label={false}
                  interaction={{ elementHighlight: true }}
                  state={{ active: { opacity: 1 }, inactive: { opacity: 0.15 } }}
                  scale={{
                    x: { domain: visible },
                    color: {
                      domain: [...BRANCH_STATUS_ORDER],
                      range: ['#1677FF', '#FA8C16', '#8C8C8C'],
                    },
                  }}
                  axis={{
                    x: { ...axisStyle, labelFormatter: (v: string) => v.length > 14 ? v.slice(0, 13) + '…' : v },
                    y: { ...axisStyle, tickCount: 4 },
                  }}
                  legend={{
                    color: {
                      position: 'bottom',
                      itemLabelFill: token.colorText,
                      itemLabelFontSize: token.fontSizeSM,
                    },
                  }}
                  tooltip={{
                    title: (d: { branch: string }) => d.branch,
                    items: [{ field: 'count', name: 'Events' }],
                  }}
                />
              );
            })()}
          </Card>
        </Col>

        {/* By Discrepancy / Door Type */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={
              <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>
                {donutMode === 'discrepancy' ? 'Events by Discrepancy' : 'Events by Product'}
              </span>
            }
            extra={
              <Segmented
                size="small"
                value={donutMode}
                onChange={(v) => setDonutMode(v as 'discrepancy' | 'product')}
                options={[
                  { label: 'Discrepancy', value: 'discrepancy' },
                  { label: 'Product', value: 'product' },
                ]}
              />
            }
            style={{ marginBottom: token.marginSM }}
          >
            <Pie
              key={plotTheme}
              data={donutMode === 'discrepancy' ? discData : productData}
              angleField="count"
              colorField={donutMode === 'discrepancy' ? 'discrepancy' : 'product'}
              height={240}
              theme={plotTheme}
              label={false}
              animate={{ enter: { type: 'waveIn', duration: 600 } }}
              interaction={{ elementHighlight: true }}
              state={{ active: { opacity: 1 }, inactive: { opacity: 0.15 } }}
              legend={{
                color: {
                  position: 'bottom',
                  layout: { justifyContent: 'flex-start' },
                  itemLabelFill: token.colorText,
                  itemLabelFontSize: token.fontSizeSM,
                  itemLabelFormatter: (v: string) => v.length > 20 ? v.slice(0, 19) + '…' : v,
                  rows: 8,
                },
              }}
              tooltip={{
                title: (d: Record<string, string>) =>
                  donutMode === 'discrepancy' ? d.discrepancy : d.product,
                items: [{ field: 'count', name: 'Events' }],
              }}
            />
          </Card>
        </Col>

      </Row>
    </div>
  );
}
