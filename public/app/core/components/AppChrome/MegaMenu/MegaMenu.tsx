import { css } from '@emotion/css';
import { DOMAttributes } from '@react-types/shared';
import React, { forwardRef } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { CustomScrollbar, Icon, IconButton, useStyles2, Stack } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { useSelector } from 'app/types';

import { MegaMenuItem } from './MegaMenuItem';
import { enrichWithInteractionTracking, getActiveItem } from './utils';

export const MENU_WIDTH = '300px';

export interface Props extends DOMAttributes {
  onClose: () => void;
}

export const MegaMenu = React.memo(
  forwardRef<HTMLDivElement, Props>(({ onClose, ...restProps }, ref) => {
    const navTree = useSelector((state) => state.navBarTree);
    const styles = useStyles2(getStyles);
    const location = useLocation();
    const { chrome } = useGrafana();
    const state = chrome.useState();

    // only admin has the rights to see the 'administration/Verwaltung' tab in the navigation mega menu as well as the 'Connection' tab and certain 'Alerting' tabs
    let navItems = navTree;
    if (!contextSrv.hasRole('Admin')) {
      let alertingItem = navItems.find((item) => item.id === 'alerting');

      navItems = navItems.filter((item) => item.id !== 'cfg' && item.id !== 'am-routes' && item.id !== 'receivers');

      if (alertingItem !== undefined && alertingItem.children !== undefined) {
        // remove entire 'alerting' tab and restructure it to only show certain sub tabs of it
        navItems = navItems.filter((item) => item.id !== 'alerting');

        // get alert rules tab to make it the main tab to be seen later on instead of the general 'alerting' tab which is already removed
        let alertingRulesItem = alertingItem.children.find((item) => item.id === 'alert-list');

        // create a mutable copy of the `children` array  as the original can not be reassigned with reduced tabs
        const childrenAlertingItem = [
          ...alertingItem.children.filter(
            (item) => item.id !== 'receivers' && item.id !== 'am-routes' && item.id !== 'alert-list'
          ),
        ];

        if (alertingRulesItem !== undefined) {
          // create a mutable copy of `alertingRulesItem` as the original cannot be reassigned with the new children and the icon of the general 'alerting' tab
          alertingRulesItem = {
            ...alertingRulesItem,
            children: childrenAlertingItem,
            icon: 'bell',
          };
          navItems.push(alertingRulesItem);
        }
      }
    }

    // Remove profile + help from tree
    navItems = navItems
      .filter((item) => item.id !== 'profile' && item.id !== 'help')
      .map((item) => enrichWithInteractionTracking(item, state.megaMenuDocked));

    const activeItem = getActiveItem(navItems, state.sectionNav.node, location.pathname);

    const handleDockedMenu = () => {
      chrome.setMegaMenuDocked(!state.megaMenuDocked);
      if (state.megaMenuDocked) {
        chrome.setMegaMenuOpen(false);
      }

      // refocus on undock/menu open button when changing state
      setTimeout(() => {
        document.getElementById(state.megaMenuDocked ? 'mega-menu-toggle' : 'dock-menu-button')?.focus();
      });
    };

    return (
      <div data-testid={selectors.components.NavMenu.Menu} ref={ref} {...restProps}>
        <div className={styles.mobileHeader}>
          <Icon name="bars" size="xl" />
          <IconButton
            tooltip={t('navigation.megamenu.close', 'Close menu')}
            name="times"
            onClick={onClose}
            size="xl"
            variant="secondary"
          />
        </div>
        <nav className={styles.content}>
          <CustomScrollbar showScrollIndicators hideHorizontalTrack>
            <ul className={styles.itemList} aria-label={t('navigation.megamenu.list-label', 'Navigation')}>
              {navItems.map((link, index) => (
                <Stack key={link.text} direction={index === 0 ? 'row-reverse' : 'row'} alignItems="center">
                  {index === 0 && (
                    <IconButton
                      id="dock-menu-button"
                      className={styles.dockMenuButton}
                      tooltip={
                        state.megaMenuDocked
                          ? t('navigation.megamenu.undock', 'Undock menu')
                          : t('navigation.megamenu.dock', 'Dock menu')
                      }
                      name="web-section-alt"
                      onClick={handleDockedMenu}
                      variant="secondary"
                    />
                  )}
                  <MegaMenuItem
                    link={link}
                    onClick={state.megaMenuDocked ? undefined : onClose}
                    activeItem={activeItem}
                  />
                </Stack>
              ))}
            </ul>
          </CustomScrollbar>
        </nav>
      </div>
    );
  })
);

MegaMenu.displayName = 'MegaMenu';

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    position: 'relative',
  }),
  mobileHeader: css({
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 1, 1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,

    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  }),
  itemList: css({
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    listStyleType: 'none',
    padding: theme.spacing(1, 1, 2, 1),
    [theme.breakpoints.up('md')]: {
      width: MENU_WIDTH,
    },
  }),
  dockMenuButton: css({
    display: 'none',

    [theme.breakpoints.up('xl')]: {
      display: 'inline-flex',
    },
  }),
});
