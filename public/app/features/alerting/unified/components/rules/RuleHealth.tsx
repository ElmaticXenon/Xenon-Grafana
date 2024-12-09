import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { Rule } from 'app/types/unified-alerting';

import { t } from '../../../../../core/internationalization';
import { isErrorHealth } from '../rule-viewer/RuleViewer';

interface Prom {
  rule: Rule;
}

export const RuleHealth = ({ rule }: Prom) => {
  const style = useStyles2(getStyle);

  if (isErrorHealth(rule.health)) {
    return (
      <Tooltip theme="error" content={rule.lastError || 'No error message provided.'}>
        <div className={style.warn}>
          <Icon name="exclamation-triangle" />
          <span>{t('alert-rules.error', 'error')}</span>
        </div>
      </Tooltip>
    );
  }

  return <>{t(`alert-rules.${rule.health.toLowerCase().replace(/\s+/g, '-')}`, rule.health)}</>;
};

const getStyle = (theme: GrafanaTheme2) => ({
  warn: css({
    display: 'inline-flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),

    color: theme.colors.warning.text,
  }),
});
