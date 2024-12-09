import React, { forwardRef, Ref } from 'react';

import { Button, ButtonProps, Icon, Stack } from '@grafana/ui';

import { Trans } from '../../../../core/internationalization';

const MoreButton = forwardRef(function MoreButton(props: ButtonProps, ref: Ref<HTMLButtonElement>) {
  return (
    <Button variant="secondary" size="sm" type="button" aria-label="More" ref={ref} {...props}>
      <Stack direction="row" alignItems="center" gap={0}>
        <Trans i18nKey="menu-item.more">More</Trans> <Icon name="angle-down" />
      </Stack>
    </Button>
  );
});

export default MoreButton;
