# Subly — Instruções do projeto

> Colocar em `.github/copilot-instructions.md`. O Copilot lê este ficheiro em todas
> as sessões. Substitui integralmente o prompt que gerou o PR #1.

## O que o Subly é

Aplicação web que analisa extratos bancários portugueses **localmente no browser**,
identifica subscrições e despesas recorrentes, e diz ao utilizador **como cancelar
cada uma** em Portugal.

## O que o Subly não é (importante)

Não é um agregador bancário. Não liga a bancos. Não tem contas de utilizador. Não
tem servidor que processe dados financeiros. O Revolut já faz gestão genérica de
subscrições — a nossa diferença é conhecimento de fornecedores portugueses e
privacidade real, não a lista de subscrições em si.

## Regra de arquitetura número um

**Nenhum dado financeiro sai do dispositivo do utilizador.**

- Parsing, normalização, deteção e armazenamento correm no cliente.
- Persistência em IndexedDB. Nunca `localStorage` para dados de transações.
- O único endpoint de rede permitido no MVP é o formulário de waitlist da landing,
que recebe apenas um email.
- Não criar rotas de API que aceitem transações, extratos ou ficheiros.
- Se uma tarefa parecer exigir backend, parar e perguntar em vez de o construir.

Esta regra existe porque é simultaneamente a promessa de marketing, a estratégia
de conformidade RGPD e a razão pela qual não temos multi-tenancy para estragar.

## Stack

- TypeScript em todo o lado, `strict: true`. Sem `any` sem comentário a justificar.
- React com componentes funcionais e hooks. Sem classes.
- Vite. Vitest para testes.
- `pdfjs-dist` para PDF, no cliente.
- `idb` para IndexedDB.
- Sem PostgreSQL, sem Express, sem Prisma, sem ORM, sem Docker no MVP.

## Estrutura

```
packages/core/      lógica de domínio pura — sem React, sem DOM, sem I/O
  tipos.ts
  normalizar/       limpeza de descritivos bancários
  detetar/          motor de recorrência
  dados/            merchants.pt.json + carregador
  __fixtures__/     extratos anonimizados + resultados esperados
apps/web/           interface React
apps/landing/       landing estática + páginas "como cancelar"
```

`packages/core` não importa nada de `apps/`. Se uma função precisa do `window`,
não pertence ao core.

## Idioma

- Todo o texto visível ao utilizador em **português de Portugal**.
Utilizador, ecrã, ficheiro, telemóvel, aplicação, subscrição, comerciante.
Nunca usuário, tela, arquivo, celular, aplicativo, assinatura.
- Código, nomes de variáveis, comentários e mensagens de commit em **inglês**.
- Datas e moeda com `Intl` e locale `pt-PT`. Nunca formatar à mão.

## Marca

Definir uma vez em `apps/web/src/tokens.css` e consumir só por variável:

```
:root {
  --subly-green: #39ff14;
  --subly-black: #0a0a0a;
  --subly-surface: #141414;
  --subly-text: #f2f2f2;
  --subly-text-muted: #a1a1a1;
}
```

Nunca escrever valores de cor diretamente em componentes.

O verde é **cor de acento**: CTAs, estados ativos, uma série de gráfico, destaques
pontuais. Nunca em texto corrido, nunca como fundo de área grande — o contraste
com o preto é tão alto que causa fadiga visual. Texto normal usa `--subly-text`.

Mobile-first. Sem service worker nem manifesto PWA no MVP.

## Qualidade da deteção

O motor tem de ser avaliado, não apenas testado.

- Fixtures em `packages/core/__fixtures__/`: transações anonimizadas + ficheiro de
deteções esperadas.
- `npm run eval` imprime precisão e cobertura por fixture.
- Qualquer PR que toque em normalização ou deteção mostra o resultado do `eval`
antes e depois na descrição.
- Nunca baixar o limiar de confiança para melhorar a métrica. Se a deteção falha,
o dicionário está incompleto — corrigir o dicionário.

## Dicionário de comerciantes

`merchants.pt.json` é o activo central do produto. Cada entrada com informação de
cancelamento precisa de `fonte` (URL) e `verificadoEm` (data ISO). Informação
errada sobre prazos legais ou penalizações é pior do que ausência de informação —
na dúvida, deixar o campo vazio e marcar `porVerificar: true`.

Nunca inventar números de telefone, moradas, prazos de pré-aviso ou valores de
penalização. Se não houver fonte, o campo fica por preencher.

## Curadoria do dicionário

`merchants.pt.json` só é alterado em PRs dedicados a essa tarefa, nunca como
parte de um PR sobre o motor de deteção, normalização, UI, ou qualquer outra
coisa. Se uma tarefa parecer exigir uma nova entrada no dicionário, parar e
perguntar em vez de a adicionar — os dados de cancelamento vêm de um processo
de verificação humana à parte.

## Âmbito — fora do MVP

Não implementar, nem sequer preparar terreno, sem instrução explícita:

autenticação · login social · base de dados · Open Banking / PSD2 / AISP ·
modo família · notificações push · email transacional · planos pagos ou pagamentos ·
service worker · analytics de terceiros nas páginas que tocam em dados financeiros.

Não criar tabelas, tipos ou pastas para funcionalidades futuras. Não adicionar
dependências fora das listadas sem justificar na descrição do PR.

## Transparência de decisões

Quando uma tarefa exigir uma escolha que não foi especificada
explicitamente no prompt — renomear um campo, remapear um `id`,
reordenar dados, alterar um tipo para o código compilar — essa escolha
tem de ser reportada explicitamente na descrição do PR, mesmo que
pareça óbvia ou de baixo risco. Nunca reportar apenas "Concluído" sem
listar decisões não pedidas que foram tomadas pelo caminho.

## Estilo de trabalho

- Um PR por tarefa. Se a tarefa parecer dar mais de ~400 linhas de diff, dividir e
perguntar primeiro.
- Testes na mesma alteração que o código.
- Preferir funções puras e ficheiros de dados a abstrações. Este projeto vive de um
dicionário bem curado, não de padrões de arquitetura.
- Quando os requisitos forem ambíguos, escrever a pergunta na descrição do PR em
vez de adivinhar.
