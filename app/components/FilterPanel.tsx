'use client';

import { useState } from 'react';
import { Popover, Button, Input, Checkbox, Typography, Badge, Drawer, Grid, Tabs, theme } from 'antd';
import { FilterFilled, SearchOutlined } from '@ant-design/icons';
import type { FilterCategory } from '@/data/filterOptions';

const { Text } = Typography;
const { useBreakpoint } = Grid;

type Props = {
  categories: FilterCategory[];
  applied: Record<string, string[]>;
  onApply: (filters: Record<string, string[]>) => void;
};

export function FilterPanel({ categories, applied, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(categories[0]?.key ?? '');
  const [search, setSearch] = useState('');
  const [pendingFilters, setPendingFilters] = useState<Record<string, string[]>>({});
  const { token } = theme.useToken();
  const screens = useBreakpoint();

  const isMobile = screens.md === false;

  const totalApplied = Object.values(applied).reduce((sum, arr) => sum + arr.length, 0);

  const activeCategory = categories.find((c) => c.key === activeKey);
  const filteredOptions = (activeCategory?.options ?? []).filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  // Desktop: live applied state
  const appliedForActive = applied[activeKey] ?? [];
  const allChecked = filteredOptions.length > 0 && filteredOptions.every((o) => appliedForActive.includes(o));
  const someChecked = filteredOptions.some((o) => appliedForActive.includes(o));

  // Mobile: pending (staged) state
  const pendingForActive = pendingFilters[activeKey] ?? [];
  const pendingAllChecked = filteredOptions.length > 0 && filteredOptions.every((o) => pendingForActive.includes(o));
  const pendingSomeChecked = filteredOptions.some((o) => pendingForActive.includes(o));
  const totalPending = Object.values(pendingFilters).reduce((sum, arr) => sum + arr.length, 0);

  const handleOpen = () => {
    setActiveKey(categories[0]?.key ?? '');
    setSearch('');
    setPendingFilters(applied);
    setOpen(true);
  };

  const handleCategoryClick = (key: string) => {
    setActiveKey(key);
    setSearch('');
  };

  // Desktop: live apply
  const handleOptionChange = (opt: string, checked: boolean) => {
    const current = applied[activeKey] ?? [];
    onApply({
      ...applied,
      [activeKey]: checked ? [...current, opt] : current.filter((v) => v !== opt),
    });
  };

  const handleSelectAll = (checked: boolean) => {
    onApply({
      ...applied,
      [activeKey]: checked ? filteredOptions : [],
    });
  };

  // Mobile: pending only
  const handlePendingOptionChange = (opt: string, checked: boolean) => {
    const current = pendingFilters[activeKey] ?? [];
    setPendingFilters({
      ...pendingFilters,
      [activeKey]: checked ? [...current, opt] : current.filter((v) => v !== opt),
    });
  };

  const handlePendingSelectAll = (checked: boolean) => {
    setPendingFilters({
      ...pendingFilters,
      [activeKey]: checked ? filteredOptions : [],
    });
  };

  // ── Mobile: icon button + bottom drawer ──────────────────────────────────
  if (isMobile) {
    return (
      <>
        <Badge count={totalApplied} size="small" color={token.colorPrimary}>
          <Button type="primary" icon={<FilterFilled />} onClick={handleOpen} />
        </Badge>

        <Drawer
          title="Filter"
          placement="bottom"
          open={open}
          onClose={() => setOpen(false)}
          height="80%"
          extra={
            totalPending > 0 ? (
              <Button type="link" size="small" onClick={() => setPendingFilters({})}>
                Clear all
              </Button>
            ) : null
          }
          footer={
            <Button
              type="primary"
              block
              onClick={() => { onApply(pendingFilters); setOpen(false); }}
            >
              Apply{totalPending > 0 ? ` (${totalPending})` : ''}
            </Button>
          }
        >
          <Tabs
            size="small"
            activeKey={activeKey}
            onChange={handleCategoryClick}
            tabBarStyle={{ marginBottom: 12 }}
            items={categories.map(cat => {
              const count = pendingFilters[cat.key]?.length ?? 0;
              return {
                key: cat.key,
                label: count > 0 ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {cat.label}
                    <Badge count={count} size="small" color={token.colorPrimary} />
                  </span>
                ) : cat.label,
              };
            })}
          />

          <Input
            prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
            placeholder={`Search ${activeCategory?.label.toLowerCase() ?? ''}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ marginBottom: 10 }}
          />

          <div style={{
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}>
            <Checkbox
              indeterminate={pendingSomeChecked && !pendingAllChecked}
              checked={pendingAllChecked}
              onChange={(e) => handlePendingSelectAll(e.target.checked)}
            >
              <Text style={{ fontSize: token.fontSizeSM }} type="secondary">Select all</Text>
            </Checkbox>
          </div>

          {filteredOptions.length === 0 ? (
            <Text type="secondary" style={{ fontSize: token.fontSize }}>No results</Text>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px', alignItems: 'center' }}>
              {filteredOptions.map((opt) => (
                <Checkbox
                  key={opt}
                  checked={pendingForActive.includes(opt)}
                  onChange={(e) => handlePendingOptionChange(opt, e.target.checked)}
                  style={{ marginInlineStart: 0 }}
                >
                  <Text style={{ fontSize: token.fontSize }}>{opt}</Text>
                </Checkbox>
              ))}
            </div>
          )}
        </Drawer>
      </>
    );
  }

  // ── Desktop: Popover ──────────────────────────────────────────────────────
  const panelContent = (
    <div style={{ display: 'flex', width: 520, height: 300, overflow: 'hidden', borderRadius: token.borderRadiusLG }}>
      {/* Left: category list */}
      <div
        style={{
          width: 148,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
          overflowY: 'auto',
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        {categories.map((cat) => {
          const count = applied[cat.key]?.length ?? 0;
          const isActive = cat.key === activeKey;
          return (
            <div
              key={cat.key}
              onClick={() => handleCategoryClick(cat.key)}
              style={{
                padding: '9px 16px',
                cursor: 'pointer',
                background: isActive ? token.colorFillSecondary : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: token.fontSize,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? token.colorText : token.colorTextSecondary,
                borderLeft: isActive ? `2px solid ${token.colorPrimary}` : '2px solid transparent',
                transition: 'background 0.1s',
              }}
            >
              <span>{cat.label}</span>
              {count > 0 && <Badge count={count} size="small" color={token.colorPrimary} />}
            </div>
          );
        })}
      </div>

      {/* Right: search + options */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${token.colorBorderSecondary}`, flexShrink: 0 }}>
          <Input
            prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
            placeholder={`Search ${activeCategory?.label.toLowerCase() ?? ''}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            size="small"
          />
        </div>

        <div
          style={{
            padding: '8px 14px 6px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            flexShrink: 0,
          }}
        >
          <Checkbox
            indeterminate={someChecked && !allChecked}
            checked={allChecked}
            onChange={(e) => handleSelectAll(e.target.checked)}
          >
            <Text style={{ fontSize: token.fontSizeSM }} type="secondary">Select all</Text>
          </Checkbox>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
          {filteredOptions.length === 0 ? (
            <Text type="secondary" style={{ fontSize: token.fontSize }}>No results</Text>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px', alignItems: 'center' }}>
              {filteredOptions.map((opt) => (
                <Checkbox
                  key={opt}
                  checked={appliedForActive.includes(opt)}
                  onChange={(e) => handleOptionChange(opt, e.target.checked)}
                  style={{ marginInlineStart: 0 }}
                >
                  <Text style={{ fontSize: token.fontSize }}>{opt}</Text>
                </Checkbox>
              ))}
            </div>
          )}
        </div>

        {totalApplied > 0 && (
          <div
            style={{
              padding: '8px 14px',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              flexShrink: 0,
            }}
          >
            <Button type="link" size="small" onClick={() => onApply({})} style={{ padding: 0 }}>
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={panelContent}
      trigger="click"
      open={open}
      onOpenChange={(v) => { if (!v) setOpen(false); }}
      placement="bottomRight"
      arrow={false}
      styles={{ body: { padding: 0 } }}
    >
      <Button
        type="primary"
        icon={<FilterFilled />}
        onClick={handleOpen}
      >
        Filter {totalApplied > 0 ? `(${totalApplied})` : ''}
      </Button>
    </Popover>
  );
}
