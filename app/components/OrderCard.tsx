'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, Dropdown, Tag, Tooltip, theme } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { CopyableValue } from './CopyableValue';

interface OrderCardRow {
  id: string;
  jobNo: string;
  branch: string;
  lastUpdated: string;
  discrepancy: string;
  product: string;
}

const ORDER_STATUS_COLOR: Record<string, string> = {
  Open: 'blue',
  Closed: 'default',
};

interface OrderCardProps {
  row: OrderCardRow;
  status: 'Open' | 'Closed';
  menuItems: MenuProps['items'];
  onAction: (key: string) => void;
}

export function OrderCard({ row, status, menuItems, onAction }: OrderCardProps) {
  const { token } = theme.useToken();
  const router = useRouter();

  return (
    <Card
      size="small"
      hoverable
      onClick={() => router.push(`/orders/${row.id}`)}
      style={{ height: '100%', cursor: 'pointer' }}
      styles={{
        body: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 },
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <Link
          href={`/orders/${row.id}`}
          onClick={e => e.stopPropagation()}
          style={{ fontWeight: 600, fontSize: token.fontSize, textDecoration: 'none', lineHeight: 1.4 }}
        >
          {row.id}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Tag color={ORDER_STATUS_COLOR[status] ?? 'default'}>{status}</Tag>
          {menuItems && menuItems.length > 0 && (
            <Dropdown
              menu={{ items: menuItems, onClick: ({ key }) => onAction(key) }}
              trigger={['click']}
            >
              <Tooltip title="Actions">
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined />}
                  onClick={e => e.stopPropagation()}
                />
              </Tooltip>
            </Dropdown>
          )}
        </div>
      </div>

      <div onClick={e => e.stopPropagation()}>
        <CopyableValue value={row.jobNo} />
      </div>

      <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, lineHeight: 1.4, marginTop: 'auto' }}>
        {row.branch} · {row.lastUpdated}
      </div>

      <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, lineHeight: 1.4 }}>
        {row.discrepancy} · {row.product}
      </div>
    </Card>
  );
}
