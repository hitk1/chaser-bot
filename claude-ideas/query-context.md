## Contexto

Eu quero acrescentar 2 novas ações como "slash-actions". Das quais serão responsabilidade distintas claras.

### /Wiki - slash action
Esta opção será responsável por interpretar a pergunta/dúvida do usuário e pesquisar diretamente na web na Wiki do GrandChase, através da API: `https://grandchase.fandom.com/api.php` ou do site mesmo `https://grandchase.fandom.com` para consultar as dúvidas relacionadas ao que já esta documentado nesta wiki sobre o jogo.

### /Wiki - Priming prompt e guardrails
É de extrema importância que haja um priming prompt ou system prompt para este cenário, do qual mantenha a resposta firme ao contexto da wiki. A LLM não deverá gerar resposta de seu conhecimento sobre o assunto, ela deverá usar o resultado da pesquisa na WIKI como fonte principal para estruturar a resposta e usar seu conhecimento local para complementar caso seja necessário.


### /Ask - slash action
Esta opção já existe hoje no bot e é uma opção mais genérica para gerar as respostas. Preciso que seu fluxo seja refatorado para dar prioridade para buscar na web conteúdos sobre o tópico acionado pelo usuário. Usar fonte como: Reddit-Grand Chase classic (https://www.reddit.com/r/Grandchase/) usar também o próprio "FANDOM de grand chase (ex: https://grandchase.fandom.com/pt-br/wiki/Especial:Todas_as_p%C3%A1ginas)

### /Ask - priming prompt e guardrails
Seguindo a mesma linah de base aqui, o fluxo deve priorizar a pesquisa na web em foruns e demais fonte de dados para modelar a resposta. A ideia desse comando é procurar por opinião atualizada sobre o tema solicitado, uma vez que o jogo é antigo e algumas fontes de dados (estilo Wiki) podem estar defasados. É permitido que a LLM use o conhecimento base para complementar a resposta apenas. Se o que foi solicitado, não for encontrado na pesquisa na WEB, o modelo deve deixar isso claro na resposta ao usuário e poderá responder a questão com base no seu conhecimento base.

