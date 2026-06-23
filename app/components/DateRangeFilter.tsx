'use client';

import { useState } from 'react';
import { DatePicker, Select, Modal, Grid } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

export type DateRange = [Dayjs, Dayjs];

type Preset = { label: string; value: DateRange };

function buildPresets(): Preset[] {
  const now = dayjs();
  return [
    {
      label: 'Today',
      value: [now.startOf('day'), now.endOf('day')],
    },
    {
      label: 'Yesterday',
      value: [now.subtract(1, 'day').startOf('day'), now.subtract(1, 'day').endOf('day')],
    },
    {
      label: 'Last 7 Days',
      value: [now.subtract(6, 'day').startOf('day'), now.endOf('day')],
    },
    {
      label: 'Last Week',
      value: [
        now.subtract(1, 'week').startOf('week'),
        now.subtract(1, 'week').endOf('week'),
      ],
    },
    {
      label: 'This Month',
      value: [now.startOf('month'), now.endOf('month')],
    },
    {
      label: 'Last Month',
      value: [
        now.subtract(1, 'month').startOf('month'),
        now.subtract(1, 'month').endOf('month'),
      ],
    },
    {
      label: 'Last 30 Days',
      value: [now.subtract(29, 'day').startOf('day'), now.endOf('day')],
    },
    {
      label: 'Last 60 Days',
      value: [now.subtract(59, 'day').startOf('day'), now.endOf('day')],
    },
    {
      label: 'Last 90 Days',
      value: [now.subtract(89, 'day').startOf('day'), now.endOf('day')],
    },
    {
      label: 'Last Year',
      value: [
        now.subtract(1, 'year').startOf('year'),
        now.subtract(1, 'year').endOf('year'),
      ],
    },
    {
      label: 'Year to Date',
      value: [now.startOf('year'), now.endOf('day')],
    },
    {
      label: 'Last 5 Years',
      value: [now.subtract(5, 'year').startOf('year'), now.endOf('day')],
    },
  ];
}

const MOBILE_SELECT_OPTIONS = [
  {
    label: 'Recent',
    options: [
      { value: 'Today', label: 'Today' },
      { value: 'Yesterday', label: 'Yesterday' },
    ],
  },
  {
    label: 'Weeks',
    options: [
      { value: 'Last 7 Days', label: 'Last 7 Days' },
      { value: 'Last Week', label: 'Last Week' },
    ],
  },
  {
    label: 'Months',
    options: [
      { value: 'This Month', label: 'This Month' },
      { value: 'Last Month', label: 'Last Month' },
      { value: 'Last 30 Days', label: 'Last 30 Days' },
      { value: 'Last 60 Days', label: 'Last 60 Days' },
      { value: 'Last 90 Days', label: 'Last 90 Days' },
    ],
  },
  {
    label: 'Years',
    options: [
      { value: 'Last Year', label: 'Last Year' },
      { value: 'Year to Date', label: 'Year to Date' },
      { value: 'Last 5 Years', label: 'Last 5 Years' },
    ],
  },
  {
    label: 'Custom',
    options: [{ value: '__custom__', label: 'Custom range...' }],
  },
];

type Props = {
  value?: DateRange | null;
  onChange?: (range: DateRange | null) => void;
};

export function DateRangeFilter({ value, onChange }: Props) {
  const screens = useBreakpoint();
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | null>(null);

  const presets = buildPresets();

  const activePresetLabel = (): string | undefined => {
    if (!value) return undefined;
    const match = presets.find(
      (p) => p.value[0].isSame(value[0], 'day') && p.value[1].isSame(value[1], 'day')
    );
    return match ? match.label : '__custom__';
  };

  const handleMobileChange = (val: string) => {
    if (val === '__custom__') {
      setPendingRange(value ?? null);
      setModalOpen(true);
      return;
    }
    const preset = presets.find((p) => p.label === val);
    if (preset) onChange?.(preset.value);
  };

  const handleModalOk = () => {
    if (pendingRange) onChange?.(pendingRange);
    setModalOpen(false);
  };

  // screens.md is undefined before hydration — treat undefined as desktop to avoid flash
  const isMobile = screens.md === false;

  if (!isMobile) {
    return (
      <RangePicker
        value={value ?? undefined}
        presets={presets}
        onChange={(dates) => onChange?.(dates ? (dates as DateRange) : null)}
        style={{ width: 300 }}
        placeholder={['Start date', 'End date']}
      />
    );
  }

  return (
    <>
      <Select
        value={activePresetLabel()}
        placeholder="Date range"
        style={{ width: 160 }}
        options={MOBILE_SELECT_OPTIONS}
        onChange={handleMobileChange}
        popupMatchSelectWidth={false}
      />
      <Modal
        title="Custom date range"
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        okText="Apply"
        width={340}
      >
        <div style={{ padding: '16px 0' }}>
          <RangePicker
            size="small"
            value={pendingRange ?? undefined}
            onChange={(dates) => setPendingRange(dates ? (dates as DateRange) : null)}
            style={{ width: '100%' }}
          />
        </div>
      </Modal>
    </>
  );
}
