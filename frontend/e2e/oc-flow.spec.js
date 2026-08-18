const { test, expect } = require('@playwright/test');

const admin = { login: 'e2e_admin', senha: 'E2E-test-only-123' };
const estoquista = { login: 'e2e_estoquista', senha: 'E2E-estoquista-test-only-123' };

async function loginAs(page, credentials) {
  await page.goto('/');
  await page.getByPlaceholder('Usuário').fill(credentials.login);
  await page.getByPlaceholder('Senha').fill(credentials.senha);
  await page.getByRole('button', { name: 'Acessar sistema' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logout(page) {
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('cria, conta, finaliza e aprova uma OC', async ({ page }) => {
  await loginAs(page, admin);
  await page.getByLabel('Navegação principal').getByRole('button', { name: 'Gerar OC' }).click();
  await expect(page.getByRole('heading', { name: 'Gerar ordem de contagem' })).toBeVisible();

  await page.getByLabel('Buscar produto').fill('Dipirona 500mg');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.getByLabel('Estoquista responsável').selectOption({ label: 'Estoquista E2E Test Only' });

  const createResponsePromise = page.waitForResponse((response) => (
    response.url().endsWith('/ocs/create-with-items') && response.request().method() === 'POST'
  ));
  await page.getByRole('form', { name: 'Gerar ordem de contagem' }).getByRole('button', { name: 'Gerar OC' }).click();
  const createdOc = await (await createResponsePromise).json();
  const ocCode = String(createdOc.id).padStart(4, '0');

  await expect(page.getByText('OC gerada com sucesso.')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/gestor/oc/${createdOc.id}$`));
  await logout(page);

  await loginAs(page, estoquista);
  await page.getByLabel('Navegação principal').getByRole('button', { name: 'Minhas OCs' }).click();
  const operationalCard = page.getByRole('article', { name: `OC ${ocCode}` });
  await expect(operationalCard).toBeVisible();
  await operationalCard.getByRole('button', { name: 'Abrir OC' }).click();
  await expect(page).toHaveURL(new RegExp(`/oc/${createdOc.id}$`));
  await expect(page.getByText('0 de 2 localizações contadas')).toBeVisible();

  for (const [address, quantity, lot, progress] of [
    ['A1-01-02', '60', 'E2E-LOTE-01', '1 de 2 localizações contadas'],
    ['A1-02-01', '60', 'E2E-LOTE-02', '2 de 2 localizações contadas']
  ]) {
    await page.getByRole('button', {
      name: `Contar localização de Dipirona 500mg — ${address}`
    }).click();
    await expect(page.getByRole('heading', { name: 'Registrar contagem' })).toBeVisible();
    await page.getByLabel('Quantidade').fill(quantity);
    await page.getByLabel('Lote').fill(lot);
    await page.getByRole('button', { name: 'Salvar contagem' }).click();
    await expect(page.getByText(progress)).toBeVisible();
  }

  await page.getByRole('button', { name: 'Finalizar contagem' }).click();
  const finalizeDialog = page.getByRole('dialog', { name: 'Finalizar contagem' });
  await finalizeDialog.getByRole('button', { name: 'Finalizar contagem' }).click();
  await expect(page.getByText('Contagem finalizada com sucesso.')).toBeVisible();
  await expect(page.getByText(`OC ${ocCode}`)).toHaveCount(0);
  await logout(page);

  await loginAs(page, admin);
  await page.getByLabel('Navegação principal').getByRole('button', { name: 'Aprovação' }).click();
  const approvalCard = page.getByRole('article', { name: `OC ${ocCode} aguardando aprovação` });
  await expect(approvalCard).toBeVisible();
  await approvalCard.getByRole('button', { name: 'Abrir detalhes' }).click();
  const details = page.getByRole('region', { name: `Detalhes da OC ${ocCode}` });
  await expect(details).toBeVisible();
  await expect(details.getByText('Empresa E2E Test Only')).toBeVisible();
  await expect(details.getByText('Responsável operacional: Estoquista E2E Test Only', { exact: true })).toBeVisible();
  await expect(details.getByRole('table').getByRole('cell', {
    name: 'Código 789123 Dipirona 500mg',
    exact: true
  })).toBeVisible();
  await approvalCard.getByRole('button', { name: 'Aprovar' }).click();
  const approveDialog = page.getByRole('dialog', { name: 'Aprovar OC' });
  await approveDialog.getByRole('button', { name: 'Aprovar' }).click();
  await expect(page.getByText('OC aprovada com sucesso.')).toBeVisible();

  await page.getByLabel('Navegação principal').getByRole('button', { name: 'Gestão de OCs' }).click();
  await page.getByLabel('Buscar').fill(ocCode);
  const finalCard = page.getByRole('article', { name: `OC ${ocCode}` });
  await expect(finalCard).toBeVisible();
  await expect(finalCard.getByText('Finalizada')).toBeVisible();
});
