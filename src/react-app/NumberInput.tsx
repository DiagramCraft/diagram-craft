import { TbChevronDown, TbChevronUp } from 'react-icons/tb';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { $c } from '../utils/classname.ts';
import { propsUtils } from '../react-canvas-viewer/utils/propsUtils.ts';

const parse = (value: string) => {
  const m = value.match(/^ ?(-?\d+\.?\d*) ?([^ ]*)$/);
  if (!m) return undefined;
  if (m[2] === '') return [m[1], undefined];
  return [m[1], m[2]];
};

let idx = 0;

const AdjustButton = (props: {
  className: string;
  children: React.ReactNode;
  onClick: () => void;
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const mouseDown = () => {
      idx = 0;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        idx++;

        // A little bit slower in the beginning
        if (idx < 10 && idx % 2 === 0) return;

        props.onClick();
      }, 50);
    };
    const mouseUp = () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    btnRef.current?.addEventListener('mousedown', mouseDown);
    btnRef.current?.addEventListener('mouseup', mouseUp);
    btnRef.current?.addEventListener('mouseleave', mouseUp);
    return () => {
      btnRef.current?.removeEventListener('mousedown', mouseDown);
      btnRef.current?.removeEventListener('mouseup', mouseUp);
      btnRef.current?.removeEventListener('mouseleave', mouseUp);
    };
  }, [btnRef, props.onClick]);

  return (
    <button ref={btnRef} className={props.className}>
      {props.children}
    </button>
  );
};

function formatValue(value: string, defaultUnit: string | undefined, fallback: string) {
  const parsedValue = parse(value.toString());
  let formattedValue = fallback;
  if (parsedValue) {
    formattedValue = parsedValue[0] + ' ' + (parsedValue[1] ?? defaultUnit ?? '');
  }
  return formattedValue;
}

export const NumberInput = (props: Props) => {
  const [error, setError] = useState(false);
  const [origValue, setOrigValue] = useState(props.value.toString());
  const [currentValue, setCurrentValue] = useState(
    formatValue(props.value.toString(), props.defaultUnit, props.value.toString())
  );
  const hasFocus = useRef(false);

  const updateCurrentValue = useCallback(() => {
    setCurrentValue(formatValue(props.value.toString(), props.defaultUnit, currentValue));
  }, [props.value, props.defaultUnit, currentValue]);

  const adjust = useCallback(
    (delta: number) => {
      setCurrentValue(prev => {
        const p = parse(prev);
        if (!p) return prev;

        const newValue = parseFloat(p[0]!) + delta;

        if (props.min !== undefined && newValue < Number(props.min)) return prev;
        if (props.max !== undefined && newValue > Number(props.max)) return prev;

        const newUnit = p[1] ?? props.defaultUnit;

        setTimeout(() => props.onChange(newValue, newUnit), 0);
        return newValue.toString() + ' ' + (newUnit ?? '');
      });
    },
    [currentValue, setCurrentValue, props.onChange, props.defaultUnit]
  );

  if (origValue !== props.value.toString() && !hasFocus.current) {
    setOrigValue(props.value.toString());
    updateCurrentValue();
  }

  return (
    <div className={$c('cmp-number-input', { error: error })} style={props.style ?? {}}>
      <input
        {...propsUtils.except(props, 'validUnits', 'defaultUnit', 'value', 'onChange')}
        type={'text'}
        value={currentValue}
        onFocus={() => {
          hasFocus.current = true;
        }}
        onBlur={() => {
          hasFocus.current = true;
          updateCurrentValue();
        }}
        onChange={ev => {
          const p = parse(ev.target.value);
          setCurrentValue(ev.target.value);

          if (ev.target.value === '') {
            setError(false);
            props.onChange(undefined);
            return;
          }

          if (!p) {
            setError(true);
            return;
          }

          setError(false);
          props.onChange(parseFloat(p[0]!), p[1] ?? props.defaultUnit);
          return;
        }}
      />
      <AdjustButton
        className={'cmp-number-input__btn-up'}
        onClick={() => adjust(props.step ? Number(props.step) : 1)}
      >
        <TbChevronUp size={'0.7rem'} />
      </AdjustButton>
      <AdjustButton
        className={'cmp-number-input__btn-down'}
        onClick={() => adjust(props.step ? -1 * Number(props.step) : -1)}
      >
        <TbChevronDown size={'0.7rem'} />
      </AdjustButton>
    </div>
  );
};

type Props = {
  validUnits?: string[];
  defaultUnit?: string;
  value: string | number;
  onChange: (value: number | undefined, unit?: string) => void;
} & Omit<
  React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
  'onChange' | 'value'
>;
