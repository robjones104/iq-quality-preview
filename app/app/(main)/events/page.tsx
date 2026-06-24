'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import { Table, Button, Select, Space, Tag, Typography, Tooltip, notification, theme, Grid, Pagination } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MoreOutlined, CloseOutlined, SearchOutlined, ArrowLeftOutlined, ExportOutlined } from '@ant-design/icons';
import { CopyableValue } from '@/components/CopyableValue';
import Link from 'next/link';
import { events } from '@/data/events';
import { orders } from '@/data/orders';
import { DEFAULT_TAGS, ESCALATION_TYPE_OPTIONS } from '@/data/manageLists';
import { CreateEscalationModal } from '@/components/CreateEscalationModal';
import { StatusTag } from '@/components/StatusTag';
import { EventCard } from '@/components/EventCard';

const eventOrderIds = new Set(orders.map(o => o.eventId));

const EVENTS_SMART_SEARCH_OPTIONS = EVENT_FILTER_CATEGORIES.map(cat => ({
  label: cat.label,
  options: cat.options.map(opt => ({ value: `${cat.key}::${opt}`, label: opt })),
}));
import { FilterPanel } from '@/components/FilterPanel';
import { PageHeader } from '@/components/PageHeader';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { EVENT_FILTER_CATEGORIES } from '@/data/filterOptions';
import { useFilterStore } from '@/store/filterStore';
import type { DateRange } from '@/components/DateRangeFilter';
import type { QualityEvent, EventStatus } from '@/data/types';
const { Text } = Typography;

function EventsPageContent() {
  const searchParams = useSearchParams();
  const flagParam        = searchParams.get('flag');
  const statusParam      = searchParams.get('status');
  const branchParam      = searchParams.get('branch');
  const discrepancyParam = searchParams.get('discrepancy');
  const productParam     = searchParams.get('product');
  const fromParam        = searchParams.get('from');
  const toParam          = searchParams.get('to');
  const backToParam      = searchParams.get('backTo');

  const { eventsDateRange, setEventsDateRange, eventsFilters, setEventsFilters } = useFilterStore();

  // Initialize from URL params (matrix nav) or persisted Zustand value
  const [dateRange, setDateRangeLocal] = useState<DateRange | null>(() => {
    if (fromParam && toParam) return [dayjs(fromParam), dayjs(toParam)] as DateRange;
    return eventsDateRange;
  });
  const [appliedFiltersLocal, setAppliedFiltersLocal] = useState<Record<string, string[]>>(() => {
    const fromUrl: Record<string, string[]> = {};
    if (statusParam)      fromUrl.status      = statusParam.split(',');
    if (branchParam)      fromUrl.branch      = branchParam.split(',');
    if (discrepancyParam) fromUrl.discrepancy = discrepancyParam.split(',');
    if (productParam)     fromUrl.product     = productParam.split(',');
    return Object.keys(fromUrl).length ? fromUrl : eventsFilters;
  });

  // Sync URL-param initializations to Zustand so they survive event-detail navigation
  useEffect(() => {
    if (fromParam && toParam) setEventsDateRange([dayjs(fromParam), dayjs(toParam)] as DateRange);
    const fromUrl: Record<string, string[]> = {};
    if (statusParam)      fromUrl.status      = statusParam.split(',');
    if (branchParam)      fromUrl.branch      = branchParam.split(',');
    if (discrepancyParam) fromUrl.discrepancy = discrepancyParam.split(',');
    if (productParam)     fromUrl.product     = productParam.split(',');
    if (Object.keys(fromUrl).length) setEventsFilters(fromUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screens = Grid.useBreakpoint();
  const [cardPage, setCardPage] = useState(1);

  // Wrappers that keep local state and Zustand in sync
  const setDateRange = (r: DateRange | null) => { setDateRangeLocal(r); setEventsDateRange(r); setCardPage(1); };
  const setAppliedFilters = (f: Record<string, string[]>) => { setAppliedFiltersLocal(f); setEventsFilters(f); setCardPage(1); };

  const appliedFilters = appliedFiltersLocal;

  const { token } = theme.useToken();

  const [selectedEventKeys, setSelectedEventKeys] = useState<string[]>([]);
  const [batchTagId, setBatchTagId]               = useState<string | undefined>();
  const [batchEscId, setBatchEscId]               = useState<string | undefined>();
  const [createEscOpen, setCreateEscOpen]         = useState(false);
  const [notifApi, notifContextHolder]            = notification.useNotification();

  const handleExportEvents = () => {
    const selected = filtered.filter(e => selectedEventKeys.includes(e.id));
    const headers = ['Event ID', 'Job No.', 'Status', 'Discrepancy', 'Door', 'Product', 'Reported By', 'Branch', 'Plant', 'Date'];
    const rows = selected.map(e => [e.id, e.jobNo, e.status, e.discrepancy, e.door, e.product, e.reportedBy, e.branch, e.plant, e.date]);
    const lines = [headers, ...rows].map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `events-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyTag = (tagId: string) => {
    const tag = DEFAULT_TAGS.find(t => t.id === tagId);
    if (!tag) return;
    notifApi.success({ message: `"${tag.name}" applied to ${selectedEventKeys.length} event${selectedEventKeys.length > 1 ? 's' : ''}`, placement: 'bottomRight', duration: 4 });
    setBatchTagId(undefined);
    setSelectedEventKeys([]);
  };

  const handleAddToEscalation = (escType: string) => {
    if (escType === 'Custom') {
      setBatchEscId(undefined);
      setCreateEscOpen(true);
      return;
    }
    notifApi.success({ message: `${selectedEventKeys.length} event${selectedEventKeys.length > 1 ? 's' : ''} added to ${escType}`, placement: 'bottomRight', duration: 4 });
    setBatchEscId(undefined);
    setSelectedEventKeys([]);
  };

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

  const filtered = events.filter((e) => {
    if (dateRange) {
      const d = dayjs(e.date);
      if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
    }
    if (flagParam === 'additionalInfo' && !e.additionalInfoRequested) return false;
    const matchStatus      = !appliedFilters.status?.length      || appliedFilters.status.includes(e.status);
    const matchDiscrepancy = !appliedFilters.discrepancy?.length || appliedFilters.discrepancy.includes(e.discrepancy);
    const matchDoor        = !appliedFilters.door?.length        || appliedFilters.door.includes(e.door);
    const matchProduct     = !appliedFilters.product?.length     || appliedFilters.product.includes(e.product);
    const matchRootCause   = !appliedFilters.rootCause?.length   || (e.rootCause !== null && appliedFilters.rootCause.includes(e.rootCause));
    const matchBranch      = !appliedFilters.branch?.length      || appliedFilters.branch.includes(e.branch);
    const matchPlant       = !appliedFilters.plant?.length       || appliedFilters.plant.includes(e.plant);
    const matchReportedBy  = !appliedFilters.reportedBy?.length  || appliedFilters.reportedBy.includes(e.reportedBy);
    return matchStatus && matchDiscrepancy && matchDoor && matchProduct && matchRootCause && matchBranch && matchPlant && matchReportedBy;
  });

  const colFilters = (key: string) =>
    (EVENT_FILTER_CATEGORIES.find(c => c.key === key)?.options ?? []).map(o => ({ text: o, value: o }));

  const columns: ColumnsType<QualityEvent> = [
    {
      title: 'Event ID',
      dataIndex: 'id',
      key: 'id',
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (id: string) => <Link href={`/events/${id}`}>{id}</Link>,
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
      title: 'Discrepancy',
      dataIndex: 'discrepancy',
      key: 'discrepancy',
      sorter: (a, b) => a.discrepancy.localeCompare(b.discrepancy),
      filters: colFilters('discrepancy'),
      filteredValue: appliedFilters.discrepancy ?? null,
      width: 192,
      render: (discrepancy: string, record) => (
        <div style={{ overflow: 'hidden' }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {discrepancy}
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
              {record.rootCause}
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
      title: 'Product',
      dataIndex: 'product',
      key: 'product',
      sorter: (a, b) => a.product.localeCompare(b.product),
      filters: colFilters('product'),
      filteredValue: appliedFilters.product ?? null,
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      filters: colFilters('status'),
      filteredValue: appliedFilters.status ?? null,
      width: 160,
      render: (_: EventStatus, record) => (
        <StatusTag
          status={record.status}
          hasOrder={eventOrderIds.has(record.id)}
          additionalInfoRequested={record.additionalInfoRequested}
        />
      ),
    },
    {
      title: '',
      key: 'options',
      width: 52,
      render: () => (
        <Tooltip title="Options">
          <Button type="text" size="small" icon={<MoreOutlined />} />
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      {notifContextHolder}

      <CreateEscalationModal
        open={createEscOpen}
        onCancel={() => setCreateEscOpen(false)}
        onSuccess={() => { setCreateEscOpen(false); setSelectedEventKeys([]); }}
        eventIds={selectedEventKeys}
      />

      <PageHeader
        left={
          backToParam ? (
            <Link href={`/events/${backToParam}`} style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: token.fontSize }}>
              <ArrowLeftOutlined style={{ fontSize: token.fontSizeSM }} />
              Back to {backToParam}
            </Link>
          ) : (
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          )
        }
        center={
          !backToParam && (
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="Search branch, product, status..."
              options={EVENTS_SMART_SEARCH_OPTIONS}
              value={selectValue}
              onChange={handleSmartSearch}
              maxTagCount="responsive"
              style={{ width: '100%' }}
              suffixIcon={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
              allowClear
            />
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

        {screens.lg === false ? (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: screens.md ? '1fr 1fr' : '1fr',
              gap: 12,
              marginBottom: 16,
            }}>
              {filtered.slice((cardPage - 1) * 12, cardPage * 12).map(event => (
                <EventCard key={event.id} event={event} hasOrder={eventOrderIds.has(event.id)} />
              ))}
            </div>
            {filtered.length > 12 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Pagination
                  current={cardPage}
                  pageSize={12}
                  total={filtered.length}
                  onChange={setCardPage}
                  showSizeChanger={false}
                  showTotal={(total, range) => `${range[0]}-${range[1]} of ${total}`}
                  size="small"
                />
              </div>
            )}
          </>
        ) : (
          <>
            {selectedEventKeys.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '6px 10px', background: token.colorFillSecondary, borderRadius: token.borderRadius, border: `1px solid ${token.colorBorderSecondary}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>{selectedEventKeys.length} selected</Text>
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setSelectedEventKeys([])}>Clear</Button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Select
                    showSearch
                    size="small"
                    placeholder="Apply tag..."
                    value={batchTagId}
                    onChange={handleApplyTag}
                    filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                    options={DEFAULT_TAGS.map(t => ({ value: t.id, label: t.name }))}
                    style={{ width: 160 }}
                  />
                  <Select
                    showSearch
                    size="small"
                    placeholder="Add to escalation..."
                    value={batchEscId}
                    onChange={handleAddToEscalation}
                    filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                    options={ESCALATION_TYPE_OPTIONS}
                    style={{ width: 260 }}
                  />
                  <Button size="small" icon={<ExportOutlined />} onClick={handleExportEvents}>
                    Export
                  </Button>
                </div>
              </div>
            )}

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
