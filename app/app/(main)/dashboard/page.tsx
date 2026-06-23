'use client';

import React, { Fragment, useMemo, useState } from 'react';
import { Button, Card, Col, Flex, Grid, Progress, Row, Select, Statistic, Tag, Space, Typography, theme } from 'antd';
import { CloseOutlined, CaretDownFilled, CaretRightFilled, AppstoreFilled, FormOutlined, SearchOutlined, HourglassFilled } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/PageHeader';
import { FilterPanel } from '@/components/FilterPanel';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { EVENT_FILTER_CATEGORIES } from '@/data/filterOptions';
import { events } from '@/data/events';
import { orders } from '@/data/orders';
import { useFilterStore } from '@/store/filterStore';
import { AiSummary } from '@/components/AiSummary';
import { FieldIntake } from '@/components/FieldIntake';
import { TriageReview } from '@/components/TriageReview';
import { OrderFulfillment } from '@/components/OrderFulfillment';
import type { QualityEvent } from '@/data/types';
import type { DateRange } from '@/components/DateRangeFilter';

const { Text } = Typography;

type Section = 'intake' | 'triage' | 'orders';

function applyFilters(list: QualityEvent[], dateRange: DateRange | null, applied: Record<string, string[]>) {
  return list.filter((e) => {
    if (dateRange) {
      const d = dayjs(e.date);
      if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
    }
    const matchDiscrepancy = !applied.discrepancy?.length || applied.discrepancy.includes(e.discrepancy);
    const matchProduct     = !applied.product?.length     || applied.product.includes(e.product);
    const matchRootCause   = !applied.rootCause?.length   || (e.rootCause !== null && applied.rootCause.includes(e.rootCause));
    const matchBranch      = !applied.branch?.length      || applied.branch.includes(e.branch);
    const matchPlant       = !applied.plant?.length       || applied.plant.includes(e.plant);
    const matchReportedBy  = !applied.reportedBy?.length  || applied.reportedBy.includes(e.reportedBy);
    return matchDiscrepancy && matchProduct && matchRootCause && matchBranch && matchPlant && matchReportedBy;
  });
}

function topEntry(events: QualityEvent[], key: keyof QualityEvent): string {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const v = String(e[key] ?? '');
    if (v) counts[v] = (counts[v] ?? 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : '--';
}

function KpiCard({
  title, count, prior, accent, href, icon,
}: {
  title: string; count: number; prior: number | null; accent: string; href?: string;
  icon: React.ReactNode;
}) {
  const { token } = theme.useToken();
  const diff = prior !== null ? count - prior : null;
  const pct  = (diff !== null && prior !== null && prior > 0)
    ? Math.round((Math.abs(diff) / prior) * 100) : null;
  const up   = diff !== null && diff > 0;

  const deltaColor = diff === null || diff === 0
    ? token.colorTextTertiary
    : up ? token.colorError : token.colorSuccess;

  const deltaText = diff === null
    ? 'Set a date range to compare'
    : diff === 0
    ? 'No change vs. prior period'
    : `${up ? '↑' : '↓'} ${Math.abs(diff).toLocaleString()}${pct !== null ? ` (${pct}%)` : ''} vs. prior period`;

  const wrapStyle: React.CSSProperties = { flex: '1 1 0', minWidth: 160 };

  const card = (
    <Card
      size="small"
      hoverable={!!href}
      title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>{title}</span>}
      style={{ cursor: href ? 'pointer' : 'default' }}
      styles={{ header: { padding: '0 16px', minHeight: 32 }, body: { padding: '8px 16px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Statistic
            value={count}
            valueStyle={{ fontSize: token.fontSizeHeading3, fontWeight: 700, color: token.colorText, lineHeight: 1.2 }}
          />
          <div style={{ fontSize: token.fontSizeSM, marginTop: 2, minHeight: 16, color: deltaColor }}>
            {deltaText}
          </div>
        </div>
        <div style={{ fontSize: token.fontSizeHeading2, color: accent, opacity: 0.25, lineHeight: 1 }}>
          {icon}
        </div>
      </div>
    </Card>
  );

  return href
    ? <Link href={href} style={{ ...wrapStyle, textDecoration: 'none', display: 'block' }}>{card}</Link>
    : <div style={wrapStyle}>{card}</div>;
}

function SectionHeader({
  label, stats, active, onClick, progress,
}: {
  label: string;
  stats: { value: string | number; sub: string }[];
  active: boolean;
  onClick: () => void;
  progress?: { pct: number; color?: string };
}) {
  const { token } = theme.useToken();
  const ChevronIcon = active ? CaretDownFilled : CaretRightFilled;
  const divider = (
    <div style={{
      width: 1,
      alignSelf: 'stretch',
      background: token.colorBorderSecondary,
      margin: '0 12px',
      flexShrink: 0,
    }} />
  );
  return (
    <Card
      size="small"
      hoverable
      onClick={onClick}
      title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>{label}</span>}
      extra={
        <ChevronIcon style={{ fontSize: token.fontSizeSM, color: active ? token.colorPrimary : token.colorTextTertiary, transition: 'color 0.2s' }} />
      }
      style={{
        cursor: 'pointer',
        height: '100%',
        borderLeft: `3px solid ${active ? token.colorPrimary : token.colorBorderSecondary}`,
        transition: 'border-color 0.2s',
      }}
    >
      <Flex align="center" style={{ flexWrap: 'nowrap' }}>
        {stats.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && divider}
            <div>
              <div style={{ fontSize: token.fontSizeLG, fontWeight: 700, color: token.colorText, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary, marginTop: 2 }}>
                {s.sub}
              </div>
            </div>
          </Fragment>
        ))}
        {progress && (
          <>
            {stats.length > 0 && divider}
            <Progress
              percent={progress.pct}
              showInfo={false}
              size="small"
              style={{ flex: 1, margin: 0, minWidth: 48 }}
              strokeColor={progress.color ?? token.colorSuccess}
              trailColor={token.colorFillSecondary}
            />
          </>
        )}
      </Flex>
    </Card>
  );
}

const SMART_SEARCH_OPTIONS = EVENT_FILTER_CATEGORIES.map(cat => ({
  label: cat.label,
  options: cat.options.map(opt => ({ value: `${cat.key}::${opt}`, label: opt })),
}));

export default function DashboardPage() {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const sidePadding = screens.xxl ? '5%' : screens.xl ? '3.5%' : `${token.paddingMD + 20}px`;
  const { dateRange, setDateRange } = useFilterStore();
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string[]>>({});
  const [activeSection, setActiveSection] = useState<Section>('triage');

  const selectValue = EVENT_FILTER_CATEGORIES.flatMap(cat =>
    (appliedFilters[cat.key] ?? []).map(v => `${cat.key}::${v}`)
  );

  const handleSmartSearch = (values: string[]) => {
    const next: Record<string, string[]> = {};
    for (const v of values) {
      const sep = v.indexOf('::');
      const key = v.slice(0, sep);
      const val = v.slice(sep + 2);
      if (!next[key]) next[key] = [];
      next[key].push(val);
    }
    setAppliedFilters(next);
  };

  const chips = EVENT_FILTER_CATEGORIES.flatMap((cat) =>
    (appliedFilters[cat.key] ?? []).map((val) => `${cat.label}: ${val}`)
  );

  const removeChip = (chip: string) => {
    const [catLabel, val] = chip.split(': ');
    const cat = EVENT_FILTER_CATEGORIES.find((c) => c.label === catLabel);
    if (!cat) return;
    const next = { ...appliedFilters };
    next[cat.key] = (next[cat.key] ?? []).filter((v) => v !== val);
    setAppliedFilters(next);
  };

  const filteredEvents = useMemo(
    () => applyFilters(events, dateRange, appliedFilters),
    [dateRange, appliedFilters]
  );

  const filteredOrders = useMemo(() => {
    if (!dateRange) return orders;
    return orders.filter(o => {
      const d = dayjs(o.lastUpdated, 'MM-DD-YYYY HH:mm');
      return !d.isBefore(dateRange[0], 'day') && !d.isAfter(dateRange[1], 'day');
    });
  }, [dateRange]);

  const priorEvents = useMemo(() => {
    if (!dateRange) return null;
    const duration = dateRange[1].diff(dateRange[0], 'day') + 1;
    const priorStart = dateRange[0].subtract(duration, 'day');
    const priorEnd = dateRange[0].subtract(1, 'day');
    return applyFilters(events, [priorStart, priorEnd], appliedFilters);
  }, [dateRange, appliedFilters]);

  const prior = (fn: (e: QualityEvent) => boolean) =>
    priorEvents ? priorEvents.filter(fn).length : null;

  const isReported = (e: QualityEvent) => e.status === 'Reported';
  const isUnderInv = (e: QualityEvent) => e.status === 'Under Investigation';
  const isWaiting  = (e: QualityEvent) => !!e.additionalInfoRequested;

  const kpis = [
    { title: 'Total Events',        count: filteredEvents.length,                    prior: priorEvents?.length ?? null, accent: token.colorTextSecondary, href: undefined,                             icon: <AppstoreFilled /> },
    { title: 'Reported',            count: filteredEvents.filter(isReported).length,  prior: prior(isReported),           accent: token.colorPrimary,       href: '/events?status=Reported',             icon: <FormOutlined /> },
    { title: 'Under Investigation', count: filteredEvents.filter(isUnderInv).length,  prior: prior(isUnderInv),           accent: token.colorWarning,       href: '/events?status=Under+Investigation',  icon: <SearchOutlined /> },
    { title: 'Waiting on Tech',     count: filteredEvents.filter(isWaiting).length,   prior: prior(isWaiting),            accent: token.colorTextSecondary,  href: '/events?flag=additionalInfo',         icon: <HourglassFilled /> },
  ];

  const intakeStats = useMemo(() => {
    const topBranch  = topEntry(filteredEvents, 'branch');
    const topDisc    = topEntry(filteredEvents, 'discrepancy');
    const shortDisc  = topDisc.length > 18 ? topDisc.slice(0, 17) + '…' : topDisc;
    const topProduct = topEntry(filteredEvents, 'product');
    const shortProd  = topProduct.length > 18 ? topProduct.slice(0, 17) + '…' : topProduct;
    return [
      { value: topBranch, sub: 'top branch' },
      { value: shortProd, sub: 'top product' },
      { value: shortDisc, sub: 'top discrepancy' },
    ];
  }, [filteredEvents]);

  const triageStats = useMemo(() => {
    const resolved = filteredEvents.filter(e => e.status === 'Validated' || e.status === 'Invalidated').length;
    const rate     = filteredEvents.length > 0 ? Math.round((resolved / filteredEvents.length) * 100) : 0;
    return {
      stats: [{ value: `${rate}%`, sub: 'events resolved' }],
      progress: { pct: rate },
    };
  }, [filteredEvents, filteredOrders]);

  const orderStats = useMemo(() => {
    const total    = filteredOrders.length;
    const open     = filteredOrders.filter(o => o.orderStatus === 'Open').length;
    const approved = filteredOrders.filter(o => o.approved).length;
    const closed   = filteredOrders.filter(o => o.orderStatus === 'Closed').length;
    const pct      = total > 0 ? Math.round((closed / total) * 100) : 0;
    return {
      stats: [
        { value: `${open} / ${total}`, sub: 'open / total' },
        { value: approved,             sub: 'approved' },
        { value: `${pct}%`,            sub: 'fulfilled' },
      ],
      progress: { pct },
    };
  }, [filteredOrders]);

  const toggle = (s: Section) => setActiveSection(prev => prev === s ? prev : s);

  return (
    <>
      <PageHeader
        left={<DateRangeFilter value={dateRange} onChange={setDateRange} />}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="Search branch, product, discrepancy..."
              options={SMART_SEARCH_OPTIONS}
              value={selectValue}
              onChange={handleSmartSearch}
              maxTagCount="responsive"
              style={{ width: 320 }}
              suffixIcon={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
              allowClear
            />
            <FilterPanel
              categories={EVENT_FILTER_CATEGORIES}
              applied={appliedFilters}
              onApply={setAppliedFilters}
            />
          </div>
        }
      />

      <div style={{ padding: `${token.paddingMD}px ${sidePadding}` }}>
        {chips.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: token.marginXS, marginBottom: token.margin }}>
            {chips.map((chip) => (
              <Tag key={chip} closable onClose={() => removeChip(chip)} closeIcon={<CloseOutlined />} style={{ margin: 0 }}>
                {chip}
              </Tag>
            ))}
            <Button type="link" size="small" onClick={() => setAppliedFilters({})} style={{ padding: '0 4px' }}>
              Clear all
            </Button>
          </div>
        )}

        <Flex vertical gap={token.marginLG}>
          <AiSummary events={filteredEvents} dateRange={dateRange} />

          <Flex gap={token.marginSM} wrap>
            {kpis.map((k) => (
              <KpiCard key={k.title} {...k} />
            ))}
          </Flex>

          <Row gutter={token.marginSM} style={{ alignItems: 'stretch' }}>
            <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column' }}>
              <SectionHeader
                label="Field Intake"
                stats={intakeStats}
                active={activeSection === 'intake'}
                onClick={() => toggle('intake')}
              />
            </Col>
            <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column' }}>
              <SectionHeader
                label="Triage / Review"
                stats={triageStats.stats}
                active={activeSection === 'triage'}
                onClick={() => toggle('triage')}
                progress={triageStats.progress}
              />
            </Col>
            <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column' }}>
              <SectionHeader
                label="Order Fulfillment"
                stats={orderStats.stats}
                active={activeSection === 'orders'}
                onClick={() => toggle('orders')}
                progress={orderStats.progress}
              />
            </Col>
          </Row>

          <div>
            {activeSection === 'intake'  && <FieldIntake events={filteredEvents} dateRange={dateRange} />}
            {activeSection === 'triage'  && <TriageReview events={filteredEvents} />}
            {activeSection === 'orders'  && <OrderFulfillment events={filteredEvents} />}
          </div>
        </Flex>
      </div>
    </>
  );
}
