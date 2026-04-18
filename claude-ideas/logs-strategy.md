## Contexto
Estou sentindo falta de logs na aplicação toda para dar visibilidade do uso dela, precisamos refatorar alguns pontos estratégicos da aplicação para melhorar esse ponto.

## Estratégia
Vamos segmentar os logs com tags como prefixos nas mensagens, como:
- [EVENT IN] Quando algum dispatcher é acionado, indicando que um usuário fez uma interação com o bot
- [USECASE_NAME][USE-CASE] Logs informacionais de dentro do caso de uso sobre o que esta acontecendo.
- [REPOSITORY_NAME] [REPOSITORY] Informa quando uma classe de repositório é acionada para realizar determinada ação, deve mostrar no logs também os parametros recebidos para realizar a query, seja pra consulta ou criação de registros. (Filtre dados que voce acha relevante para logar como resultado das queries de consulta de dados)
- [EVENT OUT] Identificar quando uma resposta do bot é enviada de volta para o usuário.imple