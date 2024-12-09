import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { Spinner, useStyles2, Stack } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { i18nDate, t } from '../../../../../core/internationalization';
import { isAlertingRule, isRecordingRule, getFirstActiveAt } from '../../utils/rules';

import { AlertStateTag } from './AlertStateTag';

interface Props {
  rule: CombinedRule;
  isDeleting: boolean;
  isCreating: boolean;
  isPaused?: boolean;
}

export const RuleState = ({ rule, isDeleting, isCreating, isPaused }: Props) => {
  const style = useStyles2(getStyle);
  const { promRule } = rule;

  // return how long the rule has been in its firing state, if any
  const forTime = useMemo(() => {
    if (
      promRule &&
      isAlertingRule(promRule) &&
      promRule.alerts?.length &&
      promRule.state !== PromAlertingRuleState.Inactive
    ) {
      // find earliest alert
      const originalFirstActiveAt = promRule.activeAt ? new Date(promRule.activeAt) : getFirstActiveAt(promRule);

      // convert it to language specific format
      const firstActiveAtFormatted = originalFirstActiveAt
        ? i18nDate(originalFirstActiveAt, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : null;

      // Calculate time elapsed from earliest alert
      if (originalFirstActiveAt) {
        return (
          <span title={String(firstActiveAtFormatted)} className={style.for}>
            {t('time.for', 'for')}{' '}
            {intervalToAbbreviatedDurationString(
              {
                start: originalFirstActiveAt,
                end: new Date(),
              },
              false
            )}
          </span>
        );
      }
    }
    return null;
  }, [promRule, style]);

  if (isDeleting) {
    return (
      <Stack gap={1}>
        <Spinner />
        Deleting
      </Stack>
    );
  } else if (isCreating) {
    return (
      <Stack gap={1}>
        <Spinner />
        Creating
      </Stack>
    );
  } else if (promRule && isAlertingRule(promRule)) {
    return (
      <Stack gap={1}>
        <AlertStateTag state={promRule.state} isPaused={isPaused} />
        {!isPaused && forTime}
      </Stack>
    );
  } else if (promRule && isRecordingRule(promRule)) {
    return <>Recording rule</>;
  }
  return <>n/a</>;
};

const getStyle = (theme: GrafanaTheme2) => ({
  for: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
    paddingTop: '2px',
  }),
});
