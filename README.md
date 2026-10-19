# Plano_carga Itom

Crie um sistema web (online) de passagem de turno e registro operacional para uma equipe de operações que monitora jobs SAP. Hoje o processo é feito em uma planilha com várias guias, enviada a cada troca de turno para a outra equipe. O sistema deve substituir essa planilha. Nesta primeira versão, implemente SOMENTE a guia "Recados e Intervenções" (as demais guias virão depois, então deixe a estrutura de abas e o banco preparados para recebê-las: "Outros Recados", "Tarefas do Dia" e "Monitoramento de Jobs").

CONTEXTO
- A equipe trabalha em 3 turnos: Manhã (07:00-15:00), Tarde (15:00-23:00) e Noite (23:00-07:00, atravessa a meia-noite; o turno pertence à data em que começou).
- A cada início de turno, a planilha é enviada para a outra equipe, que marca quem está no turno e a data, e vê se já existe algo registrado para aquele turno.
- O sistema deve eliminar o envio da planilha: todos acessam o mesmo link online.

SEM LOGIN (nesta versão)
- Não haverá autenticação. Qualquer pessoa com o link acessa e edita.
- Sempre que alguém criar ou alterar um item, deve escolher seu nome numa lista de membros cadastrados (com opção de digitar um nome novo). O nome e o horário ficam registrados no item (criado por, alterado por, quando).
- Estruture o código para que seja fácil adicionar login depois.

TELA: GUIA "RECADOS E INTERVENÇÕES"

1. Cabeçalho do turno
   - Data do turno e turno (Manhã/Tarde/Noite), sugeridos automaticamente pelo horário atual, mas editáveis, com navegação para turno anterior e próximo.
   - Equipe em turno: campo de múltiplos nomes (tags) para marcar quem está no turno. Cadastro simples de membros da equipe.
   - Indicador visível de "já existe algo para este turno", com contagem de recados e de intervenções planejadas.

2. Seção "Recados"
   - Lista de recados do turno. Um novo recado é adicionado sempre que acontece algo importante.
   - Campos: data/hora, texto do recado, autor, destaque de importância (normal/importante) e status (aberto/resolvido).
   - Recados em aberto devem aparecer automaticamente nos turnos seguintes, com destaque visual, até serem marcados como resolvidos.

3. Seção "Intervenções planejadas" (tabela editável, estilo planilha)
   Colunas:
   - Tipo (lista editável de opções, ex.: Deploy, Manutenção, Transporte, Reinício, Outros)
   - Cliente
   - Data
   - Ticket
   - Início
   - Fim previsto
   - E-mail (assunto)
   - Quem enviou
   - Data e hora do envio
   - Observações
   Regras:
   - Intervenções podem ser cadastradas antecipadamente para datas/turnos futuros e aparecem automaticamente no turno correspondente (com base na data e no horário de início).
   - Intervenção que atravessa turnos (início em um turno e fim em outro) deve aparecer em todos os turnos afetados.
   - Status opcional: planejada, em andamento, concluída, cancelada, com destaque de cor.
   - Adicionar, editar, duplicar e excluir linhas; ordenação e filtro por tipo, cliente e ticket.

4. Histórico e exportação
   - Busca por data, turno, cliente, ticket, pessoa ou palavra-chave.
   - Exportação para Excel (.xlsx) do turno ou de um período.

5. Atualização em tempo real
   - Se duas pessoas estiverem no mesmo turno, as alterações de uma aparecem para a outra sem recarregar a página.

REQUISITOS NÃO FUNCIONAIS
- Interface simples e rápida, parecida com a planilha (abas no topo, tabela editável), responsiva para desktop e celular.
- Tratamento correto de fuso horário (America/Sao_Paulo) e do turno da noite.
- Idioma: português do Brasil.
- Auditoria básica: quem criou/alterou e quando.

STACK
[defina: ex. React + Node.js + PostgreSQL, ou deixe livre]

ENTREGA
Modelo do banco de dados (turnos, membros, presença no turno, recados, intervenções, tipos), telas principais, código completo e instruções para rodar e publicar.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://planocarga-itom.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/18911472-3b9e-43bb-a10b-376b3afb03e4).

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
