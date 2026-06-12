import { expect } from '@playwright/test';
import { workspaceSearchRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class SearchPage extends WorkspacePage {

  goto = async () => {
    await this.page.goto(workspaceSearchRoute(this.workspaceSlug));
  };

  searchInput = () => this.page.getByPlaceholder('Search entities, diagrams, projects, schema…');
  searchResultCount = () => this.page.getByTestId('search-result-count');
  entitiesCategoryCount = () => this.page.getByTestId('entities-result-count');
  resultRow = (name: string) => this.page.getByRole('button').filter({ hasText: name });

  expectLoaded = async (options?: { empty?: boolean }) => {
    await this.workspaceShell.expectActiveNav('search');
    await expect(this.searchInput()).toBeVisible();
    if (options?.empty ?? true) {
      await expect(this.page.getByText('Start typing to search across the workspace.')).toBeVisible();
    }
  };

  search = async (query: string) => {
    await this.searchInput().fill(query);
    await this.searchInput().press('Enter');
  };

  expectEntityResultsFound = async () => {
    await expect(this.searchResultCount()).not.toHaveText('0');
    await expect(this.entitiesCategoryCount()).not.toHaveText('0');
  };

  expectSearchQuery = async (query: string) => {
    await expect(this.searchInput()).toHaveValue(query);
  };

  expectEntityResultCount = async (count: number) => {
    await expect(this.entitiesCategoryCount()).toHaveText(String(count));
  };

  expectResultVisible = async (name: string) => {
    await expect(this.resultRow(name)).toBeVisible();
  };
}
