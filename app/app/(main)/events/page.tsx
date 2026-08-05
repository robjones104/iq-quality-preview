'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { AutoComplete, Input, Pagination, Table, Button, Tag, Typography, theme, Grid } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CloseOutlined, SearchOutlined, ArrowLeftOutlined, ExportOutlined } from '@ant-design/icons';
import { CopyableValue } from '@/components/CopyableValue';
import Link from 'next/link';
import { useEffectiveEvents } from '@/lib/effectiveEvents';
import { useScopedEvents } from '@/lib/useScopedData';
import { capabilitiesFor } from '@/lib/roles';
import { orders } from '@/data/orders';
import { awaitingFqResponse, respondedNeedsReview } from '@/components/EventMessages';
import { partyAwaiting, partyResponded } from '@/components/TechReplyWarning';
import { StatusTag } from '@/components/StatusTag';
import { EventCard } from '@/components/EventCard';

const eventOrderIds = new Set(orders.map(o => o.eventId));

import { FilterPanel } from '@/components/FilterPanel';
import { PageHeader } from '@/components/PageHeader';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { EVENT_FILTER_CATEGORIES } from '@/data/filterOptions';
import { useFilterStore } from '@/store/filterStore';
import type { DateRange } from '@/components/DateRangeFilter';
import type { QualityEvent, EventStatus } from '@/data/types';
const { Text } = Typography;

const CARD_PAGE_SIZE = 12;

function EventsPageContent() {
  const searchParams = useSearchParams();
  const flagParam        = searchParams.get('flag');
  const statusParam      = searchParams.get('status');
  const branchParam      = searchParams.get('branch');
  const issueParam       = searchParams.get('issue');
  const componentParam   = searchParams.get('component');
  const doorParam        = searchParams.get('door');
  const rootCauseParam   = searchParams.get('rootCause');
  const plantParam       = searchParams.get('plant');
  const reportedByParam  = searchParams.get('reportedBy');
  const fromParam        = searchParams.get('from');
  const toParam          = searchParams.get('to');
  const backToParam      = searchParams.get('backTo');
  const tagParam         = searchParams.get('tag');
  const idsParam         = searchParams.get('ids');

  const { eventsDateRange, setEventsDateRange, eventsFilters, setEventsFilters } = useFilterStore();

  // Initialize from URL params (matrix nav / KPI card carry-over) or persisted Zustand value
  const [dateRange, setDateRangeLocal] = useState<DateRange | null>(() => {
    if (fromParam && toParam) return [dayjs(fromParam), dayjs(toParam)] as DateRange;
    return eventsDateRange;
  });
  const [appliedFiltersLocal, setAppliedFiltersLocal] = useState<Record<string, string[]>>(() => {
    const fromUrl: Record<string, string[]> = {};
    if (statusParam)      fromUrl.status      = statusParam.split(',');
    if (branchParam)      fromUrl.branch      = branchParam.split(',');
    if (issueParam)        fromUrl.issue      = issueParam.split(',');
    if (componentParam)    fromUrl.component  = componentParam.split(',');
    if (doorParam)        fromUrl.door        = doorParam.split(',');
    if (rootCauseParam)   fromUrl.rootCause   = rootCauseParam.split(',');
    if (plantParam)       fromUrl.plant       = plantParam.split(',');
    if (reportedByParam)  fromUrl.reportedBy  = reportedByParam.split(',');
    return Object.keys(fromUrl).length ? fromUrl : eventsFilters;
  });

  // Sync date range from URL params so it survives event-detail navigation.
  // Category filters from URL params are intentionally NOT written to Zustand —
  // they are one-time navigation context (KPI cards, chart clicks) and must not
  // contaminate the user's persistent filter state on direct navigation.
  useEffect(() => {
    if (fromParam && toParam) setEventsDateRange([dayjs(fromParam), dayjs(toParam)] as DateRange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screens = Grid.useBreakpoint();

  // Wrappers that keep local state and Zustand in sync
  const setDateRange = (r: DateRange | null) => { setDateRangeLocal(r); setEventsDateRange(r); };
  const setAppliedFilters = (f: Record<string, string[]>) => { setAppliedFiltersLocal(f); setEventsFilters(f); };

  const appliedFilters = appliedFiltersLocal;

  const { token } = theme.useToken();

  const [selectedEventKeys, setSelectedEventKeys] = useState<string[]>([]);
  const [cardPage, setCardPage] = useState(1);
  // Reset mobile card pagination when the result set changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCardPage(1); }, [appliedFiltersLocal, dateRange]);

  const handleExportEvents = () => {
    const toExport = selectedEventKeys.length > 0 ? filtered.filter(e => selectedEventKeys.includes(e.id)) : filtered;
    const headers = ['Event ID', 'Job No.', 'Status', 'Issue', 'Door', 'Component', 'Reported By', 'Branch', 'Plant', 'Date'];
    const rows = toExport.map(e => [e.id, e.jobNo, e.status, e.issue, e.door, e.component, e.reportedBy, e.branch, e.plant, e.date]);
    const lines = [headers, ...rows].map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `events-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  // Branch (View-Only) roles see only their branch's events.
  const events = useScopedEvents(useEffectiveEvents());

  const searchOptions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return [];
    const matchingEvents = events
      .filter(e => e.id.toLowerCase().includes(q) || e.jobNo.toLowerCase().includes(q))
      .slice(0, 5)
      .map(e => ({
        value: `nav::event::${e.id}`,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.id}</span>
            <span style={{ fontSize: 11, color: token.colorTextTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.jobNo} · {e.issue}</span>
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
      ...(filterOpts.length > 0 ? [{ label: 'Filter by', options: filterOpts }] : []),
    ];
  }, [searchText, events, token.colorTextTertiary]);

  const handleSearchSelect = (value: string) => {
    setSearchText('');
    if (value.startsWith('nav::event::')) {
      router.push(`/events/${value.slice('nav::event::'.length)}`);
    } else if (value.startsWith('filter::')) {
      const rest = value.slice('filter::'.length);
      const sep  = rest.indexOf('::');
      const key  = rest.slice(0, sep);
      const val  = rest.slice(sep + 2);
      setAppliedFilters({ ...appliedFilters, [key]: [...new Set([...(appliedFilters[key] ?? []), val])] });
    }
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

  const tagFilter = tagParam?.split(',').filter(Boolean) ?? [];
  const idsFilter = idsParam?.split(',').filter(Boolean) ?? [];

  const filtered = events.filter((e) => {
    if (dateRange) {
      const d = dayjs(e.date);
      if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
    }
    if (flagParam === 'additionalInfo' && !awaitingFqResponse(e)) return false;
    if (flagParam === 'responded' && !respondedNeedsReview(e)) return false;
    if (flagParam === 'edited' && !(e.editHistory && e.editHistory.length > 0)) return false;
    if (tagFilter.length && !tagFilter.some(t => e.tags?.includes(t))) return false;
    if (idsFilter.length && !idsFilter.includes(e.id)) return false;
    const matchStatus      = !appliedFilters.status?.length      || appliedFilters.status.includes(e.status);
    const matchIssue       = !appliedFilters.issue?.length       || appliedFilters.issue.includes(e.issue);
    const matchDoor        = !appliedFilters.door?.length        || appliedFilters.door.includes(e.door);
    const matchComponent   = !appliedFilters.component?.length   || appliedFilters.component.includes(e.component);
    const matchRootCause   = !appliedFilters.rootCause?.length   || (e.rootCauses ?? (e.rootCause ? [e.rootCause] : [])).some(rc => appliedFilters.rootCause.includes(rc));
    const matchBranch      = !appliedFilters.branch?.length      || appliedFilters.branch.includes(e.branch);
    const matchPlant       = !appliedFilters.plant?.length       || appliedFilters.plant.includes(e.plant);
    const matchReportedBy  = !appliedFilters.reportedBy?.length  || appliedFilters.reportedBy.includes(e.reportedBy);
    return matchStatus && matchIssue && matchDoor && matchComponent && matchRootCause && matchBranch && matchPlant && matchReportedBy;
  });

  const colFilters = (key: string) =>
    (EVENT_FILTER_CATEGORIES.find(c => c.key === key)?.options ?? []).map(o => ({ text: o, value: o }));

  const columns: ColumnsType<QualityEvent> = [
    {
      title: 'Event ID',
      dataIndex: 'id',
      key: 'id',
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (id: string) => <Link href={`/events/${id}`} style={{ fontWeight: 600 }}>{id}</Link>,
      width: 92,
    },
    {
      title: 'Job No.',
      dataIndex: 'jobNo',
      key: 'jobNo',
      sorter: (a, b) => a.jobNo.localeCompare(b.jobNo),
      width: 148,
      render: (jobNo: string) => <CopyableValue value={jobNo} />,
    },
    {
      title: 'Issue',
      dataIndex: 'issue',
      key: 'issue',
      sorter: (a, b) => a.issue.localeCompare(b.issue),
      filters: colFilters('issue'),
      filteredValue: appliedFilters.issue ?? null,
      width: 192,
      render: (issue: string, record) => (
        <div style={{ overflow: 'hidden' }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {issue}
          </div>
          {record.rootCause && (
            <div style={{
              fontSize: token.fontSizeSM,
              color: token.colorTextTertiary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}>
              {(record.rootCauses?.length ? record.rootCauses.join(', ') : record.rootCause)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Door',
      dataIndex: 'door',
      key: 'door',
      sorter: (a, b) => a.door.localeCompare(b.door),
      filters: colFilters('door'),
      filteredValue: appliedFilters.door ?? null,
      filterSearch: true,
      ellipsis: { showTitle: true },
      width: 148,
    },
    {
      title: 'Component',
      dataIndex: 'component',
      key: 'component',
      sorter: (a, b) => a.component.localeCompare(b.component),
      filters: colFilters('component'),
      filteredValue: appliedFilters.component ?? null,
      ellipsis: { showTitle: true },
      width: 148,
    },
    {
      title: 'Reported By',
      dataIndex: 'reportedBy',
      key: 'reportedBy',
      sorter: (a, b) => a.reportedBy.localeCompare(b.reportedBy),
      filters: colFilters('reportedBy'),
      filteredValue: appliedFilters.reportedBy ?? null,
      filterSearch: true,
      ellipsis: { showTitle: true },
      width: 182,
    },
    {
      title: 'Branch',
      dataIndex: 'branch',
      key: 'branch',
      sorter: (a, b) => a.branch.localeCompare(b.branch),
      filters: colFilters('branch'),
      filteredValue: appliedFilters.branch ?? null,
      filterSearch: true,
      ellipsis: { showTitle: true },
      width: 138,
    },
    {
      title: 'Plant',
      dataIndex: 'plant',
      key: 'plant',
      sorter: (a, b) => a.plant.localeCompare(b.plant),
      render: (plant: string) => plant.split(' ')[0],
      width: 64,
    },
    {
      title: 'Event Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      filters: colFilters('status'),
      filteredValue: appliedFilters.status ?? null,
      width: 160,
      render: (_: EventStatus, record) => {
        // Ownership split (Rob, 2026-08-04): the event badge carries FQ-owned
        // conversation state only; CS-owned state lives on the order chip on
        // the Orders surfaces. Terminal statuses stay quiet.
        const active = record.status === 'Reported' || record.status === 'Under Investigation';
        const fq = capabilitiesFor('Field Quality').displayName;
        return (
          <StatusTag
            status={record.status}
            hasOrder={eventOrderIds.has(record.id)}
            additionalInfoRequested={active && partyAwaiting(record.additionalInfoRequests, 'Field Quality')}
            responseReceived={active && partyResponded(record.additionalInfoRequests, 'Field Quality')}
            awaitingTooltip={`${fq} asked. Response pending.`}
            respondedTooltip={`${record.reportedBy} replied. Review the answer.`}
          />
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        left={
          backToParam ? (
            <Link href={`/events/${backToParam}`} style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: token.fontSize, color: token.colorLink }}>
              <ArrowLeftOutlined style={{ fontSize: token.fontSizeSM }} />
              Back to {backToParam}
            </Link>
          ) : (
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          )
        }
        center={
          !backToParam && (
            <AutoComplete
              value={searchText}
              onChange={setSearchText}
              onSelect={handleSearchSelect}
              options={searchOptions}
              placeholder="Search event ID, job no., branch, status..."
              style={{ width: '100%' }}
              allowClear
            >
              <Input aria-label="Search events" suffix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />} />
            </AutoComplete>
          )
        }
        right={
          <FilterPanel
            categories={EVENT_FILTER_CATEGORIES}
            applied={appliedFilters}
            onApply={setAppliedFilters}
          />
        }
      />

      <div style={{ padding: `${token.padding}px ${token.paddingMD}px` }}>
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
            <Button type="link" size="small" onClick={() => setAppliedFilters({})} style={{ padding: '0 4px' }}>
              Clear all
            </Button>
          </div>
        )}

        {screens.xl === false ? (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: screens.md !== false ? 'repeat(2, 1fr)' : '1fr',
              gap: 12,
            }}>
              {filtered.slice((cardPage - 1) * CARD_PAGE_SIZE, cardPage * CARD_PAGE_SIZE).map(event => (
                <EventCard key={event.id} event={event} hasOrder={eventOrderIds.has(event.id)} />
              ))}
            </div>
            {filtered.length > CARD_PAGE_SIZE && (
              <Pagination
                current={cardPage}
                pageSize={CARD_PAGE_SIZE}
                total={filtered.length}
                onChange={setCardPage}
                size="small"
                hideOnSinglePage
                showTotal={(total, range) => `${range[0]}-${range[1]} of ${total}`}
                style={{ textAlign: 'right', marginTop: 12 }}
              />
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '6px 10px', background: token.colorFillSecondary, borderRadius: token.borderRadius, border: `1px solid ${token.colorBorderSecondary}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedEventKeys.length > 0 ? (
                  <>
                    <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>{selectedEventKeys.length} selected</Text>
                    <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setSelectedEventKeys([])}>Clear</Button>
                  </>
                ) : (
                  <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
                    {filtered.length} event{filtered.length !== 1 ? 's' : ''}
                  </Text>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button size="small" icon={<ExportOutlined />} onClick={handleExportEvents}>
                  Export
                </Button>
              </div>
            </div>

            <Table
              dataSource={filtered}
              columns={columns}
              rowKey="id"
              size="small"
              onChange={(_p, tableFilters) => {
                const next = { ...appliedFilters };
                Object.entries(tableFilters).forEach(([k, vals]) => {
                  if (vals?.length) next[k] = vals as string[];
                  else delete next[k];
                });
                setAppliedFilters(next);
              }}
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: selectedEventKeys,
                onChange: (keys) => setSelectedEventKeys(keys as string[]),
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '25', '50', '100'],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
              }}
            />
          </>
        )}
      </div>
    </>
  );
}

export default function EventsPage() {
  return (
    <Suspense>
      <EventsPageContent />
    </Suspense>
  );
}
