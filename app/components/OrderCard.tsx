'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, Dropdown, Tag, Tooltip, theme } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { JobNoValue } from './JobNoValue';
import { OrderStageTag, ThreadStateIcons, type OrderStage } from './StatusTag';
import type { EventStatus } from '@/data/types';

interface OrderCardRow {
  id: string;
  eventId: string;
  jobNo: string;
  jobNoManualEntry?: boolean;
  branch: string;
  lastUpdated: string;
  issue: string;
  component: string;
}

interface OrderCardProps {
  row: OrderCardRow;
  stage: OrderStage;
  eventStatus: EventStatus;
  awaitingResponse?: boolean;
  responseReceived?: boolean;
  eventAwaiting?: boolean;
  eventResponded?: boolean;
  menuItems: MenuProps['items'];
  onAction: (key: string) => void;
}

export function OrderCard({ row, stage, eventStatus, awaitingResponse, responseReceived, eventAwaiting, eventResponded, menuItems, onAction }: OrderCardProps) {
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
          {row.eventId}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Pipeline-first (Rob, 2026-08-05): the order chip wears the
              stage color and carries CS-owned conversation state; the event
              chip below is neutral with FQ-owned state. */}
          <OrderStageTag stage={stage} additionalInfoRequested={awaitingResponse} responseReceived={responseReceived} />
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

      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <JobNoValue jobNo={row.jobNo} manualEntry={row.jobNoManualEntry} />
        <Tag style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {eventStatus}
          <ThreadStateIcons awaiting={eventAwaiting} responded={eventResponded} />
        </Tag>
      </div>

      <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, lineHeight: 1.4, marginTop: 'auto' }}>
        {row.branch} · {row.lastUpdated}
      </div>

      <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, lineHeight: 1.4 }}>
        {row.issue} · {row.component}
      </div>
    </Card>
  );
}
