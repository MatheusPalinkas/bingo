# 🎱 Bingo

Aplicação web para conduzir sorteios de bingo (75 bolas, padrão B·I·N·G·O). Marque as pedras sorteadas num painel visual, acompanhe a última pedra em destaque e consulte o histórico de partidas. Ideal para projetar numa tela durante o jogo. 📺

Construída com Angular 21 (standalone components, signals e controle de fluxo `@if`/`@for`), sem backend: todo o estado é persistido no `localStorage` do navegador.

🔗 **Acesse a versão publicada:** https://matheuspalinkas.github.io/bingo/

## ✨ Funcionalidades

- 🔢 **Painel B·I·N·G·O** com as 75 pedras organizadas por letra (letras na lateral esquerda). Clique numa pedra para marcá-la ou desmarcá-la.
- 🎯 **Pedra atual** em destaque, mostrando a última bola sorteada.
- 🕔 **Últimas pedras**: as 5 bolas mais recentes, com a atual destacada.
- 🎮 **Gerenciamento de partidas**: iniciar novo jogo, finalizar, reabrir e remover. Só existe uma partida em andamento por vez.
- 📜 **Histórico**: lista todas as partidas com data, status e as pedras na ordem em que foram sorteadas. Permite reabrir ou remover (com confirmação em dois passos).
- 🪟 **Destacar painel em outra janela** (Document Picture-in-Picture): abre o painel numa janela flutuante sempre-visível. Enquanto destacado, a tela principal esconde o painel e amplia a "Pedra atual". Requer navegador compatível (Chrome/Edge recentes).
- 🌗 **Tema claro/escuro**: alternância manual com persistência; usa a preferência do sistema como padrão inicial.
- 💾 **Persistência local**: partidas e tema ficam salvos no `localStorage`.

## 📁 Estrutura do projeto

```
src/
├── app/
│   ├── app.ts / app.html / app.config.ts / app.routes.ts
│   ├── models/
│   │   └── game.model.ts          # Tipos Game, BingoBall, BingoLetter, GameStatus
│   ├── pages/
│   │   ├── board/                 # Painel principal do sorteio (rota "/")
│   │   └── history/               # Histórico de partidas (rota "/historico")
│   └── services/
│       ├── bingo.ts               # Estado das partidas e regras do jogo
│       ├── theme.ts               # Tema claro/escuro
│       └── storage.ts             # Helpers de localStorage + STORAGE_KEYS
├── styles.css                     # Tema global (paleta de azul, claro/escuro)
├── index.html
└── main.ts
```

### 🧭 Rotas

| Caminho       | Página            |
| ------------- | ----------------- |
| `/`           | Painel do sorteio |
| `/historico`  | Histórico         |
| `**`          | Redireciona para `/` |

### 🗃️ Camada de dados

- `BingoService` (`providedIn: 'root'`) mantém as partidas num signal, expõe `currentGame` como `computed` e persiste cada alteração. As operações (`startNewGame`, `toggleNumber`, `finishGame`, `reopenGame`, `deleteGame`) trabalham de forma imutável.
- `ThemeService` controla o atributo `data-theme` no `<html>` e persiste a escolha.
- `storage.ts` centraliza leitura/escrita no `localStorage` (`readStorage`/`writeStorage`/`removeStorage`) e as chaves em `STORAGE_KEYS`.

Chaves de armazenamento usadas:

- `bingo:games:v1` — partidas
- `bingo:theme:v1` — tema

## 📋 Pré-requisitos

- Node.js (versão compatível com Angular 21)
- npm 11+

## 🚀 Como rodar

Instale as dependências:

```bash
npm install
```

🧑‍💻 Servidor de desenvolvimento (abre em `http://localhost:4200/` e recarrega ao salvar):

```bash
npm start
```

📦 Build de produção (artefatos em `dist/`):

```bash
npm run build
```

👀 Build em modo watch (desenvolvimento):

```bash
npm run watch
```

## 🧪 Testes

Testes unitários com [Vitest](https://vitest.dev/):

```bash
npm test
```

## ⚠️ Notas de compatibilidade

- 🪟 O recurso de **destacar o painel em outra janela** depende da Document Picture-in-Picture API, disponível em Chrome/Edge recentes. Em navegadores sem suporte, o botão fica oculto.
- 🎨 A aplicação usa apenas uma paleta de azul, com variantes para os temas claro e escuro definidas via variáveis CSS em `src/styles.css`.

## 📄 Licença

Projeto pessoal, sem licença definida.
