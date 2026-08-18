const { test, expect } = require('@playwright/test');

const credentials = { login: 'e2e_admin', senha: 'E2E-test-only-123' };

async function login(page) {
  await page.goto('/');
  await page.getByPlaceholder('Usuário').fill(credentials.login);
  await page.getByPlaceholder('Senha').fill(credentials.senha);
  await page.getByRole('button', { name: 'Acessar sistema' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('exibe a tela de login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByPlaceholder('Usuário')).toBeVisible();
  await expect(page.getByPlaceholder('Senha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acessar sistema' })).toBeVisible();
});

test('autentica um usuário E2E e alcança o dashboard protegido', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Empresa E2E Test Only').first()).toBeVisible();
});

test('rejeita login inválido e mantém a sessão anônima', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Usuário').fill(credentials.login);
  await page.getByPlaceholder('Senha').fill('senha-incorreta-e2e');
  await page.getByRole('button', { name: 'Acessar sistema' }).click();
  await expect(page.getByText('Senha invalida')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/$/);
});

test('redireciona rota protegida sem autenticação', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Acessar sistema' })).toBeVisible();
});

test('logout encerra a sessão e bloqueia novamente o dashboard', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/$/);
});
