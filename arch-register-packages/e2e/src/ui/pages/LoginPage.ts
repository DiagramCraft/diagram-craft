import { expect, type Page } from '@playwright/test';
import { seededUser } from '../support/users';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  goto = async () => {
    await this.page.goto('/login');
  };

  signIn = async (email: string, password: string) => {
    await this.page.getByLabel('Username').fill(email);
    await this.page.locator('#lg-pass').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  };

  signInAsSeededUser = async () => {
    await this.signIn(seededUser.email, seededUser.password);
  };

  expectLoaded = async () => {
    await expect(this.page.getByText('Arch Register')).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(this.page.getByLabel('Username')).toBeVisible();
    await expect(this.page.locator('#lg-pass')).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  };

  expectError = async () => {
    await expect(this.page.getByRole('alert')).toBeVisible();
  };
}
