'use client';

import { useEffect, useState } from 'react';
import { Card, List, Skeleton, Tag, Typography, Button, theme } from 'antd';
import { RobotFilled, ArrowRightOutlined, CaretDownFilled, CaretUpFilled } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import type { QualityEvent } from '@/data/types';
import type { DateRange } from '@/components/DateRangeFilter';

const { Text, Paragraph } = Typography;

type Priority = 'high' | 'medium' | 'info';

type ActionItem = {
  priority: Priority;
  label: string;
  href: string;
};

function countBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

function topEntry(counts: Record<string, number>): [string, number] | null {
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a));
}

function buildInsights(events: QualityEvent[], dateRange: DateRange | null) {
  const n = events.length;
  if (n === 0) return { prose: 'No events match the current filters and date range.', actions: [] as ActionItem[] };

  const reported      = events.filter(e => e.status === 'Reported');
  const resolved      = events.filter(e => e.status === 'Validated' || e.status === 'Invalidated');
  const waitingOnTech = events.filter(e => e.additionalInfoRequested);
  const validatedNoRC = events.filter(e => e.status === 'Validated' && !e.rootCause);
  const staleReported = reported.filter(e => dayjs().diff(dayjs(e.date), 'day') >= 7);

  const topDisc     = topEntry(countBy(events, e => e.discrepancy));
  const topBranch   = topEntry(countBy(events, e => e.branch));
  const branchCount = Object.keys(countBy(events, e => e.branch)).length;
  const resolutionRate = Math.round((resolved.length / n) * 100);

  const underInv    = events.filter(e => e.status === 'Under Investigation');
  const topProduct  = topEntry(countBy(events, e => e.product));
  const topRC       = topEntry(countBy(events.filter(e => e.rootCause), e => e.rootCause!));

  const period = dateRange
    ? `During ${dateRange[0].format('MMM D')} – ${dateRange[1].format('MMM D, YYYY')}`
    : 'Across all time';

  let prose = `${period}, ${n} quality event${n !== 1 ? 's were' : ' was'} recorded across ${branchCount} branch${branchCount !== 1 ? 'es' : ''}. `;
  prose += `The overall resolution rate is ${resolutionRate}% — ${resolved.length} event${resolved.length !== 1 ? 's have' : ' has'} been validated or invalidated, while ${underInv.length} remain${underInv.length === 1 ? 's' : ''} under active investigation. `;
  if (topDisc) {
    const pct = Math.round((topDisc[1] / n) * 100);
    prose += `${topDisc[0]} is the leading discrepancy type at ${pct}% of all events`;
    prose += topBranch ? `, with ${topBranch[0]} contributing the highest volume of reports at ${topBranch[1]} event${topBranch[1] !== 1 ? 's' : ''}. ` : '. ';
  }
  if (topProduct) {
    const pct = Math.round((topProduct[1] / n) * 100);
    prose += `${topProduct[0]} is the most frequently affected product, appearing in ${pct}% of events this period. `;
  }
  if (waitingOnTech.length > 0) {
    prose += `${waitingOnTech.length} event${waitingOnTech.length !== 1 ? 's are' : ' is'} currently awaiting additional information from field technicians before triage can progress. `;
  }
  if (topRC) {
    prose += `Among resolved events, ${topRC[0]} is the most common confirmed root cause. `;
  }
  if (staleReported.length > 0) {
    prose += `${staleReported.length} reported event${staleReported.length !== 1 ? 's have' : ' has'} been open for 7 or more days without a status update — these may require escalation.`;
  }

  const actions: ActionItem[] = [];

  if (staleReported.length > 0) {
    actions.push({
      priority: 'high',
      label: `${staleReported.length} reported event${staleReported.length !== 1 ? 's have' : ' has'} been open 7+ days without a status change`,
      href: '/events?status=Reported',
    });
  } else if (reported.length > 0) {
    actions.push({
      priority: 'medium',
      label: `${reported.length} event${reported.length !== 1 ? 's are' : ' is'} in Reported status and awaiting triage`,
      href: '/events?status=Reported',
    });
  }

  if (waitingOnTech.length > 0) {
    actions.push({
      priority: 'medium',
      label: `${waitingOnTech.length} event${waitingOnTech.length !== 1 ? 's are' : ' is'} waiting on additional info from the field`,
      href: '/events?flag=additionalInfo',
    });
  }

  if (validatedNoRC.length > 0) {
    actions.push({
      priority: 'medium',
      label: `${validatedNoRC.length} validated event${validatedNoRC.length !== 1 ? 's are' : ' is'} missing a root cause — data quality gap`,
      href: '/events?status=Validated',
    });
  }

  if (topBranch && topBranch[1] >= 5) {
    const pct = Math.round((topBranch[1] / n) * 100);
    actions.push({
      priority: 'info',
      label: `${topBranch[0]} accounts for ${pct}% of events this period (${topBranch[1]}) — consider proactive outreach`,
      href: '/events',
    });
  }

  if (topDisc && Math.round((topDisc[1] / n) * 100) >= 20) {
    actions.push({
      priority: 'info',
      label: `${topDisc[0]} is disproportionately high — review for systemic root cause`,
      href: '/events',
    });
  }

  return { prose, actions };
}

const PRIORITY_TAG: Record<Priority, string> = {
  high:   'volcano',
  medium: 'gold',
  info:   'geekblue',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  high:   'Action',
  medium: 'Review',
  info:   'Insight',
};

export function AiSummary({
  events,
  dateRange,
}: {
  events: QualityEvent[];
  dateRange: DateRange | null;
}) {
  const { token } = theme.useToken();
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), 700);
    return () => clearTimeout(t);
  }, [dateRange]);

  const { prose, actions } = buildInsights(events, dateRange);

  return (
    <Card
      size="small"
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RobotFilled style={{ color: token.colorPrimary }} />
          <span style={{ fontSize: token.fontSizeSM, fontWeight: 600 }}>AI Summary</span>
          <Tag color="purple" style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 4px', marginLeft: 2 }}>Beta</Tag>
        </span>
      }
      extra={
        <Button
          type="text"
          size="small"
          icon={expanded ? <CaretUpFilled style={{ fontSize: token.fontSizeSM }} /> : <CaretDownFilled style={{ fontSize: token.fontSizeSM }} />}
          onClick={() => setExpanded(v => !v)}
          style={{ color: token.colorTextTertiary }}
        >
          <span style={{ fontSize: token.fontSizeSM }}>{expanded ? 'Collapse' : 'Expand'}</span>
        </Button>
      }
      styles={{ body: { padding: expanded ? undefined : 0, display: expanded ? undefined : 'none' } }}
      style={{ marginBottom: 0 }}
    >
      {!ready ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : (
        <>
          <Paragraph
            style={{
              fontSize: token.fontSize,
              color: token.colorTextSecondary,
              marginBottom: actions.length ? 12 : 0,
            }}
          >
            {prose}
          </Paragraph>

          {actions.length > 0 && (
            <List
              size="small"
              dataSource={actions}
              renderItem={(item) => (
                <List.Item style={{ padding: '5px 0', borderBlockEnd: 'none' }}>
                  <Link href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textDecoration: 'none' }}>
                    <Tag
                      color={PRIORITY_TAG[item.priority]}
                      style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 5px', flexShrink: 0, minWidth: 52, textAlign: 'center' }}
                    >
                      {PRIORITY_LABEL[item.priority]}
                    </Tag>
                    <Text style={{ fontSize: token.fontSizeSM, flex: 1, color: token.colorText }}>{item.label}</Text>
                    <ArrowRightOutlined style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, flexShrink: 0 }} />
                  </Link>
                </List.Item>
              )}
            />
          )}
        </>
      )}
    </Card>
  );
}
