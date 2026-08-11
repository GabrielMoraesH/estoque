const fs = require('fs');
const path = require('path');

describe('migration 010 contagens sem item legado', () => {
  let sql;

  beforeAll(() => {
    sql = fs.readFileSync(
      path.join(__dirname, '..', '..', 'migrations', '010_allow_new_model_counts_without_legacy_item.sql'),
      'utf8'
    );
  });

  it('permite item_id nulo e preserva integridade minima de referencia', () => {
    expect(sql).toContain('ALTER COLUMN item_id DROP NOT NULL');
    expect(sql).toContain('contagens_valid_reference_check');
    expect(sql).toMatch(/item_id\s+IS\s+NOT\s+NULL/i);
    expect(sql).toMatch(/oc_produto_id\s+IS\s+NOT\s+NULL/i);
    expect(sql).toMatch(/oc_localizacao_id\s+IS\s+NOT\s+NULL/i);
    expect(sql).toMatch(/assignment_id\s+IS\s+NOT\s+NULL/i);
  });

  it('amarra contagens novas a entidades consistentes de OC e produto', () => {
    expect(sql).toContain('oc_localizacoes_id_oc_produto_id_unique');
    expect(sql).toContain('contagens_assignment_oc_fk');
    expect(sql).toContain('FOREIGN KEY (assignment_id, oc_id)');
    expect(sql).toContain('contagens_produto_oc_fk');
    expect(sql).toContain('FOREIGN KEY (oc_produto_id, oc_id)');
    expect(sql).toContain('contagens_localizacao_produto_fk');
    expect(sql).toContain('FOREIGN KEY (oc_localizacao_id, oc_produto_id)');
  });
});
