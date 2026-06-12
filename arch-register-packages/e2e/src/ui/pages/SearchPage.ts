import { expect, } from '@playwright/test';
import { workspaceSearchRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class SearchPage extends WorkspacePage {

  goto = async () => {
    await this.page.goto(workspaceSearchRoute(this.workspaceSlug));
  };

  searchInput = () => this.page.getByPlaceholder('Search entities, diagrams, projects, schema…');
  searchResultCount = () => this.page.getByTestId('search-result-count');
  entitiesCategoryCount = () => this.page.getByTestId('entities-result-count');

  expectLoaded = async () => {
    await this.workspaceShell.expectActiveNav('search');
    await expect(this.searchInput()).toBeVisible();
    await expect(this.page.getByText('Start typing to search across the workspace.')).toBeVisible();
  };

  search = async (query: string) => {
    await this.searchInput().fill(query);
    await this.searchInput().press('Enter');
  };

  expectEntityResultsFound = async () => {
    await expect(this.searchResultCount()).not.toHaveText('0');
    await expect(this.entitiesCategoryCount()).not.toHaveText('0');
  };
}
