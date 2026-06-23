'use client';

import { useState, useMemo } from 'react';
import { Drawer, Collapse, Input, Checkbox, Button, Space, Typography, Badge, theme } from 'antd';

const { Text } = Typography;

export type FilterCategory = {
  key: string;
  label: string;
  options: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  categories: FilterCategory[];
  selected: Record<string, string[]>;
  onChange: (key: string, values: string[]) => void;
  onClear: () => void;
  onApply: () => void;
};

export function FilterDrawer({ open, onClose, categories, selected, onChange, onClear, onApply }: Props) {
  const [search, setSearch] = useState('');
  const [openKeys, setOpenKeys] = useState<string[]>(categories.map((c) => c.key));
  const { token } = theme.useToken();

  const totalSelected = Object.values(selected).reduce((sum, arr) => sum + arr.length, 0);

  const visibleCategories = useMemo(() => {
    if (!search.trim()) return categories.map((cat) => ({ ...cat, filteredOptions: cat.options }));
    const q = search.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        filteredOptions: cat.options.filter((o) => o.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.filteredOptions.length > 0);
  }, [categories, search]);

  // During search: force all matching panels open so results are immediately visible.
  // When search is cleared: restore user-controlled open state.
  const activeKeys = search.trim()
    ? visibleCategories.map((c) => c.key)
    : openKeys;

  const collapseItems = visibleCategories.map((cat) => {
    const selCount = selected[cat.key]?.length ?? 0;
    const allSelected = cat.filteredOptions.every((o) => selected[cat.key]?.includes(o));
    const noneSelected = selCount === 0;

    return {
      key: cat.key,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
          <Space size={8}>
            <Text strong style={{ fontSize: token.fontSize }}>{cat.label}</Text>
            {selCount > 0 && (
              <Badge count={selCount} size="small" color={token.colorPrimary} />
            )}
          </Space>
          <Text
            type="secondary"
            style={{ fontSize: token.fontSizeSM, cursor: 'pointer', flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              if (allSelected) {
                onChange(cat.key, []);
              } else {
                onChange(cat.key, cat.filteredOptions);
              }
            }}
          >
            {allSelected && !noneSelected ? 'Deselect all' : 'Select all'}
          </Text>
        </div>
      ),
      children: (
        <div style={{ padding: '0 16px 16px' }}>
          <Checkbox.Group
            value={selected[cat.key] ?? []}
            onChange={(vals) => onChange(cat.key, vals as string[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {cat.filteredOptions.map((opt) => (
              <Checkbox key={opt} value={opt}>
                {opt}
              </Checkbox>
            ))}
          </Checkbox.Group>
        </div>
      ),
    };
  });

  return (
    <Drawer
      title="Filter"
      open={open}
      onClose={onClose}
      width={420}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onClear} disabled={totalSelected === 0}>
            Clear all {totalSelected > 0 ? `(${totalSelected})` : ''}
          </Button>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              onClick={() => { onApply(); onClose(); }}
            >
              Apply
            </Button>
          </Space>
        </div>
      }
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
    >
      {/* Global search */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}`, flexShrink: 0 }}>
        <Input.Search
          placeholder="Search filters..."
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Accordion */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {visibleCategories.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <Text type="secondary">No matching filters</Text>
          </div>
        ) : (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => {
              if (!search.trim()) setOpenKeys(keys as string[]);
            }}
            items={collapseItems}
            bordered={false}
            style={{ borderRadius: 0 }}
            expandIconPosition="end"
          />
        )}
      </div>
    </Drawer>
  );
}
