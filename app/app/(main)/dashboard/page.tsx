'use client';

import React, { Fragment, Suspense, useEffect, useRef, useMemo, useState } from 'react';
import { AutoComplete, Button, Card, Col, Flex, Grid, Input, Progress, Row, Segmented, Statistic, Tag, Space, Tooltip, theme } from 'antd';
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
import { useScopedEvents, useScopedOrders } from '@/lib/useScopedData';
import { AiSummary } from '@/components/AiSummary';
import { FieldIntake, EventsOverTimeChart, EventsByBranchChart, EventsByIssueChart } from '@/components/FieldIntake';
import { TriageReview, WaitingOnTechChart, DataQualityChart } from '@/components/TriageReview';
import { OrderFulfillment, PendingCSReviewChart, DecisionTrendChart, DeclinedOrdersPreview, DeclinedByBranchChart } from '@/components/OrderFulfillment';
import type { QualityEvent } from '@/data/types';
import type { Order } from '@/data/orders';
import type { DateRange } from '@/components/DateRangeFilter';


type View = 'events' | 'orders';
type EventsSection = 'intake' | 'triage';
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
  const decision = o.declined ? 'Declined' : o.approved ? 'Approved' : 'Pending';
  const matchStatus   = !applied.orderStatus?.length || applied.orderStatus.includes(o.orderStatus);
  const matchDecision = !applied.decision?.length    || applied.decision.includes(decision);
  return matchStatus && matchDecision;
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

function SectionStats({
  stats,
}: {
  stats: { value: string | number; sub: string; progress?: { pct: number; color?: string } }[];
}) {
  const { token } = theme.useToken();
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
    <Flex align="flex-start" style={{ flexWrap: 'nowrap' }}>
      {stats.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && divider}
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            {s.progress ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: token.fontSizeLG, fontWeight: 700, color: token.colorText, lineHeight: 1 }}>
                    {s.value}
                  </span>
                  <span style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary }}>
                    {s.sub}
                  </span>
                </div>
                <Progress
                  percent={s.progress.pct}
                  showInfo={false}
                  size="small"
                  style={{ margin: '8px 0 0' }}
                  strokeColor={s.progress.color ?? token.colorSuccess}
                  railColor={token.colorFillSecondary}
                />
              </>
            ) : (
              <>
                <div style={{ fontSize: token.fontSizeXS, color: token.colorTextTertiary, whiteSpace: 'nowrap' }}>
                  {s.sub}
                </div>
                <div style={{
                  fontSize: token.fontSizeLG,
                  fontWeight: 700,
                  color: token.colorText,
                  lineHeight: 1,
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {s.value}
                </div>
              </>
            )}
          </div>
        </Fragment>
      ))}
    </Flex>
  );
}

function SectionHeader({
  label, stats, active, onClick, tooltip,
}: {
  label: string;
  stats: { value: string | number; sub: string; progress?: { pct: number; color?: string } }[];
  active: boolean;
  onClick: () => void;
  tooltip?: string;
}) {
  const { token } = theme.useToken();
  const [hovered, setHovered] = useState(false);
  const borderColor = active || hovered ? token.colorPrimary : token.colorBorderSecondary;
  return (
    <Card
      size="small"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={
        <span style={{ fontSize: token.fontSizeSM, fontWeight: 500 }}>
          {label}
          {tooltip && <MetricInfoIcon tooltip={tooltip} />}
        </span>
      }
      extra={
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!active && (
            <span style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>
              Click to switch view
            </span>
          )}
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              border: `1.5px solid ${token.colorPrimary}`,
              background: active ? token.colorPrimary : 'transparent',
              transition: 'background-color 0.2s',
            }}
          />
        </span>
      }
      style={{
        cursor: 'pointer',
        height: '100%',
        border: `1px solid ${borderColor}`,
        transition: 'border-color 0.2s, box-shadow 0.18s',
        boxShadow: !active && hovered ? `0 4px 16px ${token.colorPrimary}22` : undefined,
      }}
    >
      <SectionStats stats={stats} />
    </Card>
  );
}


// Builds a URL that carries the active dashboard date range and category filters
// so the destination page (events/orders) opens pre-filtered to match what the
// user was looking at on the dashboard. Base string can include existing params
// (e.g. "?status=Reported") — those keys are preserved and not double-encoded.
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
  const [eventsSection, setEventsSection] = useState<EventsSection>('triage');
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
  const isWaiting     = (e: QualityEvent) => !!e.additionalInfoRequested;
  const isValidated   = (e: QualityEvent) => e.status === 'Validated';
  const isInvalidated = (e: QualityEvent) => e.status === 'Invalidated';

  const kpis = [
    { title: 'Total Event Count',   count: filteredEvents.length,                     prior: priorEvents?.length ?? null, href: buildKpiHref('/events', dateRange, appliedFilters),
      tooltip: 'Total count of events in the selected time period.', swatch: token.colorText },
    { title: 'Reported',            count: filteredEvents.filter(isReported).length,   prior: prior(isReported),           href: buildKpiHref('/events?status=Reported', dateRange, appliedFilters),
      tooltip: 'Events that have been submitted but have not yet been reviewed or assessed.', swatch: STATUS_COLORS.Reported },
    { title: 'Pending Information', count: filteredEvents.filter(isWaiting).length,    prior: prior(isWaiting),            href: buildKpiHref('/events?flag=additionalInfo', dateRange, appliedFilters),
      tooltip: 'Events awaiting requested information from the field.', swatch: '#faad14' },
    { title: 'Under Investigation', count: filteredEvents.filter(isUnderInv).length,    prior: prior(isUnderInv),           href: buildKpiHref('/events?status=Under+Investigation', dateRange, appliedFilters),
      tooltip: 'Events that are actively being reviewed and investigated ahead of a validation decision.', swatch: STATUS_COLORS['Under Investigation'] },
    { title: 'Validated',           count: filteredEvents.filter(isValidated).length,   prior: prior(isValidated),          href: buildKpiHref('/events?status=Validated', dateRange, appliedFilters),
      tooltip: 'Events that have been validated as quality events for further analytics and/or order fulfillment.', deltaTone: 'neutral' as const, swatch: STATUS_COLORS.Validated },
    { title: 'Invalidated',         count: filteredEvents.filter(isInvalidated).length, prior: prior(isInvalidated),        href: buildKpiHref('/events?status=Invalidated', dateRange, appliedFilters),
      tooltip: 'Events that have been invalidated. These events may lack sufficient evidence or may not be true quality events.', deltaTone: 'neutral' as const, swatch: STATUS_COLORS.Invalidated },
  ];

  const intakeStats = useMemo(() => {
    const topComponent = topEntry(filteredEvents, 'component');
    const topIssue      = topEntry(filteredEvents, 'issue');
    return [
      { value: topComponent, sub: 'most affected component' },
      { value: topIssue, sub: 'most common issue' },
    ];
  }, [filteredEvents]);

  const triageStats = useMemo(() => {
    const resolved      = filteredEvents.filter(e => e.status === 'Validated' || e.status === 'Invalidated').length;
    const rate          = filteredEvents.length > 0 ? Math.round((resolved / filteredEvents.length) * 100) : 0;
    const eventsEdited  = filteredEvents.filter(e => e.editHistory?.some(entry => entry.field !== 'Root Cause')).length;
    const editedRate    = filteredEvents.length > 0 ? Math.round((eventsEdited / filteredEvents.length) * 100) : 0;
    return {
      stats: [
        { value: `${rate}%`,       sub: 'events resolved', progress: { pct: rate } },
        { value: `${editedRate}%`, sub: 'events updated' },
      ],
    };
  }, [filteredEvents]);

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
  const isPendingInfoOrder = (o: Order) => o.orderStatus === 'Open' && (eventById.get(o.eventId)?.additionalInfoRequests?.length ?? 0) > 0;
  const isApprovedOrder    = (o: Order) => !!o.approved;
  const isDeclinedOrder    = (o: Order) => !!o.declined;
  const isWithProcurement  = (o: Order) => o.orderStatus === 'Open' && !!o.approved && !!o.assignedToProcurement;

  const orderKpis = [
    { title: 'Total Order Count',   count: filteredOrders.length,                              prior: priorOrders?.length ?? null,   href: buildKpiHref('/orders', dateRange, {}),
      tooltip: 'Total count of orders in the selected time period.', swatch: token.colorText },
    { title: 'New Requests',        count: filteredOrders.filter(isNewRequest).length,          prior: priorOrder(isNewRequest),      href: buildKpiHref('/orders?orderStatus=Open&decision=Pending', dateRange, {}),
      tooltip: 'Orders that have been submitted but have not yet received an approve or decline decision.', swatch: STATUS_COLORS.Reported },
    { title: 'Pending Information', count: filteredOrders.filter(isPendingInfoOrder).length,    prior: priorOrder(isPendingInfoOrder), href: buildKpiHref('/orders?flag=info', dateRange, {}),
      tooltip: 'Orders awaiting requested information from the field.', swatch: '#faad14' },
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
            gridTemplateColumns: screens.md === false ? '1fr 1fr' : 'repeat(6, 1fr)',
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
              <Segmented
                block
                options={
                  view === 'events'
                    ? [{ label: 'Intake', value: 'intake' }, { label: 'Triage', value: 'triage' }]
                    : [{ label: 'Fulfillment', value: 'fulfillment' }, { label: 'Declined', value: 'declined' }]
                }
                value={view === 'events' ? eventsSection : ordersSection}
                onChange={(v) => {
                  if (view === 'events') setEventsSection(v as EventsSection);
                  else setOrdersSection(v as OrdersSection);
                  setCarouselIndex(0);
                  const el = carouselRef.current;
                  if (el) el.scrollLeft = 0;
                }}
                style={{ marginBottom: token.marginSM }}
              />
              {(() => {
                const panels =
                  view === 'events' ? (
                    eventsSection === 'intake' ? [
                      { title: 'Events Over Time',  content: <EventsOverTimeChart events={filteredEvents} dateRange={dateRange} height={200} /> },
                      { title: 'Events by Branch',  content: <EventsByBranchChart events={filteredEvents} height={200} /> },
                      { title: 'By Issue',          content: <EventsByIssueChart events={filteredEvents} height={200} /> },
                    ] : [
                      { title: 'Pending Information',   content: <WaitingOnTechChart events={filteredEvents} /> },
                      { title: 'Poor Submissions by Branch', content: <DataQualityChart events={filteredEvents} /> },
                    ]
                  ) : (
                    ordersSection === 'fulfillment' ? [
                      { title: 'Pending Information', content: <PendingCSReviewChart orders={filteredOrders} /> },
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
          ) : view === 'events' ? (
            <Row gutter={token.marginSM} style={{ alignItems: 'stretch' }}>
              <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column' }}>
                <SectionHeader
                  label="Intake"
                  stats={intakeStats}
                  active={eventsSection === 'intake'}
                  onClick={() => setEventsSection('intake')}
                  tooltip="Intake provides an overview of incoming quality events, including reporting trends, affected components, common issues, and event activity across branches."
                />
              </Col>
              <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column' }}>
                <SectionHeader
                  label="Review"
                  stats={triageStats.stats}
                  active={eventsSection === 'triage'}
                  onClick={() => setEventsSection('triage')}
                  tooltip="Review provides an overview of resolution progress, events awaiting information from the field, and how often event records are being updated across branches."
                />
              </Col>
            </Row>
          ) : null}

          {screens.md !== false && (
            <div>
              {view === 'events' && eventsSection === 'intake' && <FieldIntake events={filteredEvents} dateRange={dateRange} />}
              {view === 'events' && eventsSection === 'triage' && <TriageReview events={filteredEvents} waitingViewAllHref={buildKpiHref('/events?flag=additionalInfo', dateRange, {})} dataQualityViewAllHref={buildKpiHref('/events?flag=edited', dateRange, {})} />}
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
