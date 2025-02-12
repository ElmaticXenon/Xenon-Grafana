import { css } from '@emotion/css';
import i18next from 'i18next';
import React from 'react';

import { GrafanaTheme2, dateTime } from '@grafana/data';
import { useStyles2, Tooltip } from '@grafana/ui';
import { Time } from 'app/features/explore/Time';
import { CombinedRule } from 'app/types/unified-alerting';

import { i18nDate, t } from '../../../../../core/internationalization';
import { useCleanAnnotations } from '../../utils/annotations';
import { isRecordingRulerRule } from '../../utils/rules';
import { isNullDate } from '../../utils/time';
import { AlertLabels } from '../AlertLabels';
import { DetailsField } from '../DetailsField';

import { RuleDetailsAnnotations } from './RuleDetailsAnnotations';
import RuleDetailsButtons from './RuleDetailsButtons';
import { RuleDetailsDataSources } from './RuleDetailsDataSources';
import { RuleDetailsExpression } from './RuleDetailsExpression';
import { RuleDetailsMatchingInstances } from './RuleDetailsMatchingInstances';

interface Props {
  rule: CombinedRule;
}

// The limit is set to 15 in order to upkeep the good performance
// and to encourage users to go to the rule details page to see the rest of the instances
// We don't want to paginate the instances list on the alert list page
export const INSTANCES_DISPLAY_LIMIT = 15;

export const RuleDetails = ({ rule }: Props) => {
  const styles = useStyles2(getStyles);
  const {
    namespace: { rulesSource },
  } = rule;

  const annotations = useCleanAnnotations(rule.annotations);

  return (
    <div>
      <RuleDetailsButtons rule={rule} rulesSource={rulesSource} />
      <div className={styles.wrapper}>
        <div className={styles.leftSide}>
          {<EvaluationBehaviorSummary rule={rule} />}
          {!!rule.labels && !!Object.keys(rule.labels).length && (
            <DetailsField label="Labels" horizontal={true}>
              <AlertLabels labels={rule.labels} />
            </DetailsField>
          )}
          <RuleDetailsExpression rulesSource={rulesSource} rule={rule} annotations={annotations} />
          <RuleDetailsAnnotations annotations={annotations} />
        </div>
        <div className={styles.rightSide}>
          <RuleDetailsDataSources rulesSource={rulesSource} rule={rule} />
        </div>
      </div>
      <DetailsField label="Instances" horizontal={true}>
        <RuleDetailsMatchingInstances rule={rule} itemsDisplayLimit={INSTANCES_DISPLAY_LIMIT} />
      </DetailsField>
    </div>
  );
};

interface EvaluationBehaviorSummaryProps {
  rule: CombinedRule;
}

const EvaluationBehaviorSummary = ({ rule }: EvaluationBehaviorSummaryProps) => {
  let forDuration: string | undefined;
  let every = rule.group.interval;
  let lastEvaluation = rule.promRule?.lastEvaluation;
  let lastEvaluationDuration = rule.promRule?.evaluationTime;

  // recording rules don't have a for duration
  if (!isRecordingRulerRule(rule.rulerRule)) {
    forDuration = rule.rulerRule?.for ?? '0s';
  }

  return (
    <>
      {every && (
        <DetailsField label="Evaluate" horizontal={true}>
          {t('details-fields.every', 'Every')} {every}
        </DetailsField>
      )}

      <DetailsField label="Pending period" horizontal={true}>
        {forDuration}
      </DetailsField>

      {lastEvaluation && !isNullDate(lastEvaluation) && (
        <DetailsField label="Last evaluation" horizontal={true}>
          <Tooltip
            placement="top"
            content={i18nDate(lastEvaluation, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
            theme="info"
          >
            <span>
              {(() => {
                const currLang = i18next.language.substring(0, 2);
                return currLang === 'de'
                  ? `vor ${dateTime(lastEvaluation).locale('de').fromNow(true)}`
                  : `${dateTime(lastEvaluation).locale('en').fromNow(true)} ago`;
              })()}
            </span>
          </Tooltip>
        </DetailsField>
      )}

      {lastEvaluation && !isNullDate(lastEvaluation) && lastEvaluationDuration !== undefined && (
        <DetailsField label="Evaluation time" horizontal={true}>
          <Tooltip placement="top" content={`${lastEvaluationDuration}s`} theme="info">
            <span>{Time({ timeInMs: lastEvaluationDuration * 1000, humanize: true })}</span>
          </Tooltip>
        </DetailsField>
      )}
    </>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'row',

    [theme.breakpoints.down('md')]: {
      flexDirection: 'column',
    },
  }),
  leftSide: css({
    flex: 1,
  }),
  rightSide: css({
    [theme.breakpoints.up('md')]: {
      paddingLeft: '90px',
      width: '300px',
    },
  }),
});
