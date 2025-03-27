# Listai - Gerenciador de Estoque

Um aplicativo React Native para gerenciamento de estoque com funcionalidades de adição, remoção e edição de produtos, incluindo controle de quantidade e peso.

## Funcionalidades

- Adicionar novos produtos com nome, quantidade e peso
- Visualizar lista de produtos
- Editar quantidade e peso dos produtos
- Remover produtos
- Interface em português
- Armazenamento local com SQLite

## Requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn
- Expo CLI
- Expo Go app no dispositivo móvel

## Instalação

1. Clone o repositório:
```bash
git clone [URL_DO_REPOSITÓRIO]
cd Listai
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o aplicativo:
```bash
npm start
```

4. Use o aplicativo Expo Go no seu dispositivo móvel para escanear o QR code que aparece no terminal.

## Como Usar

1. **Adicionar Produto**
   - Toque no botão "+" na tela inicial
   - Preencha o nome do produto
   - Digite a quantidade inicial
   - Digite o peso em gramas
   - Toque em "Adicionar Produto"

2. **Editar Produto**
   - Na tela inicial, use os botões "+" e "-" para ajustar a quantidade
   - Use os botões "+" e "-" para ajustar o peso (em incrementos de 10g)
   - As alterações são salvas automaticamente

3. **Remover Produto**
   - Toque no ícone de lixeira ao lado do nome do produto
   - Confirme a remoção

## Tecnologias Utilizadas

- React Native
- TypeScript
- Expo
- SQLite
- React Navigation
- React Native Paper

## Estrutura do Projeto

```
Listai/
├── src/
│   ├── database/
│   │   └── database.ts
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── AddProductScreen.tsx
│   │   └── EditProductScreen.tsx
│   └── types/
│       └── navigation.ts
├── App.tsx
└── README.md
```

## Contribuição

Contribuições são bem-vindas! Por favor, sinta-se à vontade para submeter pull requests.

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.
