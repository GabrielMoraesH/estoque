const { test, expect } = require('@playwright/test');

const admin = { login: 'e2e_admin', senha: 'E2E-test-only-123' };
const estoquistaN1 = { login: 'e2e_estoquista', senha: 'E2E-estoquista-test-only-123' };
const estoquistaN2 = { login: 'e2e_estoquista_n2', senha: 'E2E-estoquista-n2-test-only-123' };

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

async function countLocation(page, product, address, quantity, lot, progress) {
  await page.getByRole('button', {
    name: `Contar localização de ${product} — ${address}`
  }).click();
  await expect(page.getByRole('heading', { name: 'Registrar contagem' })).toBeVisible();
  await page.getByLabel('Quantidade').fill(quantity);
  await page.getByLabel('Lote').fill(lot);
  await page.getByRole('button', { name: 'Salvar contagem' }).click();
  await expect(page.getByText(progress)).toBeVisible();
}

async function finalizeCount(page) {
  await page.getByRole('button', { name: 'Finalizar contagem' }).click();
  const dialog = page.getByRole('dialog', { name: 'Finalizar contagem' });
  await dialog.getByRole('button', { name: 'Finalizar contagem' }).click();
  await expect(page.getByText('Contagem finalizada com sucesso.')).toBeVisible();
}

test('executa recontagem parcial e finaliza a OC', async ({ page }) => {
  await loginAs(page, admin);
  await page.getByLabel('Navegação principal').getByRole('button', { name: 'Gerar OC' }).click();
  await expect(page.getByRole('heading', { name: 'Gerar ordem de contagem' })).toBeVisible();

  for (const product of ['Dipirona 500mg', 'Amoxicilina 500mg']) {
    await page.getByLabel('Buscar produto').fill(product);
    await page.getByRole('article').filter({ hasText: product }).getByRole('button', { name: 'Adicionar' }).click();
  }
  await page.getByLabel('Estoquista responsável').selectOption({ label: 'Estoquista E2E Test Only' });
  const createResponse = page.waitForResponse((response) => (
    response.url().endsWith('/ocs/create-with-items') && response.request().method() === 'POST'
  ));
  await page.getByRole('form', { name: 'Gerar ordem de contagem' }).getByRole('button', { name: 'Gerar OC' }).click();
  const createdOc = await (await createResponse).json();
  const ocCode = String(createdOc.id).padStart(4, '0');
  await expect(page).toHaveURL(new RegExp(`/gestor/oc/${createdOc.id}$`));
  await logout(page);

  await loginAs(page, estoquistaN1);
  await page.getByLabel('Navegação principal').getByRole('button', { name: 'Minhas OCs' }).click();
  const firstCountCard = page.getByRole('article', { name: `OC ${ocCode}` });
  await expect(firstCountCard).toBeVisible();
  await firstCountCard.getByRole('button', { name: 'Abrir OC' }).click();
  await expect(page.getByText('0 de 4 localizações contadas')).toBeVisible();
  await countLocation(page, 'Dipirona 500mg', 'A1-01-02', '61', 'E2E-R1-DIP-01', '1 de 4 localizações contadas');
  await countLocation(page, 'Dipirona 500mg', 'A1-02-01', '60', 'E2E-R1-DIP-02', '2 de 4 localizações contadas');
  await countLocation(page, 'Amoxicilina 500mg', 'B2-03-01', '50', 'E2E-R1-AMO-01', '3 de 4 localizações contadas');
  await countLocation(page, 'Amoxicilina 500mg', 'B2-04-02', '35', 'E2E-R1-AMO-02', '4 de 4 localizações contadas');
  await finalizeCount(page);
  await expect(page.getByRole('article', { name: `OC ${ocCode}` })).toHaveCount(0);
  await logout(page);

  await loginAs(page, admin);
  await page.getByLabel('Navegação principal').getByRole('button', { name: 'Aprovação' }).click();
  const approvalCard = page.getByRole('article', { name: `OC ${ocCode} aguardando aprovação` });
  await expect(approvalCard).toBeVisible();
  await approvalCard.getByRole('button', { name: 'Abrir detalhes' }).click();
  const details = page.getByRole('region', { name: `Detalhes da OC ${ocCode}` });
  await expect(details).toBeVisible();
  const detailsTable = details.getByRole('table');
  await detailsTable.getByRole('checkbox', { name: 'Selecionar Dipirona 500mg para recontagem' }).check();
  await expect(detailsTable.getByRole('checkbox', { name: 'Selecionar Amoxicilina 500mg para recontagem' })).not.toBeChecked();
  await details.getByRole('button', { name: 'Enviar para recontagem' }).click();
  const recountDialog = page.getByRole('dialog', { name: 'Enviar para recontagem' });
  await recountDialog.getByLabel('Estoquista').selectOption({ label: 'Estoquista N2 E2E Test Only - nível 2' });
  await recountDialog.getByRole('button', { name: 'Enviar' }).click();
  await expect(approvalCard).toHaveCount(0);
  await logout(page);

  await loginAs(page, estoquistaN2);
  await page.getByLabel('Navegação principal').getByRole('button', { name: 'Minhas OCs' }).click();
  const recountCard = page.getByRole('article', { name: `OC ${ocCode}` });
  await expect(recountCard).toBeVisible();
  await expect(recountCard.getByText('0 de 2 localizações contadas')).toBeVisible();
  await recountCard.getByRole('button', { name: 'Abrir OC' }).click();
  await expect(page.getByText('0 de 2 localizações contadas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Contar localização de Dipirona 500mg — A1-01-02' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Contar localização de Dipirona 500mg — A1-02-01' })).toBeVisible();
  await expect(page.getByText('Amoxicilina 500mg')).toHaveCount(0);
  await countLocation(page, 'Dipirona 500mg', 'A1-01-02', '60', 'E2E-R2-DIP-01', '1 de 2 localizações contadas');
  await countLocation(page, 'Dipirona 500mg', 'A1-02-01', '60', 'E2E-R2-DIP-02', '2 de 2 localizações contadas');
  await finalizeCount(page);
  await logout(page);

  await loginAs(page, admin);
  await page.getByLabel('Navegação principal').getByRole('button', { name: 'Aprovação' }).click();
  const finalApprovalCard = page.getByRole('article', { name: `OC ${ocCode} aguardando aprovação` });
  await expect(finalApprovalCard).toBeVisible();
  await finalApprovalCard.getByRole('button', { name: 'Aprovar' }).click();
  const approveDialog = page.getByRole('dialog', { name: 'Aprovar OC' });
  await approveDialog.getByRole('button', { name: 'Aprovar' }).click();
  await page.getByLabel('Navegação principal').getByRole('button', { name: 'Gestão de OCs' }).click();
  await page.getByLabel('Buscar').fill(ocCode);
  const finalCard = page.getByRole('article', { name: `OC ${ocCode}` });
  await expect(finalCard.getByText('Finalizada')).toBeVisible();
});
