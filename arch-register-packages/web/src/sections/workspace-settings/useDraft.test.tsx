import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useDraft } from './useDraft';

describe('useDraft', () => {
  it('starts clean and exposes the derived draft', () => {
    let result: ReturnType<typeof useDraft<number[], string[]>> | undefined;
    const Probe = () => {
      result = useDraft([1, 2], s => s.map(String));
      return null;
    };
    renderToStaticMarkup(<Probe />);
    expect(result?.draft).toEqual(['1', '2']);
    expect(result?.dirty).toBe(false);
  });
});
