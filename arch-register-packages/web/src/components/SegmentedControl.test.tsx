import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  { value: 'a', label: 'A', title: 'Option A' },
  { value: 'b', label: 'B' }
];

describe('SegmentedControl', () => {
  test('renders one button per option and marks only the selected one as pressed', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl value="b" onChange={() => {}} options={OPTIONS} />
    );
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('title="Option A"');
  });
});
