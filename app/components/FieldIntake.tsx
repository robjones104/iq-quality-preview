'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Col, Row, Segmented, Tooltip, Typography, theme } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Line, Bar, Pie } from '@ant-design/plots';
import dayjs from 'dayjs';
import type { QualityEvent } from '@/data/types';
import type { DateRange } from '@/components/DateRangeFilter';
import { ExpandToggle } from './CardControls';

const { Text } = Typography;

function countBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

// Short ranges (Last 7 days / Last week) read per day; anything longer
// buckets weekly (Rob 2026-08-05).
export function isDailyRange(dateRange: DateRange | null): boolean {
  return dateRange !== null && dateRange[1].diff(dateRange[0], 'day') <= 14;
}

// Weekly buckets (Rob 2026-08-05), same Monday-start weeks as the Decision
// Trend: a daily line at the default 90-day range is ~90 points of sawtooth.
// Ranges of two weeks or less fall back to per-day buckets.
function eventsOverTime(
  events: QualityEvent[],
  dateRange: DateRange | null,
): { date: string; weekEnd: string; count: number }[] {
  if (isDailyRange(dateRange)) {
    const dayMap = countBy(events, e => e.date);
    const [start, end] = dateRange!;
    const daily: { date: string; weekEnd: string; count: number }[] = [];
    let cur = start;
    while (!cur.isAfter(end)) {
      const d = cur.format('YYYY-MM-DD');
      daily.push({ date: d, weekEnd: d, count: dayMap[d] ?? 0 });
      cur = cur.add(1, 'day');
    }
    return daily;
  }

  const weekStartOf = (d: dayjs.Dayjs) => {
    const dow = d.day();
    return d.subtract(dow === 0 ? 6 : dow - 1, 'day');
  };
  const countMap: Record<string, number> = {};
  for (const e of events) {
    const ws = weekStartOf(dayjs(e.date)).format('YYYY-MM-DD');
    countMap[ws] = (countMap[ws] ?? 0) + 1;
  }
  const keys = Object.keys(countMap).sort();
  if (keys.length === 0) return [];
  // Zero-fill every week across the range (or the observed span) so quiet
  // weeks read as real zeroes, not gaps.
  const start = weekStartOf(dateRange ? dateRange[0] : dayjs(keys[0]));
  const end   = dateRange ? dateRange[1] : dayjs(keys[keys.length - 1]);
  const result: { date: string; weekEnd: string; count: number }[] = [];
  let cur = start;
  while (!cur.isAfter(end)) {
    const d = cur.format('YYYY-MM-DD');
    result.push({ date: d, weekEnd: cur.add(6, 'day').format('YYYY-MM-DD'), count: countMap[d] ?? 0 });
    cur = cur.add(7, 'day');
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
  const router = useRouter();
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [donutMode, setDonutMode] = useState<'issue' | 'component'>('issue');
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

  const issueData = useMemo(() => {
    const counts = countBy(events, e => e.issue);
    return Object.entries(counts)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  const componentData = useMemo(() => {
    const counts = countBy(events, e => e.component);
    return Object.entries(counts)
      .map(([component, count]) => ({ component, count }))
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
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Events Over Time</span>}
            style={{ marginBottom: token.marginSM }}
            styles={{ body: { minHeight: 320 } }}
          >
            <div style={{ cursor: 'pointer' }}>
              <Line
                key={plotTheme}
                data={timeData}
                xField="date"
                yField="count"
                height={276}
                theme={plotTheme}
                style={{ lineWidth: 1 }}
                point={{ shapeField: 'square', sizeField: 3 }}
                interaction={{ tooltip: { marker: false } }}
                axis={{
                  x: { ...axisStyle, labelFormatter: (v: string) => dayjs(v).format('MMM D'), tickCount: 4 },
                  y: { ...axisStyle, tickCount: 4 },
                }}
                tooltip={{ title: (d: { date: string }) => dayjs(d.date).format('MMM D, YYYY') }}
                onEvent={(_chart, event) => {
                  if (event.type !== 'click' || !event.data) return;
                  const datum = event.data?.data as { date?: string } | undefined;
                  if (datum?.date) router.push(`/events?from=${datum.date}&to=${datum.date}`);
                }}
              />
            </div>
          </Card>
        </Col>

        {/* By Branch */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>Events by Branch</span>}
            extra={
              branchStackData.sortedBranches.length > 5 && (
                <ExpandToggle expanded={showAllBranches} onToggle={() => setShowAllBranches(v => !v)} />
              )
            }
            style={{ marginBottom: token.marginSM }}
            styles={{ body: { minHeight: 320 } }}
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
                <div style={{ cursor: 'pointer' }}>
                  <Bar
                    key={plotTheme}
                    data={chartData}
                    xField="branch"
                    yField="count"
                    colorField="status"
                    stack={true}
                    height={showAllBranches ? 480 : 276}
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
                    onEvent={(_chart, event) => {
                      if (event.type !== 'click' || !event.data) return;
                      const datum = event.data?.data as { branch?: string } | undefined;
                      if (datum?.branch) router.push(`/events?branch=${encodeURIComponent(datum.branch)}`);
                    }}
                  />
                </div>
              );
            })()}
          </Card>
        </Col>

        {/* By Issue / Component */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            title={
              <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>
                {donutMode === 'issue' ? 'Events by Issue' : 'Events by Component'}
              </span>
            }
            extra={
              <Segmented
                size="small"
                value={donutMode}
                onChange={(v) => setDonutMode(v as 'issue' | 'component')}
                options={[
                  { label: 'Issue', value: 'issue' },
                  { label: 'Component', value: 'component' },
                ]}
              />
            }
            style={{ marginBottom: token.marginSM }}
            styles={{ body: { minHeight: 320 } }}
          >
            <div style={{ cursor: 'pointer' }}>
              <Pie
                key={plotTheme}
                data={donutMode === 'issue' ? issueData : componentData}
                angleField="count"
                colorField={donutMode === 'issue' ? 'issue' : 'component'}
                height={276}
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
                    donutMode === 'issue' ? d.issue : d.component,
                  items: [{ field: 'count', name: 'Events' }],
                }}
                onEvent={(_chart, event) => {
                  if (event.type !== 'click' || !event.data) return;
                  const datum = event.data?.data as Record<string, string> | undefined;
                  if (!datum) return;
                  if (donutMode === 'issue' && datum.issue) {
                    router.push(`/events?issue=${encodeURIComponent(datum.issue)}`);
                  } else if (donutMode === 'component' && datum.component) {
                    router.push(`/events?component=${encodeURIComponent(datum.component)}`);
                  }
                }}
              />
            </div>
          </Card>
        </Col>

      </Row>
    </div>
  );
}

// Standalone Issue/Component donut card for the dashboard's bottom analysis
// row: same Pie, Segmented toggle, and slice click-throughs as the FieldIntake
// section's version, packaged as its own Card.
export function EventsDonutCard({ events }: { events: QualityEvent[] }) {
  const router = useRouter();
  const [donutMode, setDonutMode] = useState<'issue' | 'component'>('issue');
  const { token } = theme.useToken();
  const isDark = token.colorBgBase === '#000000';
  const plotTheme = isDark ? 'classicDark' : 'classic';

  const issueData = useMemo(() =>
    Object.entries(countBy(events, e => e.issue))
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count),
    [events]);
  const componentData = useMemo(() =>
    Object.entries(countBy(events, e => e.component))
      .map(([component, count]) => ({ component, count }))
      .sort((a, b) => b.count - a.count),
    [events]);

  return (
    <Card
      size="small"
      title={
        <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
          {donutMode === 'issue' ? 'Events by Issue' : 'Events by Component'}
          <Tooltip title={`Share of events in the period by ${donutMode}. Click a slice to open those events in the table.`}>
            <InfoCircleOutlined style={{ marginLeft: 6, color: token.colorTextTertiary, fontSize: token.fontSizeSM, cursor: 'help' }} />
          </Tooltip>
        </span>
      }
      extra={
        <Segmented
          size="small"
          value={donutMode}
          onChange={(v) => setDonutMode(v as 'issue' | 'component')}
          options={[
            { label: 'Issue', value: 'issue' },
            { label: 'Component', value: 'component' },
          ]}
        />
      }
      style={{ height: '100%' }}
      styles={{ body: { minHeight: 320, display: 'flex', flexDirection: 'column' } }}
    >
      <div style={{ cursor: 'pointer' }}>
        <Pie
          key={plotTheme}
          data={donutMode === 'issue' ? issueData : componentData}
          angleField="count"
          colorField={donutMode === 'issue' ? 'issue' : 'component'}
          height={276}
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
              donutMode === 'issue' ? d.issue : d.component,
            items: [{ field: 'count', name: 'Events' }],
          }}
          onEvent={(_chart, event) => {
            if (event.type !== 'click' || !event.data) return;
            const datum = event.data?.data as Record<string, string> | undefined;
            if (!datum) return;
            if (donutMode === 'issue' && datum.issue) {
              router.push(`/events?issue=${encodeURIComponent(datum.issue)}`);
            } else if (donutMode === 'component' && datum.component) {
              router.push(`/events?component=${encodeURIComponent(datum.component)}`);
            }
          }}
        />
      </div>
      <Text type="secondary" style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, textAlign: 'center', marginTop: 'auto', paddingTop: 8 }}>
        Click a slice to view those events
      </Text>
    </Card>
  );
}

export function EventsByBranchChart({
  events,
  height = 220,
}: {
  events: QualityEvent[];
  height?: number;
}) {
  const { token } = theme.useToken();
  const router = useRouter();
  const isDark = token.colorBgBase === '#000000';
  const plotTheme = isDark ? 'classicDark' : 'classic';
  const axisStyle = {
    labelFill:     token.colorText,
    labelFontSize: token.fontSizeSM,
    gridStroke:    token.colorBorderSecondary,
    gridLineWidth: 1,
    lineStroke:    token.colorBorderSecondary,
    lineLineWidth: 1,
    tickStroke:    token.colorBorderSecondary,
    tickLineWidth: 1,
  };
  const BRANCH_STATUS_ORDER = ['Reported', 'Under Investigation', 'Validated/Invalidated'] as const;
  const branchStackData = useMemo(() => {
    const STATUS_GROUP: Record<string, string> = {
      'Reported': 'Reported',
      'Under Investigation': 'Under Investigation',
      'Validated':   'Validated/Invalidated',
      'Invalidated': 'Validated/Invalidated',
    };
    const countMap: Record<string, Record<string, number>> = {};
    const totals: Record<string, number> = {};
    for (const e of events) {
      const grp = STATUS_GROUP[e.status] ?? 'Other';
      if (!countMap[e.branch]) countMap[e.branch] = {};
      countMap[e.branch][grp] = (countMap[e.branch][grp] ?? 0) + 1;
      totals[e.branch] = (totals[e.branch] ?? 0) + 1;
    }
    const sortedBranches = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([b]) => b);
    return { sortedBranches, countMap };
  }, [events]);

  const visible = branchStackData.sortedBranches.slice(0, 5);
  const chartData = visible.flatMap(branch =>
    BRANCH_STATUS_ORDER.map(status => ({ branch, status, count: branchStackData.countMap[branch]?.[status] ?? 0 }))
  );

  return (
    <Bar
      key={plotTheme}
      data={chartData}
      xField="branch"
      yField="count"
      colorField="status"
      stack={true}
      height={height}
      theme={plotTheme}
      label={false}
      interaction={{ elementHighlight: true }}
      state={{ active: { opacity: 1 }, inactive: { opacity: 0.15 } }}
      scale={{
        x: { domain: visible },
        color: { domain: [...BRANCH_STATUS_ORDER], range: ['#1677FF', '#FA8C16', '#8C8C8C'] },
      }}
      axis={{
        x: { ...axisStyle, labelFormatter: (v: string) => v.length > 10 ? v.slice(0, 9) + '…' : v },
        y: { ...axisStyle, tickCount: 4 },
      }}
      legend={{ color: { position: 'bottom', itemLabelFill: token.colorText, itemLabelFontSize: token.fontSizeSM } }}
      tooltip={{ title: (d: { branch: string }) => d.branch, items: [{ field: 'count', name: 'Events' }] }}
      onEvent={(_chart, event) => {
        if (event.type !== 'click' || !event.data) return;
        const datum = event.data?.data as { branch?: string } | undefined;
        if (datum?.branch) router.push(`/events?branch=${encodeURIComponent(datum.branch)}`);
      }}
    />
  );
}

export function EventsByIssueChart({
  events,
  height = 220,
}: {
  events: QualityEvent[];
  height?: number;
}) {
  const [donutMode, setDonutMode] = useState<'issue' | 'component'>('issue');
  const { token } = theme.useToken();
  const router = useRouter();
  const isDark = token.colorBgBase === '#000000';
  const plotTheme = isDark ? 'classicDark' : 'classic';

  const issueData = useMemo(() => {
    const counts = events.reduce<Record<string, number>>((a, e) => { a[e.issue] = (a[e.issue] ?? 0) + 1; return a; }, {});
    return Object.entries(counts).map(([issue, count]) => ({ issue, count })).sort((a, b) => b.count - a.count);
  }, [events]);
  const componentData = useMemo(() => {
    const counts = events.reduce<Record<string, number>>((a, e) => { a[e.component] = (a[e.component] ?? 0) + 1; return a; }, {});
    return Object.entries(counts).map(([component, count]) => ({ component, count })).sort((a, b) => b.count - a.count);
  }, [events]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Segmented
          size="small"
          value={donutMode}
          onChange={(v) => setDonutMode(v as 'issue' | 'component')}
          options={[{ label: 'Issue', value: 'issue' }, { label: 'Component', value: 'component' }]}
        />
      </div>
      <Pie
        key={`${plotTheme}-${donutMode}`}
        data={donutMode === 'issue' ? issueData : componentData}
        angleField="count"
        colorField={donutMode === 'issue' ? 'issue' : 'component'}
        height={height}
        theme={plotTheme}
        label={false}
        animate={{ enter: { type: 'waveIn', duration: 600 } }}
        interaction={{ elementHighlight: true }}
        state={{ active: { opacity: 1 }, inactive: { opacity: 0.15 } }}
        legend={{ color: { position: 'bottom', itemLabelFill: token.colorText, itemLabelFontSize: token.fontSizeSM, itemLabelFormatter: (v: string) => v.length > 18 ? v.slice(0, 17) + '…' : v, rows: 6 } }}
        tooltip={{ title: (d: Record<string, string>) => donutMode === 'issue' ? d.issue : d.component, items: [{ field: 'count', name: 'Events' }] }}
        onEvent={(_chart, event) => {
          if (event.type !== 'click' || !event.data) return;
          const datum = event.data?.data as Record<string, string> | undefined;
          if (!datum) return;
          if (donutMode === 'issue' && datum.issue) router.push(`/events?issue=${encodeURIComponent(datum.issue)}`);
          else if (donutMode === 'component' && datum.component) router.push(`/events?component=${encodeURIComponent(datum.component)}`);
        }}
      />
    </div>
  );
}

export function EventsOverTimeChart({
  events,
  dateRange,
  height = 240,
}: {
  events: QualityEvent[];
  dateRange: DateRange | null;
  height?: number;
}) {
  const { token } = theme.useToken();
  const router = useRouter();
  const isDark = token.colorBgBase === '#000000';
  const plotTheme = isDark ? 'classicDark' : 'classic';
  const axisStyle = {
    labelFill:     token.colorText,
    labelFontSize: token.fontSizeSM,
    gridStroke:    token.colorBorderSecondary,
    gridLineWidth: 1,
    lineStroke:    token.colorBorderSecondary,
    lineLineWidth: 1,
    tickStroke:    token.colorBorderSecondary,
    tickLineWidth: 1,
  };
  const timeData = useMemo(() => eventsOverTime(events, dateRange), [events, dateRange]);
  return (
    <Line
      key={plotTheme}
      data={timeData}
      xField="date"
      yField="count"
      height={height}
      theme={plotTheme}
      // Breathing room so edge markers are not halved by the plot boundary
      // (A3: rightmost/topmost points clipped at the card edge).
      insetLeft={6}
      insetRight={10}
      insetTop={8}
      style={{ lineWidth: 1 }}
      point={{ shapeField: 'square', sizeField: 3 }}
      interaction={{ tooltip: { marker: false } }}
      axis={{
        x: { ...axisStyle, labelFormatter: (v: string) => dayjs(v).format('MMM D'), tickCount: 4 },
        y: { ...axisStyle, tickCount: 4 },
      }}
      tooltip={{ title: (d: { date: string }) => isDailyRange(dateRange) ? dayjs(d.date).format('MMM D, YYYY') : `Week of ${dayjs(d.date).format('MMM D, YYYY')}` }}
      onEvent={(_chart, event) => {
        if (event.type !== 'click' || !event.data) return;
        const datum = event.data?.data as { date?: string; weekEnd?: string } | undefined;
        if (datum?.date) router.push(`/events?from=${datum.date}&to=${datum.weekEnd ?? datum.date}`);
      }}
    />
  );
}
