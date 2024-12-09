import { isUndefined, omitBy, sum } from 'lodash';
import React, { Fragment } from 'react';

import { Badge, Stack } from '@grafana/ui';
import {
  AlertGroupTotals,
  AlertInstanceTotalState,
  CombinedRuleGroup,
  CombinedRuleNamespace,
} from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { t } from '../../../../../core/internationalization';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

// All available states for a rule need to be initialized to prevent NaN values when adding a number and undefined
const emptyStats: Required<AlertGroupTotals> = {
  recording: 0,
  alerting: 0,
  [PromAlertingRuleState.Pending]: 0,
  [PromAlertingRuleState.Inactive]: 0,
  paused: 0,
  error: 0,
  nodata: 0,
};

export const RuleStats = ({ namespaces }: Props) => {
  const stats = { ...emptyStats };

  // sum all totals for all namespaces
  namespaces.forEach(({ groups }) => {
    groups.forEach((group) => {
      const groupTotals = omitBy(group.totals, isUndefined);
      for (let key in groupTotals) {
        // @ts-ignore
        stats[key] += groupTotals[key];
      }
    });
  });

  const statsComponents = getComponentsFromStats(stats);
  const hasStats = Boolean(statsComponents.length);

  const total = sum(Object.values(stats));

  statsComponents.unshift(
    <Fragment key="total">
      {total} {t(total === 1 ? 'rule-stats.rule-single' : 'rule-stats.rule-plural', total === 1 ? 'rule' : 'rules')}
    </Fragment>
  );

  return (
    <Stack direction="row">
      {hasStats && (
        <div>
          <Stack gap={0.5}>{statsComponents}</Stack>
        </div>
      )}
    </Stack>
  );
};

interface RuleGroupStatsProps {
  group: CombinedRuleGroup;
}

export const RuleGroupStats = ({ group }: RuleGroupStatsProps) => {
  const stats = group.totals;
  const evaluationInterval = group?.interval;

  const statsComponents = getComponentsFromStats(stats);
  const hasStats = Boolean(statsComponents.length);

  return (
    <Stack direction="row">
      {hasStats && (
        <div>
          <Stack gap={0.5}>{statsComponents}</Stack>
        </div>
      )}
      {evaluationInterval && (
        <>
          <div>|</div>
          <Badge text={evaluationInterval} icon="clock-nine" color={'blue'} />
        </>
      )}
    </Stack>
  );
};

export function getComponentsFromStats(
  stats: Partial<Record<AlertInstanceTotalState | 'paused' | 'recording', number>>
) {
  const statsComponents: React.ReactNode[] = [];

  if (stats[AlertInstanceTotalState.Alerting]) {
    statsComponents.push(
      <Badge
        color="red"
        key="firing"
        text={t('rule-stats.firing', '{{count}} firing', { count: stats[AlertInstanceTotalState.Alerting] })}
      />
    );
  }

  if (stats.error) {
    statsComponents.push(
      <Badge color="red" key="errors" text={t('rule-stats.errors', '{{count}} errors', { count: stats.error })} />
    );
  }

  if (stats.nodata) {
    statsComponents.push(
      <Badge color="blue" key="nodata" text={t('rule-stats.no-data', '{{count}} no data', { count: stats.nodata })} />
    );
  }

  if (stats[AlertInstanceTotalState.Pending]) {
    statsComponents.push(
      <Badge
        color={'orange'}
        key="pending"
        text={t('rule-stats.pending', '{{count}} pending', { count: stats[AlertInstanceTotalState.Pending] })}
      />
    );
  }

  if (stats[AlertInstanceTotalState.Normal] && stats.paused) {
    statsComponents.push(
      <Badge
        color="green"
        key="paused"
        text={t('rules-stats.normal-paused', '{{normalCount}} normal ({{pausedCount}} paused)', {
          normalCount: stats[AlertInstanceTotalState.Normal],
          pausedCount: stats.paused,
        })}
      />
    );
  }

  if (stats[AlertInstanceTotalState.Normal] && !stats.paused) {
    statsComponents.push(
      <Badge
        color="green"
        key="inactive"
        text={t('rule-stats.normal', '{{count}} normal', { count: stats[AlertInstanceTotalState.Normal] })}
      />
    );
  }

  if (stats.recording) {
    statsComponents.push(
      <Badge
        color="purple"
        key="recording"
        text={t('rule-stats.recording', '{{count}} recording', { count: stats.recording })}
      />
    );
  }

  return statsComponents;
}
