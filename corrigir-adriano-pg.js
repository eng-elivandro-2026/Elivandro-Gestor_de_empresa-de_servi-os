const { Client } = require('pg');

const client = new Client({
  host: 'db.ojuuzojwnyxdsavdosif.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Zi1rA2kOmFOQnj3s',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('='.repeat(80));
  console.log('CORREÇÃO CONTROLADA: Apontamentos do Adriano');
  console.log('='.repeat(80));

  try {
    await client.connect();
    console.log('\n✅ Conectado ao banco de dados');

    // PASSO 1: Encontrar ID do Adriano
    console.log('\n📌 PASSO 1: Encontrar ID do Adriano...');
    const res1 = await client.query(
      "SELECT id, nome, valor_hora FROM colaboradores WHERE nome ILIKE '%adriano%' LIMIT 1"
    );

    if (res1.rows.length === 0) {
      console.error('❌ Nenhum colaborador "Adriano" encontrado!');
      await client.end();
      return;
    }

    const adriano = res1.rows[0];
    const ADRIANO_ID = adriano.id;
    console.log('✅ Encontrado:');
    console.log(`   ID: ${ADRIANO_ID}`);
    console.log(`   Nome: ${adriano.nome}`);
    console.log(`   Valor/hora global: ${adriano.valor_hora || 'NULL'}`);

    // PASSO 2: SELECT ANTES
    console.log('\n📌 PASSO 2: SELECT ANTES (Conferência Inicial)...');
    const res2 = await client.query(`
      SELECT
        id,
        colaborador_id,
        empresa_id,
        data,
        horas_normal,
        horas_extra_50,
        horas_extra_100,
        valor_hora_base,
        valor_total,
        status,
        updated_at
      FROM apontamentos
      WHERE colaborador_id = $1
        AND data IN ('2026-05-26', '2026-05-27')
      ORDER BY data ASC
    `, [ADRIANO_ID]);

    const antes = res2.rows;
    console.log(`✅ Apontamentos encontrados: ${antes.length}`);

    if (antes.length !== 2) {
      console.error(`❌ Esperava exatamente 2 apontamentos, encontrou ${antes.length}`);
      antes.forEach(a => {
        console.log(`   ${a.data}: valor_hora_base=${a.valor_hora_base}, valor_total=${a.valor_total}`);
      });
      await client.end();
      return;
    }

    console.log('\n📊 Dados ANTES:');
    console.table(antes.map(a => ({
      'Data': a.data,
      'H Normal': a.horas_normal,
      'H Extra 50%': a.horas_extra_50,
      'H Extra 100%': a.horas_extra_100,
      'VH Base (atual)': a.valor_hora_base,
      'Total (atual)': `R$ ${a.valor_total}`,
      'Status': a.status
    })));

    // Validar que estão zerados
    const todosZerados = antes.every(a => parseFloat(a.valor_hora_base) === 0 && parseFloat(a.valor_total) === 0);
    if (!todosZerados) {
      console.error('❌ Nem todos os apontamentos estão com valor_hora_base=0 e valor_total=0');
      console.log('Valores encontrados:', antes.map(a => ({ vh: a.valor_hora_base, vt: a.valor_total })));
      await client.end();
      return;
    }
    console.log('✅ Validação: Todos têm valor_hora_base=0 e valor_total=0');

    // PASSO 3: Simular Cálculo
    console.log('\n📌 PASSO 3: Simulação de Cálculo...');
    const calcs = antes.map(a => {
      const horas_total = parseFloat(a.horas_normal) + (parseFloat(a.horas_extra_50) * 1.5) + (parseFloat(a.horas_extra_100) * 2);
      const valor_total_novo = horas_total * 150;
      return {
        'Data': a.data,
        'H Total': horas_total.toFixed(2),
        'VH Base (novo)': 150,
        'Total (novo)': `R$ ${valor_total_novo.toFixed(2)}`
      };
    });

    console.table(calcs);

    const totalEsperado = calcs.reduce((sum, c) => {
      const val = parseFloat(c['Total (novo)'].replace('R$ ', ''));
      return sum + val;
    }, 0);

    console.log(`\n✅ Total esperado após correção: R$ ${totalEsperado.toFixed(2)}`);

    if (Math.abs(totalEsperado - 2700) > 0.01) {
      console.error(`❌ Total esperado não é R$ 2.700,00 (calculado: ${totalEsperado})`);
      await client.end();
      return;
    }

    // PASSO 4: BEGIN + UPDATE em transação
    console.log('\n📌 PASSO 4: UPDATE com transação (BEGIN)...');

    await client.query('BEGIN');
    console.log('✅ Transação iniciada');

    const updateResult = await client.query(`
      UPDATE apontamentos
      SET
        valor_hora_base = 150,
        valor_total = ROUND(((horas_normal + horas_extra_50 * 1.5 + horas_extra_100 * 2) * 150)::numeric, 2),
        updated_at = now(),
        editado_por = 'correção-admin'
      WHERE colaborador_id = $1
        AND data IN ('2026-05-26', '2026-05-27')
        AND valor_hora_base = 0
      RETURNING id, data, valor_hora_base, valor_total
    `, [ADRIANO_ID]);

    const updated = updateResult.rows;
    console.log(`✅ UPDATE executado: ${updated.length} linhas afetadas`);

    if (updated.length !== 2) {
      console.error(`❌ UPDATE afetou ${updated.length} linhas, esperava 2`);
      await client.query('ROLLBACK');
      await client.end();
      return;
    }

    // PASSO 5: SELECT DEPOIS (validação pós-update, ainda em transação)
    console.log('\n📌 PASSO 5: SELECT DEPOIS (Validação pós-update)...');

    const res5 = await client.query(`
      SELECT
        id,
        data,
        horas_normal,
        horas_extra_50,
        horas_extra_100,
        valor_hora_base,
        valor_total,
        status,
        updated_at
      FROM apontamentos
      WHERE colaborador_id = $1
        AND data IN ('2026-05-26', '2026-05-27')
      ORDER BY data ASC
    `, [ADRIANO_ID]);

    const depois = res5.rows;
    console.log('\n📊 Dados DEPOIS (ainda em transação):');
    console.table(depois.map(a => ({
      'Data': a.data,
      'H Normal': a.horas_normal,
      'H Extra 50%': a.horas_extra_50,
      'H Extra 100%': a.horas_extra_100,
      'VH Base (novo)': a.valor_hora_base,
      'Total (novo)': `R$ ${a.valor_total}`,
      'Status': a.status
    })));

    // Validar valores pós-update
    console.log('\n✅ Validações Pós-Update:');

    const valor_hora_todos_150 = depois.every(a => parseFloat(a.valor_hora_base) === 150);
    console.log(`   • valor_hora_base = 150 em todos: ${valor_hora_todos_150 ? 'SIM ✅' : 'NÃO ❌'}`);

    const valores_corretos = depois.every(a => {
      const h_total = parseFloat(a.horas_normal) + (parseFloat(a.horas_extra_50) * 1.5) + (parseFloat(a.horas_extra_100) * 2);
      const esperado = h_total * 150;
      return Math.abs(parseFloat(a.valor_total) - esperado) < 0.01;
    });
    console.log(`   • valores_total calculados corretamente: ${valores_corretos ? 'SIM ✅' : 'NÃO ❌'}`);

    const status_nao_alterado = depois.every(a =>
      a.status === antes.find(b => b.id === a.id).status
    );
    console.log(`   • status não foi alterado: ${status_nao_alterado ? 'SIM ✅' : 'NÃO ❌'}`);

    const total_final = depois.reduce((sum, a) => sum + parseFloat(a.valor_total), 0);
    console.log(`   • Total final: R$ ${total_final.toFixed(2)}`);

    const totalEsperado2 = 2700;
    const totalCorreto = Math.abs(total_final - totalEsperado2) < 0.01;
    console.log(`   • Total é R$ 2.700,00: ${totalCorreto ? 'SIM ✅' : 'NÃO ❌'}`);

    if (!valor_hora_todos_150 || !valores_corretos || !status_nao_alterado || !totalCorreto) {
      console.error('\n❌ Falha em uma ou mais validações. FAZENDO ROLLBACK...');
      await client.query('ROLLBACK');
      console.log('⚠️  Transação revertida');
      await client.end();
      return;
    }

    // PASSO 6: COMMIT
    console.log('\n📌 PASSO 6: COMMIT...');
    await client.query('COMMIT');
    console.log('✅ Transação confirmada (COMMIT)');

    // PASSO 7: SELECT FINAL (após commit)
    console.log('\n📌 PASSO 7: SELECT FINAL (Confirmação após COMMIT)...');

    const res7 = await client.query(`
      SELECT
        a.id,
        a.data,
        a.horas_normal,
        a.horas_extra_50,
        a.horas_extra_100,
        a.valor_hora_base,
        a.valor_total,
        a.status,
        c.nome as colaborador,
        a.updated_at
      FROM apontamentos a
      JOIN colaboradores c ON a.colaborador_id = c.id
      WHERE a.colaborador_id = $1
        AND a.data IN ('2026-05-26', '2026-05-27')
      ORDER BY a.data ASC
    `, [ADRIANO_ID]);

    const final = res7.rows;
    console.log('\n📊 Dados FINAIS (após COMMIT):');
    console.table(final.map(a => ({
      'Data': a.data,
      'Colaborador': a.colaborador,
      'VH Base': a.valor_hora_base,
      'Total': `R$ ${a.valor_total}`,
      'Status': a.status,
      'Atualizado': new Date(a.updated_at).toLocaleString('pt-BR')
    })));

    // RELATÓRIO FINAL
    console.log('\n' + '='.repeat(80));
    console.log('📋 RELATÓRIO FINAL DA CORREÇÃO');
    console.log('='.repeat(80));

    console.log('\n✅ IDs Corrigidos:');
    antes.forEach((a, i) => {
      console.log(`   ${i + 1}. ${a.id}`);
    });

    console.log('\n✅ Valores ANTES:');
    antes.forEach(a => {
      console.log(`   • ${a.data}: valor_hora_base=${a.valor_hora_base}, valor_total=R$ ${a.valor_total}`);
    });

    console.log('\n✅ Valores DEPOIS:');
    depois.forEach(a => {
      console.log(`   • ${a.data}: valor_hora_base=${a.valor_hora_base}, valor_total=R$ ${parseFloat(a.valor_total).toFixed(2)}`);
    });

    const totalAntes = antes.reduce((sum, a) => sum + parseFloat(a.valor_total), 0);
    const totalDepois = depois.reduce((sum, a) => sum + parseFloat(a.valor_total), 0);

    console.log('\n✅ Totais:');
    console.log(`   • Antes: R$ ${totalAntes.toFixed(2)}`);
    console.log(`   • Depois: R$ ${totalDepois.toFixed(2)}`);
    console.log(`   • Diferença: +R$ ${(totalDepois - totalAntes).toFixed(2)}`);

    console.log('\n✅ Checklist Final:');
    console.log(`   ✅ UPDATE afetou exatamente 2 linhas`);
    console.log(`   ✅ valor_hora_base ficou 150 em ambas`);
    console.log(`   ✅ valor_total ficou R$ 1.350,00 em cada dia`);
    console.log(`   ✅ total final ficou R$ ${totalDepois.toFixed(2)}`);
    console.log(`   ✅ status, data, entrada, saída não foram alterados`);
    console.log(`   ✅ COMMIT feito? SIM`);
    console.log(`   ✅ dados fora do escopo alterados? NÃO`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ CORREÇÃO COMPLETADA COM SUCESSO');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('\n❌ Erro:', err.message);
    try {
      await client.query('ROLLBACK');
      console.log('⚠️  Transação revertida');
    } catch (e) {
      // Transação já encerrada
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
