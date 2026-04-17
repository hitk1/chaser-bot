## Contexto da aplicação

Eu quero criar um bot para meu servidor discord, com nodejs e typescript. A ideia do bot é para diversão porém eu quero fazer algo profissional, eu e meus amigos estamos jogando GrandChase desenvolvido pela KOG (um MMORPG antigo) e esta sendo bem divertido.
A ideia por trás dessa aplicação é servir como uma bot de conhecimento sobre o jogo como: Melhores cartas para equipar nos itens, melhores desafios para ser e farmar itens para melhorar o set, como evoluir o dano total de ataque, etc; (São meramente exemplos)

### Responsabilidades/skills
- Esse bot deve ser capaz de oferecer um menu de opções para os usuários do discord, eles devem começar com uma barra de prefixo "/" e alguma descrição de ação que deverá servir para oferecer alguma funcionalidade para o usuário escolher (vou definir melhor estas funcionalidades ao longo do projeto)
- O bot usará uma LLM para gerar as respostas obviamente, que terá suporte a function-calling para buscar conteúdos na internet e outras fontes externas que poderão ser usadas para complementar a resposta ao usuário.

## Arquitetura&Tecnologia

- O bot deve rodar em nodejs com typescript conforme ja mencionado e sua principal funcionalidade é responder as interações dos usuários através do discord. O mesmo deverá ser capaz de responder multiplas mensagens ao mesmo tempo, por isso deve-se levar em consideração os aspectos de concorrência (se necessário) para este cenário.
- Há um total de menos de 10 usuário ativos no servidor, então as interações concorrentes podem ser baixas.
- O bot deverá ser construído levando em consideração boas práticas de desenvolvimento de software, bem como os princípios de SOLID e DDD
- Deverá ter cobertura de testes unitários para cada usecase proposta

### Bootstrap da aplicação
No fluxo de bootstrap, o app deverá ler alguns valores injetados através de variáveis de ambiente para configuração da integração com a LLM bem como a integração com o discord
A aplicação deverá ter um fluxo de log muito bem construído usando as libs `pino`e `pino-pretty` para melhor eficiência de logs, que deverá ser usada na aplicação toda.

### Throttling
A aplicação deverá implementar um controle de rate-limiting em caso de usuários que queriam ficar "spamando" muitas mensagens, neste caso será devolvido uma mensagem dando "um puxão de orelha" para o usuário específico que esta realizando tal ação.

### Armazenamento de dados
A aplicação deverá usar o `prismaORM` como biblioteca para gestão de banco de dados, bem como o `sqlite3` como banco de dados para qualquer tipo de armazenamento de dados que for necessário, bem como:
- Histórico de conversa de uma determinada sessão;
- Ids dos usuários para identificação e configuração do throttling;
- Dados de contextos que podem ajudar a formulação das respostas;

### Integração com LLM
A API da LLM que será utilizada será da Open AI, usando modelos mais baratos para interação neste caso. (não há necessidade de modelos densos ou com recursos de deep thinking pois são interações pontuais)

### Testes unitários
Configurar o Jest para testar cada implementação deste BOT, bem como coverage report par analise e cobertura dos testes
IMPORTANTE:
- Avalie a necessidade de mockar os dados durante a implementação dos testes unitários, eu prefiro que mock de dados seja evitado.

### CI/CD
Este bot será executado em instancias no `Railway` onde o deploy é feito direto pelo github