## Contexto
Preciso aumentar a precisão e usabilidade dos comandos disponíveis. Por isso, vamos deixar a lista de comandos mais enxuta

## Regras da refatoração dos cases
1 -> Preciso remover todos os comandos de ação, exceto: /web e /wiki. Os que serão supostamente removidos, podem ser removidos do fluxo de injeção de dependencia. Porém não quero que o caso de uso respectivo seja removido, vou aprimorar eles no futuro. Só quero desabilitar por ora.

2 -> Transform o comando /web em /ask (só renomeie e referencia os casos de uso corretamente). Quero que o padrão seja que para toda interação do usuário, que o bot vá a web para buscar conteúdo relevante sobre o que foi questionado. Com isto, o comando /ask deve ser o padrão para as interações básicas com o usuário, ou seja, ele deve fazer o que hoje, o comando /web faz.

3 -> Quando houver uma pergunta do usuário e que o BOT tenha conseguido buscar conteúdo relevante na web para gera a resposta, alterar as declarações do system prompt para acrescentar também na resposta, uma sessão de "links relacionados" ou algo do tipo. Para caso o usuário queria visitar a fonte de onde foi tirado o conteúdo para gerar a resposta

## Features
1 -> Implemente um novo command handler (ou da forma que mais se enquadra dentro dos parametros da arquitetura do projeto) para capturar as respostas dos usuários em mensagens que o BOT envia como resposta a alguma pergunta inicial. Exemplo se o usuário usar o comando /ask e fazer alguma pergunta e o BOT responder a ele. Pode ser que o usuário queira responder como se fosse numa thread, dessa forma o BOT deve:
* Ser capaz de capturar essa resposta e ter acesso ao contexto da conversa com base no sessionId ou em algum identificador da mensagem que o próprio discord fornece.
* Buscar no banco de dados o contexto (histórico das ultimas mensagens daquela "thread" e gerar a resposta com base nisso.)

### Refatorar os controles sobre 'sessão ativa' de cada usuário
Junto com esta nova feature, refatore todo o controle de sessão ativa dos usuários para respeitar as threads que serão criadas, ou seja, as sessões dos usuários agora estarão diretamente vinculadas às "threads" abertas. Dessa forma, quando um usuário responder a uma mensagem do BOT o mesmo deve seguir as regras definidas na sessão anterior (sobre ter acesso ao contexto antes de gerar uma resposta).

O usuário poderá ter quantas sessões ativas forem. Exemplo:
O usuário poderá fazer 3 perguntas diferentes com o comando /ask e manter a conversa através de respostas na mesma thread, sendo assim o usuário tem 3 sessões ativas com 3 "conversas" diferentes com o BOT. Cada sessão vai se tornar uma conversa na pratica

