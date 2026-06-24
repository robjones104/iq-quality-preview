'use client';

import { useState } from 'react';
import { Button, Calendar, DatePicker, Drawer, Grid, Input, Segmented, Select, theme } from 'antd';
import { CalendarOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

export type DateRange = [Dayjs, Dayjs];

type Preset = { label: string; value: DateRange };

function buildPresets(): Preset[] {
  const now = dayjs();
  return [
    { label: 'Today',        value: [now.startOf('day'), now.endOf('day')] },
    { label: 'Yesterday',    value: [now.subtract(1, 'day').startOf('day'), now.subtract(1, 'day').endOf('day')] },
    { label: 'Last 7 Days',  value: [now.subtract(6, 'day').startOf('day'), now.endOf('day')] },
    { label: 'Last Week',    value: [now.subtract(1, 'week').startOf('week'), now.subtract(1, 'week').endOf('week')] },
    { label: 'This Month',   value: [now.startOf('month'), now.endOf('month')] },
    { label: 'Last Month',   value: [now.subtract(1, 'month').startOf('month'), now.subtract(1, 'month').endOf('month')] },
    { label: 'Last 30 Days', value: [now.subtract(29, 'day').startOf('day'), now.endOf('day')] },
    { label: 'Last 60 Days', value: [now.subtract(59, 'day').startOf('day'), now.endOf('day')] },
    { label: 'Last 90 Days', value: [now.subtract(89, 'day').startOf('day'), now.endOf('day')] },
    { label: 'Last Year',    value: [now.subtract(1, 'year').startOf('year'), now.subtract(1, 'year').endOf('year')] },
    { label: 'Year to Date', value: [now.startOf('year'), now.endOf('day')] },
    { label: 'Last 5 Years', value: [now.subtract(5, 'year').startOf('year'), now.endOf('day')] },
  ];
}

const MONTH_OPTIONS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
].map((label, value) => ({ value, label }));

const NOW_YEAR = dayjs().year();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => ({
  value: NOW_YEAR - 8 + i,
  label: String(NOW_YEAR - 8 + i),
}));

type Props = {
  value?: DateRange | null;
  onChange?: (range: DateRange | null) => void;
};

export function DateRangeFilter({ value, onChange }: Props) {
  const screens = useBreakpoint();
  const { token } = theme.useToken();
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [tab, setTab]                     = useState<'Presets' | 'Custom'>('Presets');
  const [calDisplayDate, setCalDisplayDate] = useState(() => dayjs());
  const [rangeStart, setRangeStart]       = useState<Dayjs | null>(null);
  const [rangeEnd, setRangeEnd]           = useState<Dayjs | null>(null);

  const presets   = buildPresets();
  const presetMap = new Map(presets.map(p => [p.label, p]));

  const activePresetLabel = (): string | null => {
    if (!value) return null;
    return presets.find(p =>
      p.value[0].isSame(value[0], 'day') && p.value[1].isSame(value[1], 'day')
    )?.label ?? null;
  };

  const inputLabel = (): string => {
    if (!value) return '';
    const preset = activePresetLabel();
    if (preset) return preset;
    return `${value[0].format('M/D/YY')} – ${value[1].format('M/D/YY')}`;
  };

  const handleOpen = () => {
    const isCustom = value && !activePresetLabel();
    if (isCustom) {
      setTab('Custom');
      setCalDisplayDate(value[0]);
      setRangeStart(value[0]);
      setRangeEnd(value[1]);
    } else {
      setTab('Presets');
      setCalDisplayDate(dayjs());
      setRangeStart(null);
      setRangeEnd(null);
    }
    setDrawerOpen(true);
  };

  const handlePresetSelect = (label: string) => {
    const preset = presetMap.get(label);
    if (preset) { onChange?.(preset.value); setDrawerOpen(false); }
  };

  const handleDayTap = (day: Dayjs) => {
    setCalDisplayDate(day);
    if (!rangeStart || rangeEnd) {
      setRangeStart(day);
      setRangeEnd(null);
    } else if (day.isBefore(rangeStart, 'day') || day.isSame(rangeStart, 'day')) {
      setRangeStart(day);
      setRangeEnd(null);
    } else {
      setRangeEnd(day);
    }
  };

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

  const currentPreset = activePresetLabel();

  return (
    <>
      <Input
        readOnly
        prefix={<CalendarOutlined style={{ color: token.colorTextTertiary }} />}
        value={inputLabel()}
        placeholder="Date range"
        onClick={handleOpen}
        style={{
          cursor: 'pointer',
          width: Math.max(128, (inputLabel() || 'Date range').length * 7.8 + 52),
        }}
      />

      <Drawer
        title="Date Range"
        placement="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        height="auto"
        styles={{ body: { padding: '12px 16px 16px' } }}
        extra={
          value ? (
            <Button type="link" size="small" onClick={() => { onChange?.(null); setDrawerOpen(false); }}>
              Clear
            </Button>
          ) : null
        }
        footer={
          tab === 'Custom' ? (
            <Button
              type="primary"
              block
              disabled={!rangeStart || !rangeEnd}
              onClick={() => { if (rangeStart && rangeEnd) { onChange?.([rangeStart, rangeEnd]); setDrawerOpen(false); } }}
            >
              Apply
            </Button>
          ) : undefined
        }
      >
        <Segmented
          options={['Presets', 'Custom']}
          value={tab}
          onChange={(v) => setTab(v as 'Presets' | 'Custom')}
          block
          style={{ marginBottom: 16 }}
        />

        {tab === 'Presets' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {presets.map(p => (
              <Button
                key={p.label}
                type={currentPreset === p.label ? 'primary' : 'default'}
                onClick={() => handlePresetSelect(p.label)}
                block
              >
                {p.label}
              </Button>
            ))}
          </div>
        ) : (
          <div>
            <Calendar
              fullscreen={false}
              value={calDisplayDate}
              onSelect={(date) => handleDayTap(date)}
              headerRender={({ value: hVal, onChange: hOnChange }) => (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 10,
                }}>
                  <Button
                    type="text"
                    size="small"
                    icon={<LeftOutlined />}
                    onClick={() => {
                      const prev = hVal.subtract(1, 'month');
                      hOnChange(prev);
                      setCalDisplayDate(prev);
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Select
                      size="small"
                      value={hVal.month()}
                      onChange={m => {
                        const next = hVal.month(m);
                        hOnChange(next);
                        setCalDisplayDate(next);
                      }}
                      options={MONTH_OPTIONS}
                      style={{ width: 114 }}
                    />
                    <Select
                      size="small"
                      value={hVal.year()}
                      onChange={y => {
                        const next = hVal.year(y);
                        hOnChange(next);
                        setCalDisplayDate(next);
                      }}
                      options={YEAR_OPTIONS}
                      style={{ width: 78 }}
                    />
                  </div>
                  <Button
                    type="text"
                    size="small"
                    icon={<RightOutlined />}
                    onClick={() => {
                      const next = hVal.add(1, 'month');
                      hOnChange(next);
                      setCalDisplayDate(next);
                    }}
                  />
                </div>
              )}
              dateFullCellRender={(date) => {
                const inMonth = date.month() === calDisplayDate.month();
                const isStart = !!rangeStart && date.isSame(rangeStart, 'day');
                const isEnd   = !!rangeEnd   && date.isSame(rangeEnd,   'day');
                const inRange = !!rangeStart && !!rangeEnd
                  && date.isAfter(rangeStart, 'day') && date.isBefore(rangeEnd, 'day');
                const isToday   = date.isSame(dayjs(), 'day');
                const selected  = isStart || isEnd;

                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    margin: '1px',
                    borderRadius: token.borderRadiusSM,
                    background: selected ? token.colorPrimary : inRange ? token.colorPrimaryBg : 'transparent',
                    color: selected
                      ? '#fff'
                      : !inMonth
                      ? token.colorTextDisabled
                      : isToday
                      ? token.colorPrimary
                      : token.colorText,
                    fontWeight: isToday && !selected ? 600 : 400,
                    fontSize: token.fontSize,
                  }}>
                    {date.date()}
                  </div>
                );
              }}
            />

            {/* Range summary */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
              fontSize: token.fontSizeSM,
              minHeight: 22,
            }}>
              {rangeStart ? (
                <>
                  <span style={{ color: token.colorText, fontWeight: 500 }}>{rangeStart.format('MMM D, YYYY')}</span>
                  <span style={{ color: token.colorTextTertiary }}>→</span>
                  <span style={{ color: rangeEnd ? token.colorText : token.colorTextTertiary, fontWeight: rangeEnd ? 500 : 400 }}>
                    {rangeEnd ? rangeEnd.format('MMM D, YYYY') : 'select end date'}
                  </span>
                </>
              ) : (
                <span style={{ color: token.colorTextTertiary }}>Tap a day to start</span>
              )}
            </div>

          </div>
        )}
      </Drawer>
    </>
  );
}
