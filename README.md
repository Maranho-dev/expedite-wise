# Logistics Checkmate

Quero desenvolver uma aplicação web para controle e acompanhamento dos Checklists de Expedição da área de Logística.

A aplicação deverá permitir que o usuário atualize diariamente duas bases e, a partir delas, faça automaticamente o cruzamento dos dados, identifique checklists realizados e pendentes, acompanhe o acumulado de pendências e analise a produtividade dos conferentes.

1. PRIMEIRO PASSO — ANALISAR AS BASES

Antes de criar a aplicação, analise os dois arquivos Excel que estou fornecendo:

Base de Notas Fiscais emitidas

Base de Checklists realizados

Não assuma nomes de colunas.

Identifique automaticamente:

Coluna de NF

Coluna de carga

Coluna/documento utilizado para identificar o checklist

Data da NF

Data de realização/finalização do checklist

Horário de finalização

Nome do conferente

Demais campos relevantes para o cruzamento

Apresente a estrutura identificada e explique como pretende realizar o cruzamento antes de aplicar a lógica definitiva.

2. OBJETIVO DA APLICAÇÃO

A aplicação deve responder diariamente:

Quantos checklists deveriam ter sido realizados?

Quantos foram realizados?

Quantos estão pendentes?

Quais estão pendentes?

Quais pendências são antigas?

Qual é o acumulado de pendências?

Como está a produtividade de cada conferente?

3. REGRA DE IDENTIFICAÇÃO DOS CHECKLISTS

Existem dois cenários.

CENÁRIO A — NF possui carga

Quando uma NF possuir uma carga, o checklist deverá ser identificado pelo número da carga.

Uma carga pode possuir diversas NFs.

Exemplo:

Carga 12345:

NF 1001
NF 1002
NF 1003
NF 1004

Isso representa:

4 NFs
1 carga
1 checklist esperado

Portanto:

NUNCA contabilizar cada NF como um checklist quando elas pertencem à mesma carga.

A chave de controle nesse cenário será:

CARGA

CENÁRIO B — NF não possui carga

Quando uma NF não possuir carga, o checklist de saída será identificado pelo número da própria NF/documento.

Exemplo:

NF 2001 → 1 checklist
NF 2002 → 1 checklist
NF 2003 → 1 checklist

Resultado:

3 NFs = 3 checklists esperados.

A chave de controle nesse cenário será:

NF/DOCUMENTO

4. CRIAÇÃO DA CHAVE ÚNICA

Criar uma chave única para cada checklist esperado.

Regra:

SE possuir carga:

TIPO = CARGA
CHAVE = número da carga

SE não possuir carga:

TIPO = NF
CHAVE = número da NF/documento

Essa chave será utilizada para cruzar a base de NFs com a base de checklists.

Evitar duplicidades.

5. CRUZAMENTO

Para cada checklist esperado, verificar se existe correspondente na base de checklists realizados.

Resultado:

REALIZADO

Quando existir um checklist correspondente.

PENDENTE

Quando não existir checklist correspondente.

A aplicação deve manter a relação entre:

NF

Carga

Checklist

Data

Conferente

Status

6. ATUALIZAÇÃO DIÁRIA

A aplicação deverá ter uma tela chamada:

"Atualizar Bases"

Nessa tela o usuário poderá:

BASE 1 — NOTAS FISCAIS

Fazer upload de um arquivo Excel ou colar os dados.

BASE 2 — CHECKLISTS

Fazer upload de um arquivo Excel ou colar os dados.

Adicionar botão:

PROCESSAR BASES

Após o processamento:

Ler as duas bases

Identificar as colunas

Criar a chave dos checklists

Eliminar duplicidades conforme as regras

Cruzar as bases

Classificar Realizado/Pendente

Atualizar os indicadores

Registrar o resultado daquele dia no histórico

7. HISTÓRICO

A aplicação NÃO deve simplesmente substituir os dados do dia anterior.

Precisamos manter um histórico diário.

Criar uma estrutura de dados para armazenar:

Data de referência

Checklists esperados

Checklists realizados

Novas pendências

Pendências antigas

Pendências resolvidas

Saldo de pendências

Produtividade dos conferentes

Isso permitirá visualizar a evolução ao longo do tempo.

8. ACUMULADO DE PENDÊNCIAS

Essa é uma das partes mais importantes da aplicação.

O sistema precisa diferenciar:

NOVAS PENDÊNCIAS

Checklists esperados naquele dia que não foram realizados.

PENDÊNCIAS ANTIGAS

Checklists que já estavam pendentes de dias anteriores e continuam sem realização.

PENDÊNCIAS RESOLVIDAS

Checklists que estavam pendentes e foram realizados posteriormente.

SALDO ACUMULADO

Quantidade de pendências que continuam abertas.

Exemplo:

Dia 01

10 esperados
8 realizados
2 novos pendentes

Saldo acumulado = 2

Dia 02

15 esperados
13 realizados
2 novos pendentes

Se os 2 pendentes do Dia 01 continuarem abertos:

Saldo acumulado = 4

Dia 03

12 esperados
12 realizados
0 novas pendências

Se as 4 anteriores continuarem abertas:

Saldo acumulado = 4

Se no Dia 03 forem resolvidas 2 pendências antigas:

Saldo acumulado = 2

A fórmula conceitual deve ser:

Saldo anterior + novas pendências - pendências resolvidas

Não contar novamente uma mesma pendência apenas porque ela continua aberta.

9. PRODUTIVIDADE DOS CONFERENTES

Utilizar a base de checklists para criar uma análise de produtividade.

Cada checklist realizado possui:

Nome do conferente

Data de finalização

Horário de finalização

Criar indicadores por conferente:

Quantidade de checklists realizados

Média diária

Participação no total

Evolução ao longo do tempo

Quantidade por dia

Quantidade por hora/período

Criar um ranking de produtividade.

Importante:

A produtividade deve considerar apenas checklists efetivamente realizados.

10. ANÁLISE POR HORÁRIO

Utilizar o horário de f

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://expedite-wise.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/434c29bf-bc09-4e2f-bb4a-db3fb3f9f62f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
