'use client';

import React, { Fragment, Suspense, useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { AutoComplete, Button, Card, Col, Flex, Grid, Input, Row, Segmented, Statistic, Tag, Space, Tooltip, Typography, theme } from 'antd';
import {
  CloseOutlined, SearchOutlined, InfoCircleOutlined, PlusOutlined,
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
import { partyAwaiting, partyResponded } from '@/components/TechReplyWarning';
import { orders as allOrders } from '@/data/orders';
import { useFilterStore } from '@/store/filterStore';
import { useOrderStore } from '@/store/orderStore';
import { useScopedEvents, useScopedOrders } from '@/lib/useScopedData';
import { useCapabilities } from '@/store/roleStore';
import { AiSummary } from '@/components/AiSummary';
import { EventsOverTimeChart, EventsByIssueChart, EventsDonutCard } from '@/components/FieldIntake';
import { DataQualityChart, EventsUpdatedByFqCard } from '@/components/TriageReview';
import { ResponseReceivedCard, ResponseReceivedPreview } from '@/components/EventMessages';
import { BranchResponseQueue } from '@/components/BranchResponseQueue';
import { DecisionTrendChart, DeclinedOrdersPreview, DeclinedCsvButton } from '@/components/OrderFulfillment';
import { OrderResponseReceivedCard, OrderResponseReceivedPreview } from '@/components/OrderWork';
import type { AdditionalInfoRequest, QualityEvent } from '@/data/types';
import type { Order } from '@/data/orders';
import type { DateRange } from '@/components/DateRangeFilter';


type View = 'events' | 'orders';

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

// Orders-view category filter predicate (stage + assignment; the activity
// category needs the event thread, supplied by the caller).
function matchesOrderFilters(
  o: Order,
  applied: Record<string, string[]>,
  threadOf?: (eventId: string) => AdditionalInfoRequest[] | undefined,
): boolean {
  const stage = o.declined ? 'Declined' : o.approved ? (o.orderStatus === 'Open' ? 'Approved' : 'Fulfilled') : 'Pending Decision';
  const matchStage      = !applied.stage?.length      || applied.stage.includes(stage);
  const matchAssignment = !applied.assignment?.length || applied.assignment.some(a =>
    o.orderStatus === 'Open' && !!o.approved &&
    (a === 'With Fulfillment' ? !!o.assignedToFulfillment : !o.assignedToFulfillment));
  const matchActivity   = !applied.activity?.length   || applied.activity.some(a => {
    if (o.orderStatus !== 'Open') return false;
    const thread = threadOf?.(o.eventId);
    return a === 'Additional Requests'
      ? partyAwaiting(thread, 'Customer Service')
      : partyResponded(thread, 'Customer Service');
  });
  return matchStage && matchAssignment && matchActivity;
}




// A status card holding two equal stage lanes (Open: Pending Decision +
// Approved; Closed: Fulfilled + Declined). Lane = metric with its label
// below, own link, own tooltip; hairline divider between lanes.
type KpiLane = { label: string; count: number; href: string; tooltip: string; swatch: string; prior: number | null; deltaTone?: 'inverse' | 'neutral' };

function SplitKpiCard({ title, tooltip, lanes, dateRange }: { title: string; tooltip?: string; lanes: [KpiLane, KpiLane]; dateRange?: DateRange | null }) {
  const { token } = theme.useToken();
  const router = useRouter();
  const [hovered, setHovered] = useState<number | null>(null);
  // The state-grammar tooltip targets only the number + label block, so it
  // and the delta's own tooltip can never be open at the same time.
  const lane = (l: KpiLane, i: number) => (
    <div
      key={l.label}
      role="button"
      tabIndex={0}
      onClick={() => router.push(l.href)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(l.href); } }}
      onMouseEnter={() => setHovered(i)}
      onMouseLeave={() => setHovered(null)}
      aria-label={`${l.label}: ${l.count}`}
      style={{
        flex: 1,
        minWidth: 0,
        cursor: 'pointer',
        borderRadius: token.borderRadiusSM,
        padding: '2px 8px',
        margin: '-2px 0',
        background: hovered === i ? token.colorFillTertiary : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <Tooltip title={l.tooltip} mouseLeaveDelay={0}>
        <div>
          <div style={{ fontSize: token.fontSizeHeading3, fontWeight: 700, color: token.colorText, lineHeight: 1.2 }}>
            {l.count.toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, minHeight: 16 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: l.swatch, flexShrink: 0 }} />
            <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {l.label}
            </span>
          </div>
        </div>
      </Tooltip>
      <KpiDelta count={l.count} prior={l.prior} deltaTone={l.deltaTone} dateRange={dateRange} />
    </div>
  );
  return (
    <Card
      size="small"
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: token.fontSizeSM, fontWeight: 500 }}>
          {title}
          {tooltip && <MetricInfoIcon tooltip={tooltip} />}
        </span>
      }
      style={{ gridColumn: 'span 2', height: '100%' }}
      styles={{
        header: { padding: '0 16px', minHeight: 32 },
        body: { padding: '8px 16px' },
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
        {lane(lanes[0], 0)}
        <div style={{ width: 1, background: token.colorBorderSecondary, alignSelf: 'stretch', flexShrink: 0 }} />
        {lane(lanes[1], 1)}
      </div>
    </Card>
  );
}

// The delta line shared by every KPI surface: plain cards and split-card
// lanes render the identical comparison UI.
function KpiDelta({ count, prior, deltaTone = 'inverse', dateRange }: {
  count: number; prior: number | null; deltaTone?: 'inverse' | 'neutral'; dateRange?: DateRange | null;
}) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const diff = prior !== null ? count - prior : null;
  const up   = diff !== null && diff > 0;
  // Status-colored text reads the seeded *Text tokens (AA in both themes);
  // the raw colorError/colorSuccess fills are 2.3-3.3:1 as text.
  const deltaColor = diff === null || diff === 0 || deltaTone === 'neutral'
    ? token.colorTextTertiary
    : up ? token.colorErrorText : token.colorSuccessText;
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
  return (
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
  );
}

function MetricInfoIcon({ tooltip }: { tooltip: string }) {
  const { token } = theme.useToken();
  // A raw 12px icon fails the 24px target floor (WCAG 2.5.8); the button hits
  // it while negative margin keeps the visual footprint unchanged.
  return (
    <Tooltip title={tooltip}>
      <button
        type="button"
        aria-label={tooltip}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{
          width: 24, height: 24, margin: '-6px 0', padding: 0, marginLeft: 0,
          border: 'none', background: 'transparent', cursor: 'help',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: token.colorTextTertiary, fontSize: token.fontSizeSM,
        }}
      >
        <InfoCircleOutlined />
      </button>
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
  const [hovered, setHovered] = useState(false);

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
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.18s, box-shadow 0.18s',
        transform: href && hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: href && hovered ? `0 8px 24px ${token.colorPrimary}33` : undefined,
      }}
      styles={{
        header: { padding: '0 16px', minHeight: 32 },
        body: { padding: '8px 16px', flex: 1, display: 'flex', flexDirection: 'column' },
      }}
    >
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Statistic
          value={count}
          styles={{ content: { fontSize: token.fontSizeHeading3, fontWeight: 700, color: token.colorText, lineHeight: 1.2 } }}
        />
        {/* Spare space stays open (future sparkline home); delta pins to the
            bottom, aligned with the split lanes' delta lines. */}
        <div style={{ marginTop: 'auto' }}>
          <KpiDelta count={count} prior={prior} deltaTone={deltaTone} dateRange={dateRange} />
        </div>
      </div>
    </Card>
  );

  return href
    ? <Link href={href} style={{ textDecoration: 'none', display: 'block', minWidth: 0, height: '100%' }}>{card}</Link>
    : <div style={{ minWidth: 0, height: '100%' }}>{card}</div>;
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
  const orders = useScopedOrders(allOrders);
  // Branch-scoped viewers lose the Events Updated by FQ card (a by-branch
  // breakdown is meaningless inside one branch); the two remaining analysis
  // cards widen to fill the row.
  const caps = useCapabilities();
  const branchScoped = caps.branchScoped;

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
      assignedToFulfillment: m.assignedToFulfillment ?? o.assignedToFulfillment,
      replacementOrderNo:    m.replacementOrderNo ?? o.replacementOrderNo,
    };
  }), [orders, orderMutations]);

  const effEventMapForThreads = useEffectiveEventMap();
  const threadOf = useCallback(
    (eventId: string): AdditionalInfoRequest[] | undefined => effEventMapForThreads.get(eventId)?.additionalInfoRequests,
    [effEventMapForThreads]);

  const filteredOrders = useMemo(() => {
    return effectiveOrders.filter(o => {
      if (dateRange) {
        const d = dayjs(o.lastUpdated, 'MM-DD-YYYY HH:mm');
        if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
      }
      return matchesOrderFilters(o, orderFilters, threadOf);
    });
  }, [effectiveOrders, dateRange, orderFilters, threadOf]);

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

  // Unified state grammar (Rob, 2026-08-04): Open/Closed is the container,
  // the lifecycle stage is the lane — same anatomy as the Orders bar. The
  // event's Open/Closed is derived (Reported/UI are open; Validated/
  // Invalidated are closed). Lane tooltips are Rob's copy, unchanged.
  const eventTotalKpi = {
    title: 'Total Event Count',
    count: filteredEvents.length,
    prior: priorEvents?.length ?? null,
    href: buildKpiHref('/events', dateRange, appliedFilters),
    tooltip: 'Total count of events in the selected time period.',
    swatch: token.colorText,
  };

  const eventOpenLanes: [KpiLane, KpiLane] = [
    { label: 'Reported', count: filteredEvents.filter(isReported).length, prior: prior(isReported), swatch: STATUS_COLORS.Reported,
      href: buildKpiHref('/events?status=Reported', dateRange, appliedFilters),
      tooltip: 'Events that have been submitted but have not yet been reviewed or assessed.' },
    { label: 'Under Investigation', count: filteredEvents.filter(isUnderInv).length, prior: prior(isUnderInv), swatch: STATUS_COLORS['Under Investigation'],
      href: buildKpiHref('/events?status=Under+Investigation', dateRange, appliedFilters),
      tooltip: 'Events that are actively being reviewed and investigated ahead of a validation decision.' },
  ];

  const eventClosedLanes: [KpiLane, KpiLane] = [
    { label: 'Validated', count: filteredEvents.filter(isValidated).length, prior: prior(isValidated), deltaTone: 'neutral', swatch: STATUS_COLORS.Validated,
      href: buildKpiHref('/events?status=Validated', dateRange, appliedFilters),
      tooltip: 'Events that have been validated as quality events for further analytics and/or order fulfillment.' },
    { label: 'Invalidated', count: filteredEvents.filter(isInvalidated).length, prior: prior(isInvalidated), deltaTone: 'neutral', swatch: STATUS_COLORS.Invalidated,
      href: buildKpiHref('/events?status=Invalidated', dateRange, appliedFilters),
      tooltip: 'Events that have been invalidated. These events may lack sufficient evidence or may not be true quality events.' },
  ];



  const priorOrders = useMemo(() => {
    if (!dateRange) return null;
    const duration = dateRange[1].diff(dateRange[0], 'day') + 1;
    const priorStart = dateRange[0].subtract(duration, 'day');
    const priorEnd = dateRange[0].subtract(1, 'day');
    return effectiveOrders.filter(o => {
      const d = dayjs(o.lastUpdated, 'MM-DD-YYYY HH:mm');
      if (d.isBefore(priorStart, 'day') || d.isAfter(priorEnd, 'day')) return false;
      return matchesOrderFilters(o, orderFilters, threadOf);
    });
  }, [effectiveOrders, dateRange, orderFilters, threadOf]);

  // The pipeline bar: Total, then the STATUS axis as two split cards whose
  // lanes are the stages. Open = Pending Decision + Approved; Closed =
  // Fulfilled + Declined. Grid: 1 + 2 + 2 columns, so each lane is exactly
  // one Events-card wide.
  const liveOrders  = filteredOrders;
  const priorLive   = priorOrders;
  const priorLiveN  = (fn: (o: Order) => boolean) => priorLive ? priorLive.filter(fn).length : null;
  const isPendingDecision = (o: Order) => o.orderStatus === 'Open' && !o.approved && !o.declined;
  const isApprovedOpen    = (o: Order) => o.orderStatus === 'Open' && !!o.approved;
  const isFulfilled       = (o: Order) => o.orderStatus === 'Closed' && !!o.approved;
  const isDeclinedOrder   = (o: Order) => !!o.declined;

  const orderTotalKpi = {
    title: 'Total Order Count',
    count: liveOrders.length,
    prior: priorLive?.length ?? null,
    href: buildKpiHref('/orders', dateRange, {}),
    tooltip: 'Total count of orders in the selected time period.',
    swatch: token.colorText,
  };

  const openLanes: [KpiLane, KpiLane] = [
    { label: 'Pending Decision', count: liveOrders.filter(isPendingDecision).length, prior: priorLiveN(isPendingDecision), swatch: STATUS_COLORS.Reported,
      href: buildKpiHref('/orders?stage=Pending Decision', dateRange, {}),
      tooltip: 'Orders that are waiting for Customer Service to approve or decline.' },
    { label: 'Approved', count: liveOrders.filter(isApprovedOpen).length, prior: priorLiveN(isApprovedOpen), deltaTone: 'neutral',
      swatch: '#13c2c2',
      href: buildKpiHref('/orders?stage=Approved', dateRange, {}),
      tooltip: 'Orders that have been approved and are being fulfilled.' },
  ];

  const closedLanes: [KpiLane, KpiLane] = [
    { label: 'Fulfilled', count: liveOrders.filter(isFulfilled).length, prior: priorLiveN(isFulfilled), deltaTone: 'neutral', swatch: STATUS_COLORS.Validated,
      href: buildKpiHref('/orders?stage=Fulfilled', dateRange, {}),
      tooltip: 'Orders that were approved and closed after the replacement order was placed.' },
    { label: 'Declined', count: liveOrders.filter(isDeclinedOrder).length, prior: priorLiveN(isDeclinedOrder), swatch: '#595959',
      href: buildKpiHref('/orders?stage=Declined', dateRange, {}),
      tooltip: 'Orders that were declined and closed. Declined orders can be reopened if needed.' },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FilterPanel
              categories={activeCategories}
              applied={activeApplied}
              onApply={setActiveApplied}
            />
            {caps.intake && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/intake/new')}>
                Report a Quality Event
              </Button>
            )}
          </div>
        }
      />

      <div style={{ padding: `${token.paddingMD}px ${sidePadding}` }}>
        {screens.md !== false && chips.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: token.marginXS, marginBottom: token.margin }}>
            {chips.map((chip) => (
              <Tag
                key={chip}
                closable
                onClose={() => removeChip(chip)}
                closeIcon={
                  // Padding grows the close target to 24x24; the negative margin cancels it visually.
                  <span
                    role="img"
                    aria-label={`Remove filter ${chip}`}
                    style={{ display: 'inline-flex', padding: 7, margin: -7 }}
                  >
                    <CloseOutlined />
                  </span>
                }
                style={{ margin: 0 }}
              >
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
            gridTemplateColumns: screens.md === false ? '1fr 1fr' : 'repeat(5, 1fr)',
            gap: token.marginSM,
          }}>
            {view === 'events'
              ? (
                <>
                  <KpiCard {...eventTotalKpi} dateRange={dateRange} />
                  <SplitKpiCard
                    title="Open"
                    tooltip="Events that are still open: newly reported or under investigation."
                    lanes={eventOpenLanes}
                    dateRange={dateRange}
                  />
                  <SplitKpiCard
                    title="Closed"
                    tooltip="Events that have been closed: validated or invalidated."
                    lanes={eventClosedLanes}
                    dateRange={dateRange}
                  />
                </>
              )
              : (
                <>
                  <KpiCard {...orderTotalKpi} dateRange={dateRange} />
                  <SplitKpiCard
                    title="Open"
                    tooltip="Orders that are still open: waiting on a decision or approved and being fulfilled."
                    lanes={openLanes}
                    dateRange={dateRange}
                  />
                  <SplitKpiCard
                    title="Closed"
                    tooltip="Orders that have been closed: fulfilled or declined."
                    lanes={closedLanes}
                    dateRange={dateRange}
                  />
                </>
              )}
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

              {(() => {
                const panels =
                  view === 'events' ? [                      { title: 'Needs Your Response',   content: <ResponseReceivedPreview events={filteredEvents} /> },
                      { title: 'Events Over Time',  content: <EventsOverTimeChart events={filteredEvents} dateRange={dateRange} height={200} /> },
                      { title: 'By Issue',          content: <EventsByIssueChart events={filteredEvents} height={200} /> },
                      ...(branchScoped ? [] : [{ title: 'Events Updated by Field Quality', content: <DataQualityChart events={filteredEvents} /> }]),
                  ] : [                      { title: 'Needs Your Response',  content: <OrderResponseReceivedPreview orders={liveOrders} /> },
                      { title: 'Decision Trend',     content: <DecisionTrendChart orders={liveOrders} dateRange={dateRange} height={200} /> },
                      { title: 'Declined Orders',    content: <DeclinedOrdersPreview orders={liveOrders} /> },
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
          ) : null}

          {screens.md !== false && view === 'events' && (
            <>
              {/* Messages: responses only, full width. The Awaiting lane was cut
                  (Rob, 2026-08-03): reminders are system-generated, so the only
                  human queue is answers waiting for review. */}
              <Row gutter={[token.marginSM, token.marginSM]} style={{ alignItems: 'stretch' }}>
                <Col xs={24} style={{ display: 'flex', flexDirection: 'column' }}>
                  {caps.intake
                    // Branch absorbed Intake (Rob 2026-08-05): their queue is
                    // the office's open questions awaiting the branch's reply.
                    ? <BranchResponseQueue />
                    : <ResponseReceivedCard events={filteredEvents} viewAllHref={buildKpiHref('/events?flag=responded', dateRange, {})} />}
                </Col>
              </Row>

              {/* Analysis: trend, breakdown donut, FQ edit quality. Branch-
                  scoped viewers lose the Events Updated card (a by-branch
                  breakdown says nothing inside one branch) and the two
                  remaining cards widen to fill the row. */}
              <Row gutter={[token.marginSM, token.marginSM]} style={{ alignItems: 'stretch' }}>
                <Col xs={24} lg={branchScoped ? 12 : 8} style={{ display: 'flex', flexDirection: 'column' }}>
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
                <Col xs={24} lg={branchScoped ? 12 : 8} style={{ display: 'flex', flexDirection: 'column' }}>
                  <EventsDonutCard events={filteredEvents} />
                </Col>
                {!branchScoped && (
                  <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column' }}>
                    <EventsUpdatedByFqCard events={filteredEvents} />
                  </Col>
                )}
              </Row>
            </>
          )}

          {screens.md !== false && view === 'orders' && (
            <>
              {/* Messages: responses only, full width — mirrors the Events view.
                  Awaiting lane cut; reminders are system-generated. */}
              <Row gutter={[token.marginSM, token.marginSM]} style={{ alignItems: 'stretch' }}>
                <Col xs={24} style={{ display: 'flex', flexDirection: 'column' }}>
                  <OrderResponseReceivedCard orders={liveOrders} viewAllHref={buildKpiHref('/orders?flag=responded', dateRange, {})} />
                </Col>
              </Row>

              {/* Analysis */}
              <Row gutter={[token.marginSM, token.marginSM]} style={{ alignItems: 'stretch' }}>
                <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column' }}>
                  <Card
                    size="small"
                    title={
                      <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
                        Decision Trend
                        <MetricInfoIcon tooltip="Orders per week by decision: Pending (blue), Approved (teal while open, solid green once fulfilled), Declined (gray). Click a segment to open those orders." />
                      </span>
                    }
                    style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                    styles={{ body: { minHeight: 300, flex: 1, display: 'flex', flexDirection: 'column' } }}
                  >
                    <DecisionTrendChart orders={liveOrders} dateRange={dateRange} fill />
                  </Card>
                </Col>
                <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column' }}>
                  <Card
                    size="small"
                    title={
                      <span style={{ fontSize: token.fontSizeSM, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
                        Declined Orders
                        <MetricInfoIcon tooltip="Declined orders with their documented reasons, newest first. Export feeds claims reporting." />
                      </span>
                    }
                    extra={<DeclinedCsvButton orders={liveOrders} />}
                    style={{ height: '100%' }}
                    styles={{ body: { minHeight: 300 } }}
                  >
                    <DeclinedOrdersPreview orders={liveOrders} />
                  </Card>
                </Col>
              </Row>
            </>
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
