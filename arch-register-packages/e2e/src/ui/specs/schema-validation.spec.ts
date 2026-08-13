import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { workspaceSchemaValidationRoute } from '../support/routes';
import { defaultWorkspace } from '../support/workspaces';

const DATA_FLOW_RELATION_SCHEMA_ID = '00000000-0000-0000-0000-000000000030';

test.describe('schema validation diagnostics', () => {
  test('is available from model settings and shows a valid empty state', async ({ page }) => {
    await page.goto(workspaceSchemaValidationRoute(defaultWorkspace.slug));

    await expect(page.getByText('Schema Validation', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Schema configuration looks good')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recheck' })).toBeVisible();
    await expect(page.getByText('Schema Validation', { exact: true }).last()).toBeVisible();
  });

  test('shows findings and direct mitigation links for an invalid projection', async ({ page }) => {
    const apiUrl = new URL(
      `/api/application/v1/${defaultWorkspace.slug}/schemas`,
      page.url()
    ).toString();
    const createResponse = await page.request.post(apiUrl, {
      data: {
        name: 'Schema Validation Fixture',
        key_prefix: 'SVF',
        fields: [
          {
            id: 'invalid_projection',
            name: 'Invalid projection',
            type: 'typedRelation',
            relationSchemaId: DATA_FLOW_RELATION_SCHEMA_ID,
            direction: 'in'
          }
        ]
      }
    });
    expect(createResponse.ok()).toBeTruthy();
    const createdSchema = (await createResponse.json()) as { id: string };

    try {
      await page.goto(workspaceSchemaValidationRoute(defaultWorkspace.slug));
      await expect(page.getByText('advisory issue', { exact: false })).toBeVisible();
      await expect(
        page.getByText(/is not allowed at that endpoint/, { exact: false })
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Open entity schema' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Open relation schema' })).toBeVisible();

      await page.getByRole('button', { name: 'Recheck' }).click();
      await expect(
        page.getByText(/is not allowed at that endpoint/, { exact: false })
      ).toBeVisible();
    } finally {
      const deleteResponse = await page.request.delete(`${apiUrl}/${createdSchema.id}`);
      expect(deleteResponse.ok()).toBeTruthy();
    }
  });
});
