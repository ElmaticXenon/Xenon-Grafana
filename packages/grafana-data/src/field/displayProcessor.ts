// Libraries
import { toString, toNumber as _toNumber, isEmpty, isBoolean, isArray, join } from 'lodash';

// Types
import { getFieldTypeFromValue } from '../dataframe/processDataFrame';
import { toUtc, dateTimeParse } from '../datetime';
import { GrafanaTheme2 } from '../themes/types';
import { KeyValue, TimeZone } from '../types';
import { Field, FieldType } from '../types/dataFrame';
import { DecimalCount, DisplayProcessor, DisplayValue } from '../types/displayValue';
import { anyToNumber } from '../utils/anyToNumber';
import { getValueMappingResult } from '../utils/valueMappings';
import { FormattedValue, getValueFormat, isBooleanUnit } from '../valueFormats/valueFormats';

import { getScaleCalculator } from './scale';

interface DisplayProcessorOptions {
  field: Partial<Field>;
  /**
   * Will pick browser timezone if not defined
   */
  timeZone?: TimeZone;
  /**
   * Will pick 'dark' if not defined
   */
  theme: GrafanaTheme2;
}

// Reasonable units for time
const timeFormats: KeyValue<boolean> = {
  dateTimeAsIso: true,
  dateTimeAsIsoNoDateIfToday: true,
  dateTimeAsUS: true,
  dateTimeAsUSNoDateIfToday: true,
  dateTimeAsLocal: true,
  dateTimeAsLocalNoDateIfToday: true,
  dateTimeFromNow: true,
};

export function getDisplayProcessor(options?: DisplayProcessorOptions): DisplayProcessor {
  console.log(options);
  if (!options || isEmpty(options) || !options.field) {
    return toStringProcessor;
  }

  const field = options.field as Field;
  console.log(field);
  const config = field.config ?? {};

  let unit = config.unit;
  let hasDateUnit = unit && (timeFormats[unit] || unit.startsWith('time:'));
  let showMs = false;

  if (field.type === FieldType.time && !hasDateUnit) {
    unit = `dateTimeAsSystem`;
    hasDateUnit = true;
    if (field.values && field.values.length > 1) {
      let start = field.values.get(0);
      let end = field.values.get(field.values.length - 1);
      if (typeof start === 'string') {
        start = dateTimeParse(start).unix();
        end = dateTimeParse(end).unix();
      } else {
        start /= 1e3;
        end /= 1e3;
      }
      showMs = Math.abs(end - start) < 60; //show ms when minute or less
      console.log(showMs);
    }
  } else if (field.type === FieldType.boolean) {
    if (!isBooleanUnit(unit)) {
      unit = 'bool';
    }
  } else if (!unit && field.type === FieldType.string) {
    unit = 'string';
  }

  const hasCurrencyUnit = unit?.startsWith('currency');
  const hasBoolUnit = unit === 'bool';
  const isNumType = field.type === FieldType.number;
  const isLocaleFormat = unit === 'locale';
  const canTrimTrailingDecimalZeros =
    !hasDateUnit && !hasCurrencyUnit && !hasBoolUnit && !isLocaleFormat && isNumType && config.decimals == null;

  const formatFunc = getValueFormat(unit || 'none');
  console.log(formatFunc);
  const scaleFunc = getScaleCalculator(field, options.theme);
  console.log(scaleFunc);

  return (value: any, adjacentDecimals?: DecimalCount) => {
    console.log(value);
    console.log(adjacentDecimals);
    const { mappings } = config;
    console.log(config);
    const isStringUnit = unit === 'string';

    if (hasDateUnit && typeof value === 'string') {
      value = toUtc(value).valueOf();
      console.log(value);
    }

    let numeric = isStringUnit ? NaN : anyToNumber(value);
    console.log(numeric);
    let text: string | undefined;
    console.log(text);
    let prefix: string | undefined;
    console.log(prefix);
    let suffix: string | undefined;
    let color: string | undefined;
    let icon: string | undefined;
    let percent: number | undefined;

    if (mappings && mappings.length > 0) {
      const mappingResult = getValueMappingResult(mappings, value);
      console.log(mappings);
      console.log(value);

      if (mappingResult) {
        if (mappingResult.text != null) {
          text = mappingResult.text;
        }

        if (mappingResult.color != null) {
          color = options.theme.visualization.getColorByName(mappingResult.color);
        }

        if (mappingResult.icon != null) {
          icon = mappingResult.icon;
        }
      }
    }

    if (!Number.isNaN(numeric)) {
      console.log(numeric);
      if (text == null && !isBoolean(value)) {
        console.log(text);
        console.log(value);
        let v: FormattedValue;
        //console.log(v);
        console.log(numeric);
        //console.log(FormattedValue);

        if (canTrimTrailingDecimalZeros && adjacentDecimals != null) {
          v = formatFunc(numeric, adjacentDecimals, null, options.timeZone, showMs);
          console.log(v);
          console.log(canTrimTrailingDecimalZeros);
          console.log(numeric);
          console.log(adjacentDecimals);
          console.log(options.timeZone);
          console.log(showMs);
          // if no explicit decimals config, we strip trailing zeros e.g. 60.00 -> 60
          // this is needed because we may have determined the minimum determined `adjacentDecimals` for y tick increments based on
          // e.g. 'seconds' field unit (0.15s, 0.20s, 0.25s), but then formatFunc decided to return milli or nanos (150, 200, 250)
          // so we end up with excess precision: 150.00, 200.00, 250.00
          if (v.text.indexOf(',') !== -1) {
            // If they have a comma in the StringWenn der String ein Komma enthält
            // hier Code ausführen oder Fehlerbehandlung durchführen
          } else {
            // Wenn der String kein Komma enthält, wie in deinem ursprünglichen Code,
            // Konvertierung durchführen
            v.text = +v.text + '';
          }
          //if (v.text === ''+','+'') {} else {v.text = +v.text + '';}
          //o.text = v.text.replace(',','.');
          //console.log(o.text);
          //v.text = +v.text + '';
          //if (v.text == 'NaN') {v.text = 'Hallo'} else {v.text};
          //console.log(v.text);
          //console.log(text);
        } else {
          v = formatFunc(numeric, config.decimals, null, options.timeZone, showMs);
          console.log(v);
        }

        text = v.text;
        suffix = v.suffix;
        prefix = v.prefix;
      }

      // Return the value along with scale info
      if (color == null) {
        const scaleResult = scaleFunc(numeric);
        color = scaleResult.color;
        percent = scaleResult.percent;
      }
    }

    if (text == null && isArray(value)) {
      text = join(value, ', ');
    }

    if (text == null) {
      text = toString(value);
      if (!text) {
        if (config.noValue) {
          text = config.noValue;
        } else {
          text = ''; // No data?
        }
      }
    }

    if (!color) {
      const scaleResult = scaleFunc(-Infinity);
      color = scaleResult.color;
      percent = scaleResult.percent;
    }

    const display: DisplayValue = {
      text,
      numeric,
      prefix,
      suffix,
      color,
    };

    if (icon != null) {
      display.icon = icon;
    }

    if (percent != null) {
      display.percent = percent;
    }

    return display;
  };
}

function toStringProcessor(value: any): DisplayValue {
  return { text: toString(value), numeric: anyToNumber(value) };
}

export function getRawDisplayProcessor(): DisplayProcessor {
  return (value: any) => ({
    text: getFieldTypeFromValue(value) === 'other' ? `${JSON.stringify(value, getCircularReplacer())}` : `${value}`,
    numeric: null as unknown as number,
  });
}

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (_key: any, value: object | null) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};
