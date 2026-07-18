import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FormElement } from './FormElement';

describe('FormElement field status labels', () => {
  it('shows optional text for explicitly optional fields', () => {
    const markup = renderToStaticMarkup(
      <FormElement label="Description" required={false}>
        <input />
      </FormElement>
    );

    expect(markup).toContain('Description');
    expect(markup).toContain('(optional)');
  });

  it('does not add a visual marker to required fields', () => {
    const markup = renderToStaticMarkup(
      <FormElement label="Name" required>
        <input />
      </FormElement>
    );

    expect(markup).toContain('Name');
    expect(markup).not.toContain('(optional)');
    expect(markup).not.toContain('*');
  });

  it('treats omitted required status as required', () => {
    const markup = renderToStaticMarkup(
      <FormElement label="Email">
        <input />
      </FormElement>
    );

    expect(markup).not.toContain('(optional)');
  });
});
