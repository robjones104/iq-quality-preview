'use client';

import React, { Fragment, useRef, useMemo, useState } from 'react';
import { Button, Card, Col, Flex, Grid, Progress, Row, Segmented, Select, Statistic, Tag, Space, Typography, theme } from 'antd';
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
import { FieldIntake, EventsOverTimeChart, EventsByBranchChart, EventsByDiscrepancyChart } from '@/components/FieldIntake';
import { TriageReview, QueueHealthChart, WaitingOnTechChart, DataQualityChart } from '@/components/TriageReview';
import { OrderFulfillment, PendingCSReviewChart, OrderPipelineChart, DecisionTrendChart } from '@/components/OrderFulfillment';
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
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [hovered, setHovered] = useState(false);
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

  const mobileDeltaText = diff === null
    ? 'Set date range'
    : diff === 0
    ? 'No change'
    : `${up ? '↑' : '↓'} ${Math.abs(diff).toLocaleString()}${pct !== null ? ` (${pct}%)` : ''}`;

  const card = (
    <Card
      size="small"
      title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>{title}</span>}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: href ? 'pointer' : 'default',
        transition: 'transform 0.18s, box-shadow 0.18s',
        transform: href && hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: href && hovered ? `0 8px 24px ${token.colorPrimary}33` : undefined,
      }}
      styles={{
        header: { padding: '0 16px', minHeight: 32 },
        body: { padding: '8px 16px' },
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <Statistic
            value={count}
            valueStyle={{ fontSize: token.fontSizeHeading3, fontWeight: 700, color: token.colorText, lineHeight: 1.2 }}
          />
          <div style={{
            fontSize: token.fontSizeSM,
            marginTop: 2,
            minHeight: 16,
            color: deltaColor,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {isMobile ? mobileDeltaText : deltaText}
          </div>
        </div>
        {!isMobile && (
          <div style={{ fontSize: token.fontSizeHeading2, color: accent, opacity: 0.25, lineHeight: 1, flexShrink: 0 }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );

  return href
    ? <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{card}</Link>
    : <div>{card}</div>;
}

function SectionHeader({
  label, stats, active, onClick, progress,
}: {
  label: string;
  stats: { value: string | number; sub: string }[];
  active: boolean;
  onClick: () => void;
  progress?: { pct: number; color?: string; resolved?: number; total?: number };
}) {
  const { token } = theme.useToken();
  const [hovered, setHovered] = useState(false);
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
  const borderColor = active
    ? token.colorPrimary
    : hovered ? `${token.colorPrimary}66` : token.colorBorderSecondary;
  return (
    <Card
      size="small"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>{label}</span>}
      extra={
        <ChevronIcon style={{ fontSize: token.fontSizeSM, color: active ? token.colorPrimary : hovered ? `${token.colorPrimary}99` : token.colorTextTertiary, transition: 'color 0.2s' }} />
      }
      style={{
        cursor: 'pointer',
        height: '100%',
        borderLeft: `3px solid ${borderColor}`,
        transition: 'border-color 0.2s, box-shadow 0.18s',
        boxShadow: !active && hovered ? `0 4px 16px ${token.colorPrimary}22` : undefined,
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
            <div style={{ flex: 1, minWidth: 48, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Progress
                percent={progress.pct}
                showInfo={false}
                size="small"
                style={{ margin: 0 }}
                strokeColor={progress.color ?? token.colorSuccess}
                trailColor={token.colorFillSecondary}
              />
              {progress.resolved !== undefined && progress.total !== undefined && (
                <div style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>
                  {progress.resolved} resolved / {progress.total} total
                </div>
              )}
            </div>
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
  const sidePadding = screens.xxl ? '5%' : screens.xl ? '3.5%' : screens.md === false ? '20px' : `${token.paddingMD + 20}px`;
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
    const resolved      = filteredEvents.filter(e => e.status === 'Validated' || e.status === 'Invalidated').length;
    const rate          = filteredEvents.length > 0 ? Math.round((resolved / filteredEvents.length) * 100) : 0;
    const eventsEdited  = filteredEvents.filter(e => !!e.editHistory?.length).length;
    const reclassRate   = filteredEvents.length > 0 ? Math.round((eventsEdited / filteredEvents.length) * 100) : 0;
    return {
      stats: [
        { value: `${rate}%`,       sub: 'events resolved' },
        { value: `${reclassRate}%`, sub: 'events recategorized' },
      ],
      progress: { pct: rate, resolved, total: filteredEvents.length },
    };
  }, [filteredEvents]);

  const orderStats = useMemo(() => {
    const total   = filteredOrders.length;
    const pending = filteredOrders.filter(o => o.orderStatus === 'Open' && !o.approved && !o.declined).length;
    const closed  = filteredOrders.filter(o => o.orderStatus === 'Closed').length;
    const pct     = total > 0 ? Math.round((closed / total) * 100) : 0;
    return {
      stats: [
        { value: pending,    sub: 'pending review' },
        { value: `${pct}%`, sub: 'fulfilled' },
      ],
      progress: { pct, resolved: closed, total },
    };
  }, [filteredOrders]);

  const toggle = (s: Section) => setActiveSection(prev => prev === s ? prev : s);
  const carouselRef = useRef<HTMLDivElement>(null);
  const SECTIONS: Section[] = ['intake', 'triage', 'orders'];
  const [carouselIndex, setCarouselIndex] = useState(0);

  return (
    <>
      <PageHeader
        left={<DateRangeFilter value={dateRange} onChange={setDateRange} />}
        center={
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            placeholder="Search branch, product, discrepancy..."
            options={SMART_SEARCH_OPTIONS}
            value={selectValue}
            onChange={handleSmartSearch}
            maxTagCount="responsive"
            style={{ width: '100%' }}
            suffixIcon={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
            allowClear
          />
        }
        right={
          <FilterPanel
            categories={EVENT_FILTER_CATEGORIES}
            applied={appliedFilters}
            onApply={setAppliedFilters}
          />
        }
      />

      <div style={{ padding: `${token.paddingMD}px ${sidePadding}` }}>
        {screens.md !== false && chips.length > 0 && (
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

          <div style={{
            display: 'grid',
            gridTemplateColumns: screens.md === false ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: token.marginSM,
          }}>
            {kpis.map((k) => (
              <KpiCard key={k.title} {...k} />
            ))}
          </div>

          {screens.md === false ? (
            <div>
              <Segmented
                block
                options={[
                  { label: 'Intake', value: 'intake' },
                  { label: 'Triage', value: 'triage' },
                  { label: 'Orders', value: 'orders' },
                ]}
                value={activeSection}
                onChange={(v) => {
                  setActiveSection(v as Section);
                  setCarouselIndex(0);
                  const el = carouselRef.current;
                  if (el) el.scrollLeft = 0;
                }}
                style={{ marginBottom: token.marginSM }}
              />
              {(() => {
                const panels =
                  activeSection === 'intake' ? [
                    { title: 'Events Over Time',  content: <EventsOverTimeChart events={filteredEvents} dateRange={dateRange} height={200} /> },
                    { title: 'Events by Branch',  content: <EventsByBranchChart events={filteredEvents} height={200} /> },
                    { title: 'By Discrepancy',    content: <EventsByDiscrepancyChart events={filteredEvents} height={200} /> },
                  ] : activeSection === 'triage' ? [
                    { title: 'Queue Health',      content: <QueueHealthChart events={filteredEvents} /> },
                    { title: 'Waiting on Tech',   content: <WaitingOnTechChart events={filteredEvents} /> },
                    { title: 'Data Quality',      content: <DataQualityChart events={filteredEvents} /> },
                  ] : [
                    { title: 'Pending CS Review', content: <PendingCSReviewChart orders={filteredOrders} /> },
                    { title: 'Order Pipeline',    content: <OrderPipelineChart orders={filteredOrders} /> },
                    { title: 'Decision Trend',    content: <DecisionTrendChart orders={filteredOrders} height={200} /> },
                  ];
                return (
                  <>
                    <div
                      ref={carouselRef}
                      onScroll={() => {
                        const el = carouselRef.current;
                        if (!el) return;
                        const step = el.offsetWidth - 20;
                        const mod = el.scrollLeft % step;
                        if (mod < 8 || mod > step - 8) {
                          setCarouselIndex(Math.min(Math.max(Math.round(el.scrollLeft / step), 0), panels.length - 1));
                        }
                      }}
                      style={{ display: 'flex', gap: 12, overflowX: 'scroll', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
                    >
                      {panels.map(({ title, content }) => (
                        <div key={title} style={{ width: 'calc(100% - 32px)', flexShrink: 0, scrollSnapAlign: 'start' }}>
                          <Card size="small" title={<span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>{title}</span>}>
                            {content}
                          </Card>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: token.marginXS }}>
                      {panels.map((_, i) => (
                        <div
                          key={i}
                          style={{
                            height: 6,
                            width: carouselIndex === i ? 18 : 6,
                            borderRadius: 3,
                            background: carouselIndex === i ? token.colorPrimary : token.colorFillTertiary,
                            transition: 'all 0.2s ease',
                          }}
                        />
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
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
          )}

          {screens.md !== false && (
            <div>
              {activeSection === 'intake'  && <FieldIntake events={filteredEvents} dateRange={dateRange} />}
              {activeSection === 'triage'  && <TriageReview events={filteredEvents} />}
              {activeSection === 'orders'  && <OrderFulfillment events={filteredEvents} orders={filteredOrders} />}
            </div>
          )}
        </Flex>
      </div>
    </>
  );
}
