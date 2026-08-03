'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Empty, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, MessageFilled, RightOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/PageHeader';
import { StatusTag } from '@/components/StatusTag';
import { JobNoValue } from '@/components/JobNoValue';
import { awaitingTechReply, awaitingParty } from '@/components/TechReplyWarning';
import { useEffectiveEvents } from '@/lib/effectiveEvents';
import { useScopedEvents } from '@/lib/useScopedData';
import { useCapabilities } from '@/store/roleStore';
import { EventSummaryDrawer } from './EventSummaryDrawer';
import type { QualityEvent } from '@/data/types';

const { Text } = Typography;

export function IntakeHomeClient() {
  const router = useRouter();
  const { token } = theme.useToken();
  const caps = useCapabilities();
  const branch = caps.assignedBranch ?? 'Atlanta';

  const events = useScopedEvents(useEffectiveEvents());
  const [drawerEvent, setDrawerEvent] = useState<QualityEvent | null>(null);

  // Newest first: portal submissions and recent field reports at the top.
  const sorted = useMemo(
    () => events.slice().sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)),
    [events]
  );

  // Open questions from the office (FQ or CS) that the reporter side has not
  // answered, on events still in play. Branch-wide on purpose: the Intake user
  // is the branch's voice and answers for its techs too.
  const needsResponse = useMemo(
    () =>
      sorted.filter(
        (e) =>
          e.status !== 'Invalidated' &&
          awaitingTechReply(e.additionalInfoRequests)
      ),
    [sorted]
  );

  // Keep the drawer's event fresh: replies mutate the thread, and the stale
  // captured object would hide them.
  const drawerCurrent = drawerEvent
    ? sorted.find((e) => e.id === drawerEvent.id) ?? drawerEvent
    : null;

  const columns: ColumnsType<QualityEvent> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: token.fontSizeSM, color: token.colorPrimary }}>{id}</Text>
      ),
    },
    {
      title: 'Reported',
      dataIndex: 'reportedAt',
      key: 'reportedAt',
      width: 110,
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{val.slice(0, 10)}</Text>
      ),
    },
    {
      title: 'Job No.',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 150,
      render: (_: string, row) => <JobNoValue jobNo={row.jobNo} manualEntry={row.jobNoManualEntry} />,
    },
    { title: 'Door', dataIndex: 'door', key: 'door', ellipsis: true },
    { title: 'Component', dataIndex: 'component', key: 'component', ellipsis: true, width: 150 },
    { title: 'Issue', dataIndex: 'issue', key: 'issue', ellipsis: true, width: 170 },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (_: string, row) => (
        <StatusTag status={row.status} additionalInfoRequested={awaitingTechReply(row.additionalInfoRequests)} />
      ),
    },
    {
      key: 'chevron',
      width: 36,
      render: () => <RightOutlined style={{ fontSize: token.fontSizeSM, color: token.colorTextQuaternary }} />,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        left={
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <Text style={{ fontSize: token.fontSizeLG, fontWeight: 600, color: token.colorText }}>
              Quality Intake
            </Text>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{branch} branch</Text>
          </div>
        }
        right={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/intake/new')}>
            Report a Quality Event
          </Button>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card
          size="small"
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageFilled style={{ color: token.colorWarning }} />
              <span>Needs Your Response</span>
              {needsResponse.length > 0 && <Tag color="gold">{needsResponse.length}</Tag>}
            </div>
          }
        >
          {needsResponse.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No open questions. You are all caught up."
              style={{ margin: '12px 0' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {needsResponse.slice(0, 6).map((e, i) => {
                const thread = e.additionalInfoRequests ?? [];
                const last = thread[thread.length - 1];
                const asking = awaitingParty(thread) ?? 'Field Quality';
                return (
                  <div
                    key={e.id}
                    onClick={() => setDrawerEvent(e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 4px',
                      cursor: 'pointer',
                      borderTop: i > 0 ? `1px solid ${token.colorBorderSecondary}` : undefined,
                    }}
                  >
                    <Text style={{ fontFamily: 'monospace', fontSize: token.fontSizeSM, color: token.colorPrimary, flexShrink: 0 }}>
                      {e.id}
                    </Text>
                    <Tag style={{ flexShrink: 0, marginInlineEnd: 0 }}>{asking}</Tag>
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, flex: 1, minWidth: 0 }} ellipsis>
                      {last?.text}
                    </Text>
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, flexShrink: 0 }}>
                      {last?.sentAt.slice(0, 10)}
                    </Text>
                    <Button size="small" onClick={(ev) => { ev.stopPropagation(); setDrawerEvent(e); }}>
                      Respond
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          size="small"
          title={`${branch} Quality Events`}
          extra={
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {sorted.length} event{sorted.length !== 1 ? 's' : ''}
            </Text>
          }
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={sorted}
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            onRow={(row) => ({ onClick: () => setDrawerEvent(row), style: { cursor: 'pointer' } })}
            scroll={{ x: 900 }}
          />
        </Card>
      </div>

      <EventSummaryDrawer
        event={drawerCurrent}
        open={!!drawerEvent}
        onClose={() => setDrawerEvent(null)}
      />
    </div>
  );
}
