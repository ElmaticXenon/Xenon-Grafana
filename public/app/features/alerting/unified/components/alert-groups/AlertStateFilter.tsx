import React from 'react';

import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup, Label } from '@grafana/ui';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';

import { Trans, t } from '../../../../../core/internationalization';

interface Props {
  stateFilter?: AlertState;
  onStateFilterChange: (value: AlertState) => void;
}

export const AlertStateFilter = ({ onStateFilterChange, stateFilter }: Props) => {
  const alertStateOptions: SelectableValue[] = Object.entries(AlertState)
    .sort(([labelA], [labelB]) => (labelA < labelB ? -1 : 1))
    .map(([label, state]) => ({
      label: createTransKey(label),
      value: state,
    }));

  return (
    <div>
      <Label>
        <Trans i18nKey="alert-groups.state">State</Trans>
      </Label>
      <RadioButtonGroup options={alertStateOptions} value={stateFilter} onChange={onStateFilterChange} />
    </div>
  );
};

function createTransKey(str: string) {
  let transKey = str.toLowerCase();
  transKey = 'alert-groups.' + transKey;
  return t(transKey, str);
}
