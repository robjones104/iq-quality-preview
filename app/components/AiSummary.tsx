'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, Skeleton, Tag, Tooltip, Typography, Button, theme } from 'antd';
import { RobotFilled, ArrowRightOutlined, CaretDownFilled, CaretUpFilled } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { now } from '@/lib/appTime';
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
  const staleReported = reported.filter(e => now().diff(dayjs(e.date), 'day') >= 7);

  const topIssue    = topEntry(countBy(events, e => e.issue));
  const topBranch   = topEntry(countBy(events, e => e.branch));
  const branchCount = Object.keys(countBy(events, e => e.branch)).length;
  const resolutionRate = Math.round((resolved.length / n) * 100);

  const underInv    = events.filter(e => e.status === 'Under Investigation');
  const topComponent = topEntry(countBy(events, e => e.component));
  const topRC       = topEntry(countBy(events.filter(e => e.rootCause), e => e.rootCause!));

  const period = dateRange
    ? `During ${dateRange[0].format('MMM D')} – ${dateRange[1].format('MMM D, YYYY')}`
    : 'Across all time';

  let prose = `${period}, ${n} quality event${n !== 1 ? 's were' : ' was'} recorded across ${branchCount} branch${branchCount !== 1 ? 'es' : ''}. `;
  prose += `The overall resolution rate is ${resolutionRate}% — ${resolved.length} event${resolved.length !== 1 ? 's have' : ' has'} been validated or invalidated, while ${underInv.length} remain${underInv.length === 1 ? 's' : ''} under active investigation. `;
  if (topIssue) {
    const pct = Math.round((topIssue[1] / n) * 100);
    prose += `${topIssue[0]} is the leading issue type at ${pct}% of all events`;
    prose += topBranch ? `, with ${topBranch[0]} contributing the highest volume of reports at ${topBranch[1]} event${topBranch[1] !== 1 ? 's' : ''}. ` : '. ';
  }
  if (topComponent) {
    const pct = Math.round((topComponent[1] / n) * 100);
    prose += `${topComponent[0]} is the most frequently affected component, appearing in ${pct}% of events this period. `;
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
      href: `/events?branch=${encodeURIComponent(topBranch[0])}`,
    });
  }

  if (topIssue && Math.round((topIssue[1] / n) * 100) >= 20) {
    actions.push({
      priority: 'info',
      label: `${topIssue[0]} is disproportionately high — review for systemic root cause`,
      href: `/events?issue=${encodeURIComponent(topIssue[0])}`,
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

  // The summary is only generated while the card is expanded; a generated
  // result is kept until the date range it was built for changes.
  const rangeKey = dateRange ? `${dateRange[0].format('YYYY-MM-DD')}_${dateRange[1].format('YYYY-MM-DD')}` : 'all';
  const generatedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    if (generatedFor.current === rangeKey) return;
    setReady(false);
    const t = setTimeout(() => {
      generatedFor.current = rangeKey;
      setReady(true);
    }, 700);
    return () => clearTimeout(t);
  }, [expanded, rangeKey]);

  const { prose, actions } = expanded && ready
    ? buildInsights(events, dateRange)
    : { prose: '', actions: [] as ActionItem[] };

  return (
    <Card
      size="small"
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RobotFilled style={{ color: token.colorPrimary }} />
          <span style={{ fontSize: token.fontSizeSM, fontWeight: 600 }}>AI Summary</span>
          <Tooltip title="AI-generated from the events in the current filters — review before acting on it.">
            <Tag color="purple" style={{ fontSize: token.fontSizeXS, lineHeight: '16px', padding: '0 4px', marginLeft: 2, cursor: 'help' }}>Beta</Tag>
          </Tooltip>
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
            <div>
              {actions.map((item) => (
                <div key={item.href + item.label} style={{ padding: '5px 0' }}>
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
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
