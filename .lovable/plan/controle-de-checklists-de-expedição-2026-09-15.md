# Controle de Checklists de Expedição

## 1. Estrutura identificada nas bases

### Base 1 — Notas Fiscais (`matr550.xlsx`, 130 linhas)
Colunas: `Num. Docto.`, `No do Pedido`, `Serie`, `DT Emissao`, `Hora`, `Quantidade`, `Valor Mercadoria`, `Transp.`, `Volume 1`, `Peso Liquido`, `Carga`, `Cliente`, `Loja`, `Tipo de fret`, `UF Destino`, `Estado`, `Nova formula`

Campos usados:
- **NF/documento** → `Num. Docto.` (ex.: 37657 a 37786)
- **Carga** → `Carga` (ex.: 5135, 5136...). Vazia em 52 das 130 linhas
- **Data da NF** → `DT Emissao` (+ `Hora`)
- Complementares exibidos no detalhe: cliente, transportadora, UF, volumes, peso, valor

Na amostra: 130 NFs → 78 com carga (13 cargas distintas) + 52 sem carga = **65 checklists esperados**.

### Base 2 — Checklists (`checklist_historic_1.xlsx`, 4.730 linhas)
Colunas: `Checklist`, `Unidade`, `Objeto`, `Roteiro`, `Localidade`, `Criado em`, `Executor`, `Finalizado em`, `Status`

Campos usados:
- **Identificador do checklist** → `Objeto` (é onde vem o número da carga ou da NF)
- **Conferente** → `Executor`
- **Data + horário de finalização** → `Finalizado em` (`15/09/2026 - 12:57:28`)
- **Abertura** → `Criado em` (permite calcular tempo de execução)
- **Status** → `Execução finalizada` (4.710), `Cancelado` (19), `Pendente` (1)
- **Roteiro** → separa Expedição (F-017, 4.028) de Descarga (F-019) e Pallets (F-141)

## 2. Como será feito o cruzamento

O campo `Objeto` vem "sujo": `37849`, `037844`, `37843 CASSIO`, `005166 GABRIEL`, `5161 WELITON`, às vezes uma data (`14092026`).

Normalização aplicada nos dois lados:
1. extrair o primeiro bloco numérico do texto;
2. remover zeros à esquerda;
3. comparar como string.

Chave única do checklist esperado:
- `Carga` preenchida → `TIPO = CARGA`, `CHAVE = nº da carga` (todas as NFs da carga agrupadas em 1 checklist);
- `Carga` vazia → `TIPO = NF`, `CHAVE = nº do documento`.

Cada checklist esperado guarda a lista de NFs que o compõem, então nada é contado em duplicidade.

Do lado dos realizados: apenas `Status = Execução finalizada`, roteiro de expedição (F-017) por padrão — filtro ajustável. Havendo mais de um checklist para a mesma chave, vale o de finalização mais antiga.

Validação na amostra: **45 das 65 chaves** encontraram checklist correspondente; 20 ficam pendentes.

## 3. Telas

1. **Atualizar Bases** — upload de Excel ou colagem de dados para cada base, pré-visualização com as colunas detectadas (mapeamento editável), botão **Processar Bases** e escolha da data de referência.
2. **Painel do dia** — esperados, realizados, pendentes, % de aderência, novas pendências, pendências antigas, resolvidas e saldo acumulado.
3. **Pendências** — lista com chave, tipo, NFs, data da NF, dias em aberto, cliente/transportadora; filtros e exportação para Excel.
4. **Produtividade** — ranking de conferentes, total, média diária, participação, evolução no tempo, tempo médio de execução.
5. **Análise por horário** — distribuição por hora e por faixa/turno, dia da semana, mapa de calor hora × dia.
6. **Histórico** — série diária de esperados/realizados/saldo com gráfico de evolução.

## 4. Regra do acumulado

Cada chave pendente vira um registro aberto com a data de origem. A cada processamento:
- chave esperada nova sem checklist → **nova pendência**;
- pendência aberta que agora tem checklist → **resolvida** (guarda data e conferente);
- pendência aberta sem checklist → **antiga** (não é recontada);
- `saldo = saldo anterior + novas − resolvidas`.

## 5. Técnico

- Lovable Cloud (banco) com tabelas: `importacoes`, `checklists_esperados` (chave, tipo, nfs, data_nf, status, data_realizacao, conferente), `pendencias_abertas`, `resumo_diario`, `checklists_realizados`.
- Leitura de Excel no navegador com SheetJS; processamento e gravação via server functions.
- Reprocessar a mesma data substitui o registro daquele dia sem perder o histórico anterior.
- Idioma pt-BR, datas dd/mm/aaaa, visual limpo em tons de azul/ardósia com foco em tabelas e indicadores.
