'use client';

import React, { Fragment, useMemo, useState } from 'react';
import { Card, Col, Flex, Row, Statistic, Tag, Space, Typography, theme } from 'antd';
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

// --- helpers (same as dashboard) ---

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

function getPeriodLabel(dateRange: DateRange | null): string {
  if (!dateRange) return 'All time';
  const [start, end] = dateRange;
  const fmt = 'MMM D';
  const yearFmt = 'MMM D, YYYY';
  const sameYear = start.year() === end.year();
  return `${start.format(sameYear ? fmt : yearFmt)} – ${end.format(yearFmt)}`;
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

// --- KPI card (same as dashboard) ---

function KpiCard({
  title, count, prior, accent, href, periodLabel, icon,
}: {
  title: string; count: number; prior: number | null; accent: string; href?: string; periodLabel: string;
  icon: React.ReactNode;
}) {
  const { token } = theme.useToken();
  const diff = prior !== null ? count - prior : null;
  const pct  = (diff !== null && prior !== null && prior > 0)
    ? Math.round((Math.abs(diff) / prior) * 100) : null;
  const up   = diff !== null && diff > 0;

  const deltaText = diff === null
    ? 'Set a date range to compare'
    : diff === 0
    ? 'No change vs. prior period'
    : `${up ? '↑' : '↓'} ${Math.abs(diff).toLocaleString()}${pct !== null ? ` (${pct}%)` : ''} vs. prior period`;

  const deltaColor = diff === null || diff === 0
    ? token.colorTextTertiary
    : up ? token.colorError : token.colorSuccess;

  const wrapStyle: React.CSSProperties = { flex: '1 1 0', minWidth: 160 };

  const card = (
    <Card
      size="small"
      hoverable={!!href}
      title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>{title}</span>}
      extra={<span style={{ fontSize: token.fontSizeSM, color: token.colorTextQuaternary, fontWeight: 400 }}>{periodLabel}</span>}
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

// --- Section header card ---

function SectionHeader({
  label, stats, active, onClick,
}: {
  label: string;
  stats: { value: string | number; sub: string }[];
  active: boolean;
  onClick: () => void;
}) {
  const { token } = theme.useToken();
  const ChevronIcon = active ? CaretDownFilled : CaretRightFilled;
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
        borderLeft: `3px solid ${active ? token.colorPrimary : token.colorBorderSecondary}`,
        transition: 'border-color 0.2s',
      }}
    >
      <Flex align="center" wrap>
        {stats.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div style={{
                width: 1,
                alignSelf: 'stretch',
                background: token.colorBorderSecondary,
                margin: '0 12px',
                flexShrink: 0,
              }} />
            )}
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
      </Flex>
    </Card>
  );
}

// --- page ---

export default function PrototypePage() {
  const { token } = theme.useToken();
  const { dateRange, setDateRange } = useFilterStore();
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string[]>>({});
  const [activeSection, setActiveSection] = useState<Section>('triage');

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

  const priorEvents = useMemo(() => {
    if (!dateRange) return null;
    const duration = dateRange[1].diff(dateRange[0], 'day') + 1;
    const priorStart = dateRange[0].subtract(duration, 'day');
    const priorEnd = dateRange[0].subtract(1, 'day');
    return applyFilters(events, [priorStart, priorEnd], appliedFilters);
  }, [dateRange, appliedFilters]);

  const prior = (fn: (e: QualityEvent) => boolean) =>
    priorEvents ? priorEvents.filter(fn).length : null;

  const periodLabel = getPeriodLabel(dateRange);

  const isReported = (e: QualityEvent) => e.status === 'Reported';
  const isUnderInv = (e: QualityEvent) => e.status === 'Under Investigation';
  const isWaiting  = (e: QualityEvent) => !!e.additionalInfoRequested;

  const kpis = [
    { title: 'Total Events',        count: filteredEvents.length,                   prior: priorEvents?.length ?? null,  accent: token.colorTextSecondary, href: undefined,                            icon: <AppstoreFilled /> },
    { title: 'Reported',            count: filteredEvents.filter(isReported).length, prior: prior(isReported),            accent: token.colorPrimary,       href: '/events?status=Reported',            icon: <FormOutlined /> },
    { title: 'Under Investigation', count: filteredEvents.filter(isUnderInv).length, prior: prior(isUnderInv),            accent: token.colorWarning,       href: '/events?status=Under+Investigation', icon: <SearchOutlined /> },
    { title: 'Waiting on Tech',     count: filteredEvents.filter(isWaiting).length,  prior: prior(isWaiting),             accent: '#722ed1',                href: '/events?flag=additionalInfo',        icon: <HourglassFilled /> },
  ];

  // Section summary stats
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
    const reported  = filteredEvents.filter(e => e.status === 'Reported').length;
    const underInv  = filteredEvents.filter(e => e.status === 'Under Investigation').length;
    const stale     = filteredEvents.filter(e => e.status === 'Reported' && dayjs().diff(dayjs(e.date), 'day') >= 7).length;
    const resolved  = filteredEvents.filter(e => e.status === 'Validated' || e.status === 'Invalidated').length;
    const rate      = filteredEvents.length > 0 ? Math.round((resolved / filteredEvents.length) * 100) : 0;
    return [
      { value: reported, sub: 'reported' },
      { value: underInv, sub: 'under investigation' },
      { value: stale,    sub: 'stale (7d+)' },
      { value: `${rate}%`, sub: 'resolved' },
    ];
  }, [filteredEvents]);

  const orderStats = useMemo(() => {
    const open     = orders.filter(o => o.orderStatus === 'Open').length;
    const approved = orders.filter(o => o.approved).length;
    const closed   = orders.filter(o => o.orderStatus === 'Closed').length;
    return [
      { value: open,     sub: 'open' },
      { value: approved, sub: 'approved' },
      { value: closed,   sub: 'closed' },
    ];
  }, []);

  const toggle = (s: Section) => setActiveSection(prev => prev === s ? prev : s);

  return (
    <>
      <PageHeader
        left={<DateRangeFilter value={dateRange} onChange={setDateRange} />}
        right={
          <FilterPanel
            categories={EVENT_FILTER_CATEGORIES}
            applied={appliedFilters}
            onApply={setAppliedFilters}
          />
        }
      />

      <div style={{ padding: token.paddingMD }}>
        {chips.length > 0 && (
          <Space size={token.marginXS} wrap style={{ marginBottom: token.margin }}>
            {chips.map((chip) => (
              <Tag key={chip} closable onClose={() => removeChip(chip)} closeIcon={<CloseOutlined />}>
                {chip}
              </Tag>
            ))}
          </Space>
        )}

        <Flex vertical gap={token.marginLG}>
          {/* KPI row */}
          <Flex gap={token.marginSM} wrap>
            {kpis.map((k) => (
              <KpiCard key={k.title} {...k} periodLabel={periodLabel} icon={k.icon} />
            ))}
          </Flex>

          {/* AI Summary */}
          <AiSummary events={filteredEvents} dateRange={dateRange} />

          {/* Three section headers */}
          <Row gutter={token.marginSM}>
            <Col xs={24} lg={8}>
              <SectionHeader
                label="Field Intake"
                stats={intakeStats}
                active={activeSection === 'intake'}
                onClick={() => toggle('intake')}
              />
            </Col>
            <Col xs={24} lg={8}>
              <SectionHeader
                label="Triage / Review"
                stats={triageStats}
                active={activeSection === 'triage'}
                onClick={() => toggle('triage')}
              />
            </Col>
            <Col xs={24} lg={8}>
              <SectionHeader
                label="Order Fulfillment"
                stats={orderStats}
                active={activeSection === 'orders'}
                onClick={() => toggle('orders')}
              />
            </Col>
          </Row>

          {/* Expanded section content */}
          <div>
            {activeSection === 'intake' && (
              <FieldIntake events={filteredEvents} dateRange={dateRange} />
            )}
            {activeSection === 'triage' && (
              <TriageReview events={filteredEvents} />
            )}
            {activeSection === 'orders' && (
              <OrderFulfillment events={filteredEvents} orders={orders} />
            )}
          </div>
        </Flex>
      </div>
    </>
  );
}
