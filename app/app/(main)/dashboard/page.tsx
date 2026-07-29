'use client';

import React, { Fragment, Suspense, useEffect, useRef, useMemo, useState } from 'react';
import { AutoComplete, Button, Card, Col, Flex, Grid, Input, Row, Segmented, Statistic, Tag, Space, Tooltip, Typography, theme } from 'antd';
import {
  CloseOutlined, SearchOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/PageHeader';
import { FilterPanel } from '@/components/FilterPanel';
import { DateRangeFilter, rangeLabelFor } from '@/components/DateRangeFilter';
import { STATUS_COLORS } from '@/components/StatusTag';
import { EVENT_FILTER_CATEGORIES, ORDER_FILTER_CATEGORIES } from '@/data/filterOptions';
import { useEffectiveEvents, useEffectiveEventMap } from '@/lib/effectiveEvents';
import { orders as allOrders } from '@/data/orders';
import { useFilterStore } from '@/store/filterStore';
import { useOrderStore } from '@/store/orderStore';
import { awaitingTechReply } from '@/components/TechReplyWarning';
import { useScopedEvents, useScopedOrders } from '@/lib/useScopedData';
import { AiSummary } from '@/components/AiSummary';
import { EventsOverTimeChart, EventsByIssueChart, EventsDonutCard } from '@/components/FieldIntake';
import { WaitingOnTechChart, DataQualityChart, EventsUpdatedByFqCard } from '@/components/TriageReview';
import { AwaitingResponseCard, ResponseReceivedCard, ResponseReceivedPreview } from '@/components/EventMessages';
import { OrderFulfillment, PendingCSReviewChart, DecisionTrendChart, DeclinedOrdersPreview, DeclinedByBranchChart } from '@/components/OrderFulfillment';
import type { QualityEvent } from '@/data/types';
import type { Order } from '@/data/orders';
import type { DateRange } from '@/components/DateRangeFilter';


type View = 'events' | 'orders';
type OrdersSection = 'fulfillment' | 'declined';

function applyFilters(list: QualityEvent[], dateRange: DateRange | null, applied: Record<string, string[]>) {
  return list.filter((e) => {
    if (dateRange) {
      const d = dayjs(e.date);
      if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
    }
    const matchStatus      = !applied.status?.length      || applied.status.includes(e.status);
    const matchIssue       = !applied.issue?.length       || applied.issue.includes(e.issue);
    const matchComponent   = !applied.component?.length   || applied.component.includes(e.component);
    const matchRootCause   = !applied.rootCause?.length   || (e.rootCauses ?? (e.rootCause ? [e.rootCause] : [])).some(rc => applied.rootCause.includes(rc));
    const matchBranch      = !applied.branch?.length      || applied.branch.includes(e.branch);
    const matchPlant       = !applied.plant?.length       || applied.plant.includes(e.plant);
    const matchReportedBy  = !applied.reportedBy?.length  || applied.reportedBy.includes(e.reportedBy);
    return matchStatus && matchIssue && matchComponent && matchRootCause && matchBranch && matchPlant && matchReportedBy;
  });
}

// Orders-view category filter predicate (orderStatus + decision).
function matchesOrderFilters(o: Order, applied: Record<string, string[]>): boolean {
  const decision = o.declined ? 'Declined' : o.approved ? 'Approved' : o.consolidated ? 'Consolidated' : 'Pending';
  const matchStatus   = !applied.orderStatus?.length || applied.orderStatus.includes(o.orderStatus);
  const matchDecision = !applied.decision?.length    || applied.decision.includes(decision);
  return matchStatus && matchDecision;
}


function MetricInfoIcon({ tooltip }: { tooltip: string }) {
  const { token } = theme.useToken();
  return (
    <Tooltip title={tooltip}>
      <InfoCircleOutlined
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{ marginLeft: 6, color: token.colorTextTertiary, fontSize: token.fontSizeSM, cursor: 'help' }}
      />
    </Tooltip>
  );
}

function KpiCard({
  title, count, prior, href, tooltip, deltaTone = 'inverse', swatch, dateRange,
}: {
  title: string; count: number; prior: number | null; href?: string;
  tooltip?: string;
  // 'inverse' = more is bad (defect intake: up red, down green).
  // 'neutral' = throughput counts (Validated, Approved) where a swing in either
  // direction isn't inherently good or bad — delta stays gray.
  deltaTone?: 'inverse' | 'neutral';
  swatch?: string;
  dateRange?: DateRange | null;
}) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [hovered, setHovered] = useState(false);
  const diff = prior !== null ? count - prior : null;
  const up   = diff !== null && diff > 0;

  const deltaColor = diff === null || diff === 0 || deltaTone === 'neutral'
    ? token.colorTextTertiary
    : up ? token.colorError : token.colorSuccess;

  const range = dateRange ?? null;
  const rangeName = range
    ? rangeLabelFor(range) ?? `${range[0].format('M/D/YY')} – ${range[1].format('M/D/YY')}`
    : null;

  const fmtWindow = (start: dayjs.Dayjs, end: dayjs.Dayjs) =>
    start.isSame(end, 'day')
      ? end.format('MMM D, YYYY')
      : `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`;

  const deltaTooltip = (() => {
    if (!range || diff === null) return null;
    const duration = range[1].diff(range[0], 'day') + 1;
    const priorStart = range[0].subtract(duration, 'day');
    const priorEnd = range[0].subtract(1, 'day');
    return `Compares ${fmtWindow(range[0], range[1])} against ${fmtWindow(priorStart, priorEnd)} (the preceding ${duration === 1 ? 'day' : `${duration} days`}).`;
  })();

  const deltaLine = diff === null ? (
    <span style={{ color: token.colorTextTertiary }}>
      {isMobile ? 'Set date range' : 'Set a date range to compare'}
    </span>
  ) : (
    <>
      <span style={{ color: deltaColor, fontWeight: 500 }}>
        {diff === 0 ? 'No change' : `${up ? '↑' : '↓'} ${Math.abs(diff).toLocaleString()}`}
      </span>
      {!isMobile && rangeName && (
        <span style={{ color: token.colorTextTertiary }}>
          {diff === 0 ? ' · ' : ' '}{rangeName} vs. prior period
        </span>
      )}
    </>
  );

  const card = (
    <Card
      size="small"
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: token.fontSizeSM, fontWeight: 500 }}>
          {swatch && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: swatch, flexShrink: 0 }} />}
          {title}
          {tooltip && <MetricInfoIcon tooltip={tooltip} />}
        </span>
      }
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
      <div style={{ minWidth: 0 }}>
        <Statistic
          value={count}
          styles={{ content: { fontSize: token.fontSizeHeading3, fontWeight: 700, color: token.colorText, lineHeight: 1.2 } }}
        />
        <div style={{
          fontSize: token.fontSizeSM,
          marginTop: 2,
          minHeight: 16,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {deltaTooltip ? (
            <Tooltip title={deltaTooltip}>
              <span style={{ cursor: 'help' }}>{deltaLine}</span>
            </Tooltip>
          ) : deltaLine}
        </div>
      </div>
    </Card>
  );

  return href
    ? <Link href={href} style={{ textDecoration: 'none', display: 'block', minWidth: 0 }}>{card}</Link>
    : <div style={{ minWidth: 0 }}>{card}</div>;
}

function buildKpiHref(
  base: string,
  dateRange: DateRange | null,
  appliedFilters: Record<string, string[]>,
): string {
  const sepIdx = base.indexOf('?');
  const basePath = sepIdx === -1 ? base : base.slice(0, sepIdx);
  const params = new URLSearchParams(sepIdx === -1 ? '' : base.slice(sepIdx + 1));
  const existingKeys = new Set(params.keys());

  if (dateRange) {
    params.set('from', dateRange[0].format('YYYY-MM-DD'));
    params.set('to', dateRange[1].format('YYYY-MM-DD'));
  }

  for (const [key, vals] of Object.entries(appliedFilters)) {
    if (!existingKeys.has(key) && vals.length) {
      params.set(key, vals.join(','));
    }
  }

  const q = params.toString();
  return q ? `${basePath}?${q}` : basePath;
}

function DashboardPageContent() {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const sidePadding = screens.xxl ? '5%' : screens.xl ? '3.5%' : screens.md === false ? '20px' : `${token.paddingMD + 20}px`;
  const {
    dateRange, setDateRange,
    dashboardFilters: appliedFilters, setDashboardFilters: setAppliedFilters,
    dashboardOrderFilters: orderFilters, setDashboardOrderFilters: setOrderFilters,
  } = useFilterStore();
  const { mutations: orderMutations } = useOrderStore();
  // Branch (View-Only) roles see only their branch's data; everyone else sees all.
  const events = useScopedEvents(useEffectiveEvents());
  const eventById = useEffectiveEventMap();
  const orders = useScopedOrders(allOrders);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setViewState] = useState<View>(searchParams.get('view') === 'orders' ? 'orders' : 'events');
  const setView = (v: View) => {
    setViewState(v);
    router.replace(v === 'orders' ? '/dashboard?view=orders' : '/dashboard', { scroll: false });
  };
  // Keep the view in sync when the URL changes while mounted (e.g. the role
  // switcher navigating to /dashboard?view=orders for Customer Service).
  useEffect(() => {
    // Deliberate URL-to-state sync: the URL is the source of truth for the view
    // (role landings navigate to /dashboard?view=orders while mounted).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewState(searchParams.get('view') === 'orders' ? 'orders' : 'events');
  }, [searchParams]);
  const [ordersSection, setOrdersSection] = useState<OrdersSection>('fulfillment');
  const [searchText, setSearchText] = useState('');

  const searchOptions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return [];
    const matchingEvents = events
      .filter(e => e.id.toLowerCase().includes(q) || e.jobNo.toLowerCase().includes(q))
      .slice(0, 4)
      .map(e => ({
        value: `nav::event::${e.id}`,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.id}</span>
            <span style={{ fontSize: 11, color: token.colorTextTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.jobNo} · {e.issue}</span>
          </div>
        ),
      }));
    const matchingOrders = orders
      .filter(o => o.id.toLowerCase().includes(q) || o.jobNo.toLowerCase().includes(q) || o.eventId.toLowerCase().includes(q))
      .slice(0, 4)
      .map(o => ({
        value: `nav::order::${o.id}`,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.eventId}</span>
            <span style={{ fontSize: 11, color: token.colorTextTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.jobNo}</span>
          </div>
        ),
      }));
    const filterOpts = EVENT_FILTER_CATEGORIES.flatMap(cat =>
      cat.options
        .filter(opt => opt.toLowerCase().includes(q))
        .map(opt => ({ value: `filter::${cat.key}::${opt}`, label: `${cat.label}: ${opt}` }))
    );
    return [
      ...(matchingEvents.length > 0 ? [{ label: 'Go to Event', options: matchingEvents }] : []),
      ...(matchingOrders.length > 0 ? [{ label: 'Go to Order', options: matchingOrders }] : []),
      ...(filterOpts.length > 0 ? [{ label: 'Filter by', options: filterOpts }] : []),
    ];
  }, [searchText, events, orders, token.colorTextTertiary]);

  const handleSearchSelect = (value: string) => {
    setSearchText('');
    if (value.startsWith('nav::event::')) {
      router.push(`/events/${value.slice('nav::event::'.length)}`);
    } else if (value.startsWith('nav::order::')) {
      router.push(`/orders/${value.slice('nav::order::'.length)}`);
    } else if (value.startsWith('filter::')) {
      const rest = value.slice('filter::'.length);
      const sep  = rest.indexOf('::');
      const key  = rest.slice(0, sep);
      const val  = rest.slice(sep + 2);
      setAppliedFilters({ ...appliedFilters, [key]: [...new Set([...(appliedFilters[key] ?? []), val])] });
    }
  };

  // The active view decides which filter domain the header + chips operate on.
  const activeCategories    = view === 'events' ? EVENT_FILTER_CATEGORIES : ORDER_FILTER_CATEGORIES;
  const activeApplied       = view === 'events' ? appliedFilters : orderFilters;
  const setActiveApplied    = view === 'events' ? setAppliedFilters : setOrderFilters;

  const chips = activeCategories.flatMap((cat) =>
    (activeApplied[cat.key] ?? []).map((val) => `${cat.label}: ${val}`)
  );

  const removeChip = (chip: string) => {
    const [catLabel, val] = chip.split(': ');
    const cat = activeCategories.find((c) => c.label === catLabel);
    if (!cat) return;
    const next = { ...activeApplied };
    next[cat.key] = (next[cat.key] ?? []).filter((v) => v !== val);
    setActiveApplied(next);
  };

  const filteredEvents = useMemo(
    () => applyFilters(events, dateRange, appliedFilters),
    [events, dateRange, appliedFilters]
  );

  const effectiveOrders = useMemo(() => orders.map((o: Order) => {
    const m = orderMutations[o.id];
    if (!m) return o;
    return {
      ...o,
      orderStatus:           m.status ?? o.orderStatus,
      approved:              m.approved ?? o.approved,
      declined:              m.declined ?? o.declined,
      declineReason:         m.declineReason ?? o.declineReason,
      assignedToProcurement: m.assignedToProcurement ?? o.assignedToProcurement,
      replacementOrderNo:    m.replacementOrderNo ?? o.replacementOrderNo,
      consolidated:          m.consolidated ?? o.consolidated,
      consolidatedInto:      m.consolidatedInto ?? o.consolidatedInto,
    };
  }), [orders, orderMutations]);

  const filteredOrders = useMemo(() => {
    return effectiveOrders.filter(o => {
      if (dateRange) {
        const d = dayjs(o.lastUpdated, 'MM-DD-YYYY HH:mm');
        if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
      }
      return matchesOrderFilters(o, orderFilters);
    });
  }, [effectiveOrders, dateRange, orderFilters]);

  const priorEvents = useMemo(() => {
    if (!dateRange) return null;
    const duration = dateRange[1].diff(dateRange[0], 'day') + 1;
    const priorStart = dateRange[0].subtract(duration, 'day');
    const priorEnd = dateRange[0].subtract(1, 'day');
    return applyFilters(events, [priorStart, priorEnd], appliedFilters);
  }, [events, dateRange, appliedFilters]);

  const prior = (fn: (e: QualityEvent) => boolean) =>
    priorEvents ? priorEvents.filter(fn).length : null;

  const isReported    = (e: QualityEvent) => e.status === 'Reported';
  const isUnderInv    = (e: QualityEvent) => e.status === 'Under Investigation';
  const isValidated   = (e: QualityEvent) => e.status === 'Validated';
  const isInvalidated = (e: QualityEvent) => e.status === 'Invalidated';

  const kpis = [
    { title: 'Total Event Count',   count: filteredEvents.length,                     prior: priorEvents?.length ?? null, href: buildKpiHref('/events', dateRange, appliedFilters),
      tooltip: 'Total count of events in the selected time period.', swatch: token.colorText },
    { title: 'Reported',            count: filteredEvents.filter(isReported).length,   prior: prior(isReported),           href: buildKpiHref('/events?status=Reported', dateRange, appliedFilters),
      tooltip: 'Events that have been submitted but have not yet been reviewed or assessed.', swatch: STATUS_COLORS.Reported },
    // Lifecycle only: the four stages partition Total. Conversation state
    // (awaiting / replied) lives in the Messages row below, not on this bar.
    { title: 'Under Investigation', count: filteredEvents.filter(isUnderInv).length,    prior: prior(isUnderInv),           href: buildKpiHref('/events?status=Under+Investigation', dateRange, appliedFilters),
      tooltip: 'Events that are actively being reviewed and investigated ahead of a validation decision.', swatch: STATUS_COLORS['Under Investigation'] },
    { title: 'Validated',           count: filteredEvents.filter(isValidated).length,   prior: prior(isValidated),          href: buildKpiHref('/events?status=Validated', dateRange, appliedFilters),
      tooltip: 'Events that have been validated as quality events for further analytics and/or order fulfillment.', deltaTone: 'neutral' as const, swatch: STATUS_COLORS.Validated },
    { title: 'Invalidated',         count: filteredEvents.filter(isInvalidated).length, prior: prior(isInvalidated),        href: buildKpiHref('/events?status=Invalidated', dateRange, appliedFilters),
      tooltip: 'Events that have been invalidated. These events may lack sufficient evidence or may not be true quality events.', deltaTone: 'neutral' as const, swatch: STATUS_COLORS.Invalidated },
  ];



  const priorOrders = useMemo(() => {
    if (!dateRange) return null;
    const duration = dateRange[1].diff(dateRange[0], 'day') + 1;
    const priorStart = dateRange[0].subtract(duration, 'day');
    const priorEnd = dateRange[0].subtract(1, 'day');
    return effectiveOrders.filter(o => {
      const d = dayjs(o.lastUpdated, 'MM-DD-YYYY HH:mm');
      if (d.isBefore(priorStart, 'day') || d.isAfter(priorEnd, 'day')) return false;
      return matchesOrderFilters(o, orderFilters);
    });
  }, [effectiveOrders, dateRange, orderFilters]);

  const priorOrder = (fn: (o: Order) => boolean) =>
    priorOrders ? priorOrders.filter(fn).length : null;

  // Approved/Declined are decisions (either can later close); Open/Closed is the
  // lifecycle. Decision cards count all orders carrying that decision in range.
  const isNewRequest       = (o: Order) => o.orderStatus === 'Open' && !o.approved && !o.declined;
  const isPendingInfoOrder = (o: Order) => o.orderStatus === 'Open' && awaitingTechReply(eventById.get(o.eventId)?.additionalInfoRequests);
  const isApprovedOrder    = (o: Order) => !!o.approved;
  const isDeclinedOrder    = (o: Order) => !!o.declined;
  const isWithProcurement  = (o: Order) => o.orderStatus === 'Open' && !!o.approved && !!o.assignedToProcurement;

  const orderKpis = [
    { title: 'Total Order Count',   count: filteredOrders.length,                              prior: priorOrders?.length ?? null,   href: buildKpiHref('/orders', dateRange, {}),
      tooltip: 'Total count of orders in the selected time period.', swatch: token.colorText },
    { title: 'New Requests',        count: filteredOrders.filter(isNewRequest).length,          prior: priorOrder(isNewRequest),      href: buildKpiHref('/orders?orderStatus=Open&decision=Pending', dateRange, {}),
      tooltip: 'Orders that have been submitted but have not yet received an approve or decline decision.', swatch: STATUS_COLORS.Reported },
    { title: 'Awaiting Response', count: filteredOrders.filter(isPendingInfoOrder).length,    prior: priorOrder(isPendingInfoOrder), href: buildKpiHref('/orders?flag=info', dateRange, {}),
      tooltip: 'More information has been requested from the technician on the linked event. Counts open orders still awaiting the technician\u2019s reply.', swatch: '#faad14' },
    { title: 'Approved',            count: filteredOrders.filter(isApprovedOrder).length,       prior: priorOrder(isApprovedOrder),   href: buildKpiHref('/orders?decision=Approved', dateRange, {}),
      tooltip: 'Orders that have been approved for parts fulfillment, whether still open or closed.', deltaTone: 'neutral' as const, swatch: STATUS_COLORS.Validated },
    { title: 'Declined',            count: filteredOrders.filter(isDeclinedOrder).length,       prior: priorOrder(isDeclinedOrder),   href: buildKpiHref('/orders?decision=Declined', dateRange, {}),
      tooltip: 'Orders that have been declined. These orders may be duplicates, incorrectly configured, or otherwise not qualify for fulfillment.', swatch: '#cf1322' },
    { title: 'With Procurement',    count: filteredOrders.filter(isWithProcurement).length,     prior: priorOrder(isWithProcurement), href: buildKpiHref('/orders?orderStatus=Open&flag=procurement', dateRange, {}),
      tooltip: 'Approved orders that have been handed off to Procurement to source a replacement part.', swatch: '#722ed1' },
  ];

  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  return (
    <>
      <PageHeader
        left={
          <Space size={12}>
            {screens.md && (
              <Segmented
                options={[
                  { label: 'Events', value: 'events' },
                  { label: 'Orders', value: 'orders' },
                ]}
                value={view}
                onChange={(v) => setView(v as View)}
              />
            )}
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          </Space>
        }
        center={
          <AutoComplete
            value={searchText}
            onChange={setSearchText}
            onSelect={handleSearchSelect}
            options={searchOptions}
            placeholder="Search event ID, order ID, job no., branch, component..."
            style={{ width: '100%' }}
            allowClear
          >
            <Input aria-label="Search events and orders" suffix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />} />
          </AutoComplete>
        }
        right={
          <FilterPanel
            categories={activeCategories}
            applied={activeApplied}
            onApply={setActiveApplied}
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
            <Button type="link" size="small" onClick={() => setActiveApplied({})} style={{ padding: '0 4px' }}>
              Clear all
            </Button>
          </div>
        )}

        <Flex vertical gap={token.marginLG}>
          {view === 'events' && <AiSummary events={filteredEvents} dateRange={dateRange} />}

          <div style={{
            display: 'grid',
            gridTemplateColumns: screens.md === false ? '1fr 1fr' : `repeat(${view === 'events' ? 5 : 6}, 1fr)`,
            gap: token.marginSM,
          }}>
            {(view === 'events' ? kpis : orderKpis).map((k) => (
              <KpiCard key={k.title} {...k} dateRange={dateRange} />
            ))}
          </div>

          {screens.md === false ? (
            <div>
              <Segmented
                block
                options={[
                  { label: 'Events', value: 'events' },
                  { label: 'Orders', value: 'orders' },
                ]}
                value={view}
                onChange={(v) => {
                  setView(v as View);
                  setCarouselIndex(0);
                  const el = carouselRef.current;
                  if (el) el.scrollLeft = 0;
                }}
                style={{ marginBottom: token.marginSM }}
              />
              {view === 'orders' && (
                <Segmented
                  block
                  options={[{ label: 'Fulfillment', value: 'fulfillment' }, { label: 'Declined', value: 'declined' }]}
                  value={ordersSection}
                  onChange={(v) => {
                    setOrdersSection(v as OrdersSection);
                    setCarouselIndex(0);
                    const el = carouselRef.current;
                    if (el) el.scrollLeft = 0;
                  }}
                  style={{ marginBottom: token.marginSM }}
                />
              )}
              {(() => {
                const panels =
                  view === 'events' ? [
                      { title: 'Awaiting Response',   content: <WaitingOnTechChart events={filteredEvents} /> },
                      { title: 'Response Received',   content: <ResponseReceivedPreview events={filteredEvents} /> },
                      { title: 'Events Over Time',  content: <EventsOverTimeChart events={filteredEvents} dateRange={dateRange} height={200} /> },
                      { title: 'By Issue',          content: <EventsByIssueChart events={filteredEvents} height={200} /> },
                      { title: 'Events Updated by Field Quality', content: <DataQualityChart events={filteredEvents} /> },
                  ] : (
                    ordersSection === 'fulfillment' ? [
                      { title: 'Awaiting Response', content: <PendingCSReviewChart orders={filteredOrders} /> },
                      { title: 'Decision Trend',     content: <DecisionTrendChart orders={filteredOrders} height={200} /> },
                    ] : [
                      { title: 'Declined Orders',    content: <DeclinedOrdersPreview orders={filteredOrders} /> },
                      { title: 'Declined by Branch', content: <DeclinedByBranchChart orders={filteredOrders} height={200} /> },
                    ]
                  );
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
          ) : null}

          {screens.md !== false && view === 'events' && (
            <>
              {/* Messages: the two conversation lanes of Under Investigation */}
              <Row gutter={[token.marginSM, token.marginSM]} style={{ alignItems: 'stretch' }}>
                <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column' }}>
                  <AwaitingResponseCard events={filteredEvents} viewAllHref={buildKpiHref('/events?flag=additionalInfo', dateRange, {})} />
                </Col>
                <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column' }}>
                  <ResponseReceivedCard events={filteredEvents} viewAllHref={buildKpiHref('/events?flag=responded', dateRange, {})} />
                </Col>
              </Row>

              {/* Analysis: trend, breakdown donut, FQ edit quality */}
              <Row gutter={[token.marginSM, token.marginSM]} style={{ alignItems: 'stretch' }}>
                <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column' }}>
                  <Card
                    size="small"
                    title={
                      <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
                        Events Over Time
                        <MetricInfoIcon tooltip="Events reported per day across the selected period. Click a point to open that day's events in the table." />
                      </span>
                    }
                    style={{ height: '100%' }}
                    styles={{ body: { minHeight: 320, display: 'flex', flexDirection: 'column' } }}
                  >
                    <div style={{ cursor: 'pointer' }}>
                      <EventsOverTimeChart events={filteredEvents} dateRange={dateRange} height={276} />
                    </div>
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, textAlign: 'center', marginTop: 'auto', paddingTop: 8 }}>
                      Click a point to view that day&apos;s events
                    </Typography.Text>
                  </Card>
                </Col>
                <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column' }}>
                  <EventsDonutCard events={filteredEvents} />
                </Col>
                <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column' }}>
                  <EventsUpdatedByFqCard events={filteredEvents} viewAllHref={buildKpiHref('/events?flag=edited', dateRange, {})} />
                </Col>
              </Row>
            </>
          )}

          {screens.md !== false && view === 'orders' && (
            <div>
              {view === 'orders' && (
                <OrderFulfillment
                  orders={filteredOrders}
                  fulfillmentHref={buildKpiHref('/orders?orderStatus=Open', dateRange, {})}
                  declinedHref={buildKpiHref('/orders?decision=Declined', dateRange, {})}
                />
              )}
            </div>
          )}
        </Flex>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardPageContent />
    </Suspense>
  );
}
