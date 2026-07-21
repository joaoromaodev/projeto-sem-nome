# Plano até o MVP

## Pra que serve este documento

Pra qualquer um — inclusive uma sessão futura do Claude sem histórico —
conseguir retomar o projeto sem precisar redescobrir tudo.

Por isso ele não é só uma lista de tarefas. As **decisões já tomadas vêm com
o motivo**: decisão sem motivo registrado é decisão que vai ser reaberta e
rediscutida na próxima conversa.

**Como retomar:** leia "A tese" e "Decisões travadas" primeiro. Depois veja
"Onde estamos" e pegue a próxima etapa não concluída. As armadilhas de cada
etapa estão junto dela — leia antes de escrever código, não depois.

---

## A tese

Uma sala na internet pra assistir e ouvir coisas junto com os amigos, com
estética Y2K (Windows 98, MSN, Winamp) e bonequinho andando pela tela.

**O que faz esse projeto não ser mais um Watch2Gether:** os concorrentes
tratam a sala como link descartável — cria, manda, acaba. Aqui a sala é um
**lugar fixo** com endereço próprio, gente recorrente e identidade visual.
A referência é a sala de música do Transformice, não o player de vídeo.

**O ativo real é pertencimento, não tecnologia.** Sincronizar YouTube é
commodity. Ver o bonequinho dos outros na mesma sala não é.

Isso não é opinião solta: quando o projeto foi apresentado aos amigos, o que
eles destacaram foi exatamente **"poder ficar andando com o bonequinho pela
sala enquanto passa o filme"** e a customização do avatar. Foi por causa
dessa reação que os avatares saíram da Etapa 3 e viraram Etapa 1.

---

## Onde estamos

Etapa 1 concluída e testada. **Etapa 2 concluída e testada com gente de
verdade** — 6 pessoas em máquinas diferentes, sincronia perfeita
(registrado em 2026-07-21). Lobby e lista de salas prontos. **Etapa 5
fechada em código: a sala tem memória, dona, tranca, repertório e
decoração.** **No ar em
<https://2gether.fly.dev>.** Repositório público em
`github.com/joaoromaodev/projeto-sem-nome`.

**Funciona:**

- Conta com apelido e senha (scrypt), sessão por cookie httponly
- Sala em tempo real por WebSocket; entra pelo nome
- Lobby: sala oficial de código `lobby`, criada no boot, nunca varrida pela
  faxina de salas vazias, teto de 30 (sala comum é 12)
- Lista de salas com gente agora (`/api/salas`): contagem, apelidos e
  avatares renderizados; sala vazia não aparece, o lobby aparece mesmo vazio
- Botões de ir pro lobby, trocar de sala e sair
- Bonequinho anda (setas, WASD, clique no chão) com ordenação de profundidade
- Chat com balão de fala sobre a cabeça
- Sprites de 32×48 em 5 camadas, com pulo com sombra e catálogo de peças
  lido da pasta `static/sprites/`
- Recoloração **fiel à cor escolhida** e que preserva o sombreado
  (verificado: 88 combinações de peça e cor, a dominante bate exata)
- Editor de avatar em 2 abas: peças (5 camadas, cores livres) e
  guarda-roupa de até 12 looks
- Ferramentas de gerar camadas provisórias e validar sprites
- Deploy no Fly.io rodando, com volume persistente verificado, e o código
  do cliente servido em endereço versionado por conteúdo — o que garante
  que um deploy chegue inteiro em vez de pela metade
- YouTube sincronizado pelo servidor, com correção de deriva; controle
  remoto como objeto da sala; fila de vídeos; título de cada vídeo pelo
  oEmbed, sem chave de API
- Móveis na sala: uma TV de tubo (com o vídeo rodando dentro da tela dela,
  e tela verde quando não tem nada) e um sofá de 3 lugares, com a mesma
  regra de profundidade dos bonecos
- "Está digitando": três pontinhos animados sobre a cabeça do boneco **e**
  a linha "fulano está digitando..." embaixo do chat
- Buzina que toca um som e pisca o título pra chamar quem está com a aba
  escondida — **temporária**, ver a nota nas pendências
- Barra de digitar atravessando o rodapé, conversa ocupando a coluna
  direita inteira, e a lista de nomes trocada por cabecinha + número
- Volume individual, com mudo e memória entre visitas
- **A sala tem memória e sobrevive ao restart:** quanto já tocou ali, o
  que já rolou (com quem colocou), quem frequenta e quem é o dono. A sala
  entra contando isso no chat; sala nova fica calada
- **"Suas salas" na home** — as que você frequenta, inclusive as vazias,
  que a lista de descoberta esconde de propósito
- **Sala privada por link de convite**, com o dono trancando pela barra de
  título e o link indo pra área de transferência
- **Favoritos da sala** — o repertório do grupo; clicar num põe na fila
- **Decoração:** a TV e o sofá são arrastáveis no modo decorar, e onde
  ficam é estado da sala que todo mundo vê
- **Quem frequenta**, com o boneco de cada um e apagadinho pra quem não
  está agora

**Não funciona ainda:** compartilhamento de tela, sala privada, histórico
da sala.

**A arte dos móveis já é definitiva** — é do próprio autor do projeto, não
placeholder. Fica em `static/moveis/` na resolução nativa (sofá 128×40, TV
80×80, tela verde 46×30); chegou ampliada 3× e foi reduzida com
vizinho-mais-próximo, ida e volta conferida como idêntica. **A tela da TV
é transparente no PNG**, e é isso que deixa o vídeo aparecer por trás sem
máscara nenhuma.

**A arte dos bonecos ainda é provisória.** `ferramentas/gerar_placeholders.py` gera
camadas de andaime pra o sistema ficar testável. Quando os sprites de
verdade chegarem, é sobrescrever os arquivos em `static/sprites/` e apagar
esse script — nenhum código muda.

### Próximo passo concreto

Em ordem, quando esta sessão for retomada:

1. **Esperar uma semana sem marcar nada, e olhar o banco.** A noite já
   aconteceu e funcionou; o que falta saber é se alguém volta sozinho.
   Ver "A pergunta que ainda não foi respondida" logo abaixo — continua
   sendo o item mais importante da lista, e o único que não se resolve
   escrevendo código. Perguntar a quem estava lá como foi (celular?
   internet ruim? a buzina?) também vale mais que qualquer tarefa daqui
   pra baixo.
2. **Receber as 5 camadas de arte** e validar com
   `python ferramentas/conferir_sprites.py`. O usuário estava produzindo a
   partir de uma base de 27×46 que ia expandir pra 32×48.
3. **A Etapa 5 fechou.** Sobrou de fora, de propósito: moderação do lobby
   e tirar a buzina (ver Pendências), e a Etapa 4 (WebRTC), que segue por
   último porque é a mais frágil e a que menos gerou entusiasmo. Com a
   Etapa 3 dependendo da arte chegar, **não há mais fatia grande de
   código pronta pra pegar** — o que falta agora é uso.

### O que foi verificado, e o que não foi

Registrado pra ninguém reverificar à toa nem confiar demais:

**Verificado rodando:** contas (cadastro, apelido duplicado, senha curta,
login case-insensitive, senha errada, temporização igual pra usuário
inexistente); WebSocket recusado sem sessão; chat, movimento e troca de
avatar chegando nos outros clientes; guarda-roupa incluindo isolamento entre
contas (um usuário não apaga look de outro nem chutando o id); avatar
sobrevivendo ao banco; travessia de caminho no nome de peça rejeitada;
composição das 5 camadas com manga cobrindo ou não o braço; recoloração
mudando os pixels e preservando o contorno; pulo sem cortar a cabeça;
cookie `secure` ligando só em HTTPS.

**Visto num navegador de verdade** (isto aqui já foi pendência e deixou de
ser): a sala renderizando com móveis, bonecos, balões e vídeo; o laço de
animação rodando de fato — dá pra afirmar porque é ele que apaga os balões
no prazo, e eles somem; profundidade funcionando entre boneco, TV e sofá;
e o layout medido no DOM em vez de olhado por cima.

**NÃO verificado visualmente ainda:** o ciclo de animação em si — o boneco
**andando** e o pulo com a sombra encolhendo. O que foi conferido é que as
5 camadas compõem certo nas três variações (parado, andando, virado); ver
o movimento acontecer, não.

**Verificado na sala persistente (o teste central: matar o servidor e
voltar):** com o processo derrubado de verdade e subido de novo, a sala
voltou com o contador em 1, o histórico com "Me at the zoo" e o nome de
quem colocou, e a duda na lista de membros — tudo lido do banco, com a
memória do processo comprovadamente vazia (`manager.rooms` em `[]` logo
após o import, que é o efeito de o lobby ter saído do `__init__`).

Também verificado: o vídeo tocando **até o fim num navegador de verdade**
e o contador subindo por esse caminho, não por chamada direta; o título
chegando vazio na gravação e sendo preenchido depois pelo oEmbed, no
caminho real; um segundo título **não** sobrescrevendo o já gravado; o
teto do histórico segurando em 200 depois de 225 inserções; a bia não
vendo a sala da duda em "suas salas" antes de entrar, e virando membro ao
entrar **sem** virar dona; e a linha "costumam aparecer por aqui" saindo
com "duda" pra bia e não saindo pra duda — ou seja, ninguém é informado
de que costuma aparecer onde está.

**Bug de texto achado aí:** "1 músicas já tocaram aqui". Apareceu nos dois
lugares que mostram o contador (o chat da sala e a linha de "suas salas"),
porque os dois interpolavam o número direto. Corrigido nos dois.

**Verificado no resto da Etapa 5** (no navegador, medindo o DOM):

- **Decoração:** a sala abre com a TV e o sofá exatamente onde o CSS os
  punha antes (52% e 14%, z 480 e 860) — trocar posição fixa por estado
  de sala não mexeu em nada visualmente. O sofá arrastado pra 20%/70%
  teve o z-index recalculado pra 300, ou seja, a profundidade acompanha:
  arrastar a TV pra frente do sofá muda quem tapa quem. E ficou lá depois
  de recarregar.
- **Favoritos:** a estrela desligada sem vídeo ("nada tocando pra
  guardar"), ligando quando o vídeo entra, virando ★ ao marcar, o
  contador subindo, o item aparecendo com o **título** e não com o id, e
  a linha no chat.
- **Quem frequenta:** com a bia dentro e a duda fora, a bia sai inteira e
  marcada "aqui", a duda sai com opacidade 0,38 e `grayscale(1)`.
- **Sala privada, o ciclo inteiro:** a duda trancou; a bia deixou de ver
  a sala em `/api/salas`, foi barrada na porta com o motivo certo e sem
  botão de tranca; abriu o convite, caiu direto na sala, e encontrou os
  favoritos, o sofá movido e o aviso de que entrou por convite.

**Bug de layout achado aí:** os dois botões novos (estrela e favoritos)
empurraram a fileira do vídeo pra 1249px. Numa janela de 1024 nada
estourava — o flex tirava o espaço do único item que encolhe, o
`#estadovideo`, que ficou com **12px**. Ou seja, o título do que está
tocando sumia sem nenhum sinal de que algo tinha quebrado. É a pendência
"não cabe na tela" de novo, e pela terceira vez pelo mesmo motivo:
componente de largura livre dentro de fileira apertada. Corrigido com
`flex-wrap` na fileira e piso de 120px no rótulo — a 1024 ele quebra em
duas linhas e o rótulo recupera 138px; a 1280 continua numa linha só.

**Verificado na migração:** um banco montado com o esquema **de hoje**
(sem `privada`, `convite` nem `moveis`) ganhou as três colunas no boot,
com o contador de 42 músicas intacto, e `iniciar()` rodando duas vezes
sem quebrar.

**NÃO verificado:** a sala persistente com gente de verdade voltando dias
depois — que é a única forma de saber se "suas salas" faz alguém voltar,
e é a mesma pergunta em aberto logo abaixo. O screenshot do navegador
travou nesta sessão; todo o layout foi conferido **medindo o DOM**, não
olhando. Também não foi testado: arrastar móvel no **celular** (o código
usa Pointer Events, que cobre toque, mas ninguém tocou numa tela de
verdade), nem duas pessoas decorando a mesma sala ao mesmo tempo — o
último a largar ganha, e ninguém viu isso acontecer.

### ⚠ A pergunta que ainda não foi respondida

**Metade dela foi respondida em 2026-07-21.** A noite real aconteceu: seis
pessoas, máquinas diferentes, sincronia perfeita. "Isso funciona com gente
de verdade?" — sim.

**A outra metade continua aberta, e é a que decide o projeto: eles voltam
na semana seguinte sem ninguém chamar?**

Não confundir as duas. Uma noite marcada prova que a coisa funciona
quando alguém organiza; a tese do projeto é que a sala seja um *lugar*, e
lugar é onde se volta sem convite. Watch2Gether também funciona numa noite
marcada — é exatamente por isso que "funcionou" não é vitória aqui.

**O que fazer com isso, concretamente:** não marcar a próxima. Deixar a
semana passar e ver se alguém abre o link sozinho. Se abrirem, a tese se
sustenta e o próximo trabalho é ampliar o que traz de volta (é o que a
Etapa 5 apostou: suas salas, frequentadores, repertório). Se não abrirem,
**nenhuma quantidade de WebRTC ou arte nova salva**, e a pergunta certa
passa a ser por que não — e essa se responde perguntando a eles, não
escrevendo código.

O sinal dá pra medir sem interrogar ninguém: as tabelas `sala_membros`
(`visitas`, `vista_em`) e `salas.musicas_ouvidas` já registram retorno
por conta e por sala. Basta olhar o banco depois de uma semana.

---

## Decisões travadas

Não reabrir sem motivo novo.

| Decisão | Por quê |
|---|---|
| **Frontend sem framework** | A estética Win98 é borda chanfrada, gradiente e fonte de sistema. CSS puro faz melhor e mais rápido do que lutar contra biblioteca de componentes. São 3 telas. |
| **FastAPI, não Django** | Precisamos de WebSocket e pouco mais. ORM, admin e migrations seriam peso morto. |
| **Movimento previsto no cliente** | O boneco anda na hora; o servidor só conta aos outros. Esperar confirmação deixaria o movimento borrachudo, e movimento borrachudo mata justamente a parte que a galera gostou. |
| **Identidade vem do cookie** | O WebSocket lê a sessão. Não existe mensagem de "join" com nome — se existisse, qualquer um entraria se dizendo outra pessoa. |
| **Sem recuperação de senha** | Escopo. Entre amigos, dá pra resetar na mão no banco. |
| **A cor escolhida aparece exatamente como escolhida** | A primeira versão pegava matiz e saturação da cor nova mas mantinha a **claridade do pixel do sprite** — então a claridade nunca era a escolhida, ela vinha do desenho. Quem pedia o vinho `#7a1030` via um rosa; quem pedia o azul-noite `#23203a` via um lilás claro. **A cor escolhida nunca aparecia na tela.** Agora funciona por deslocamento: cada arte tem um tom base (o mais frequente dela), esse tom recebe os bytes da cor escolhida direto, e os outros tons se movem junto mantendo a distância. Sombra segue sombra e brilho segue brilho, mas agora são os *daquela* cor. |
| **O tom base é a moda, não a média** | Em pixel art o corpo da peça é uma área chapada grande e as luzes e sombras são detalhes pequenos em volta — a moda cai no corpo, que é o que a pessoa lê como "a cor da roupa". A média cairia entre dois tons e não seria a cor de nenhum pixel; o tom mais claro deixaria a peça inteira mais escura que a escolha. |
| **Avatar é código, não imagem** | Cabe em <200 bytes, trafega de graça, e não existe upload (nem o custo de moderar upload). |
| **Uma máquina só no deploy** | O estado da sala vive em memória. Duas máquinas = dois usuários da mesma sala em servidores diferentes, sem se enxergar. |
| **Fly.io, não o PC de casa** | O projeto vai pro portfólio. Link que só funciona com o PC ligado é inútil pra isso. CGNAT das operadoras também impediria abrir porta. |
| **Vercel está descartado** | Serverless não segura conexão WebSocket aberta. |
| **Sem rating de salas** | Foi proposto e recusado. Entre poucos amigos uma nota é dois votos — ruído, não sinal. Ranking cria sala "mal avaliada", que entre amigos é constrangimento. E descoberta por nota é o modelo de lista de servidor público, exatamente o que a tese rejeita. A pergunta real de quem olha a lista não é "essa sala é boa?" e sim "tem gente lá? tem gente que eu conheço?" — por isso a lista mostra **presença**: contagem, apelidos e avatares. |
| **`apps create`, não `fly launch`** | O `launch` reescreve o `fly.toml` e derrubaria os comentários e os ajustes de volume, região e concorrência. |
| **O controle é objeto, não cargo** | Podia ser um "host" com botão de passar a vez. Virou um controle remoto que fica no chão da sala, vai pra mão de quem pega e cai de volta quando solta. Cargo é caixa de permissão; objeto é coisa que existe no lugar — e o projeto todo aposta que o valor está em **estar num lugar**. Pegar o controle da mesa é a versão digital de levantar do sofá. |
| **Pôr na fila não exige o controle** | O controle existe pra duas pessoas não brigarem pelo play/pause, não pra alguém decidir o que a sala assiste. Se pôr na fila exigisse o controle, quem o pegasse viraria porteiro — e a parte coletiva (todo mundo empilhando música) é justamente a graça. |
| **Sem controles nativos do YouTube** | `controls: 0`, mais um escudo transparente sobre o iframe pra quem não está com o controle. Sem isso os botões do próprio YouTube dariam play e pause a qualquer um, passando por cima do controle remoto e dessincronizando a sala. |
| **Quem sai larga o controle** | Se o controle sumisse com quem fechou a aba, a sala ficaria travada sem ninguém podendo mexer no vídeo. Ele cai no chão na posição de quem saiu. |
| **Sala privada depende de persistência** | Sala privada precisa de dono, e dono precisa sobreviver ao restart. Hoje `Room` vive num dict em memória: reiniciou, evaporou o dono junto. Por isso o item foi empurrado pra depois da Etapa 5, e não improvisado agora. |
| **Título por oEmbed, não pela YouTube Data API** | O plano pedia a API de dados, que exigiria projeto no Google Cloud, chave, secret no Fly e cota diária — quatro peças pra manter por causa de um texto. O oEmbed do próprio YouTube (`youtube.com/oembed`) devolve o título por URL pública, sem nada disso. O preço é não responder por vídeo privado, apagado ou sem embed; nesses casos o título sai vazio e a tela mostra o id, que é exatamente o que ela mostrava antes. Degrada pro comportamento antigo em vez de quebrar. |
| **O título nunca segura o vídeo** | A busca é `create_task` e o título chega numa mensagem própria, depois. Esperar um GET pro YouTube antes de dar play atrasaria a sala inteira por causa de um rótulo — trocaria sincronia, que é a coisa difícil do projeto, por enfeite. Pelo mesmo motivo o `bemvindo` só manda o que já está em cache. |
| **A TV é objeto da sala, não widget na coluna** | O vídeo saiu da coluna lateral e foi pra dentro de uma TV que existe no chão — mesma lógica do controle remoto: coisa que está no lugar, não painel numa caixa. |
| **Móvel desenha em 1×, boneco em 2×** | Parece descuido e não é. A arte dos móveis foi feita com o dobro da densidade de pixel do boneco: o corpo dele ocupa 20×36 do sprite, e a TV ocupa 80×72. Na mesma escala a TV sai com **o dobro da altura de uma pessoa** — foi exatamente assim que ela ficou gigante na primeira tentativa (5×, 400px, ~4× uma pessoa). Em 1× ela lê como TV de tubo, o sofá tem metade da altura de quem está em pé, e tudo continua em pixel inteiro, que é o que mantém a arte nítida. Escala fracionária resolveria a proporção e borraria o pixel — não vale a troca. O botão pra mexer nisso é `--movel`, um número só. |
| **O sofá foi alargado, não escalado** | Pedido: caber 3 pessoas. Não dá pra resolver com escala — na altura certa (1×) a arte original comportava 1,9 boneco, e ampliar pra caber 3 deixaria o encosto mais alto que uma pessoa. Então a **arte** mudou: 80→128px, repetindo uma faixa do meio (16px, não uma coluna só, pra não esticar o tracejado do encosto) e preservando os braços nas pontas. |
| **A tela minúscula é aceita por ora** | Com a TV em 1× o vídeo tem 46×30. Foi verificado que o YouTube **toca** nesse tamanho (um vídeo de 19s rodou até o fim e o contador de músicas subiu), mas ninguém assiste um filme aí. Aceito porque o uso real declarado é som de fundo com a aba escondida. Quando quiserem assistir de verdade, a saída não é inflar esta TV — é uma segunda tela, ou clicar nela pra expandir. |
| **O buraco da tela é transparente no PNG** | A arte da TV vem com a tela em alpha 0, então o iframe fica **atrás** da moldura e aparece pelo buraco — sem máscara, sem `clip-path`, sem recorte. As coordenadas do buraco (x=17, y=28, 46×30 no sprite de 80×80) viram `calc()` no CSS em cima da escala, então mudar a escala move moldura, buraco e vídeo juntos, sem chance de um sair do lugar do outro. |
| **A buzina deixa floodar, mas tem teto** | Era um intervalo mínimo entre buzinas e estava errado: a rajada é a graça, e quem precisa chamar de verdade buzina várias vezes seguidas. Agora são **10 numa janela de 40s**, sem espera nenhuma entre elas. A trava é **por sala e não por pessoa**: o incômodo é o barulho, e pra quem ouve tanto faz se as dez vieram de um ou de dez. |
| **A janela é deslizante, não um contador que zera** | Com contador zerando a cada 40s, quem gastasse as 10 no fim de uma janela ganharia mais 10 no começo da seguinte — 20 buzinas seguidas, exatamente o que o teto existe pra impedir. Com janela deslizante cada buzina caduca 40s depois da sua vez, e o limite vale em qualquer trecho de 40s que se olhe. Quando barra, a mensagem diz **quantos segundos faltam** — sem o número, quem foi barrado fica martelando o botão pra descobrir. |
| **O som é sintetizado, não é arquivo** | Nada pra baixar, nada pra licenciar, nada pra versionar — e o toque é ajustável mexendo em número. A corneta são duas vozes numa quarta justa (Mib e Láb, a razão 1.333 das buzinas de duas bocas), cada uma dobrada e desafinada em 3,5 Hz pra dar o batimento áspero que soa a instrumento, tudo passando por um passa-baixa que abre no ataque e fecha no fim, imitando a boca respondendo ao sopro. Uma nota só soaria despertador; sem o desafino, sintetizador barato. |
| **O áudio passa por um limitador** | Medido: a corneta no ganho original estourava sozinha (pico 1,63, com 55 amostras ceifadas) — e som ceifado é exatamente o chiado que faz sintetizado soar ruim. Baixar o ganho resolveria uma buzina, mas não a rajada: elas duram 0,75s e várias se sobrepõem, somando amplitude. Baixar o bastante pra aguentar dez deixaria uma sozinha fraca demais, que é o caso comum. Um `DynamicsCompressor` na saída resolve os dois — verificado com 1, 4 e 10 sobrepostas: picos 0,88 / 0,92 / 0,95, nenhuma amostra estourada. |
| **A buzina espera o áudio acordar antes de tocar** | Contexto de áudio suspenso não anda o relógio: `currentTime` fica parado. Montar o som nesse estado agenda tudo num instante que já passou quando ele volta — e o resultado é **silêncio sem erro nenhum no console**, que é o pior tipo de falha pra diagnosticar. Por isso, se o contexto estiver suspenso, esperamos o `resume` e só então montamos. |
| **A buzina pisca o título além de tocar** | Só o som não resolve: metade do caso de uso é quem está com o volume baixo ou o fone tirado, e só enxerga a barra de abas. O som chama quem escuta; o título piscando chama quem só olha. Ele volta ao normal assim que a pessoa foca a aba, e desiste sozinho depois de 25s. |
| **Volume é de cada um e não passa pelo servidor** | É o único ajuste do vídeo que não exige o controle remoto. Play, pause e seek mudam o que a sala inteira vê, e por isso são disputa; volume só mexe no ouvido de quem mexeu. Quem está de fone no escritório não deveria pedir licença pra abaixar — nem estourar o som dos outros ao ajustar o seu. Fica guardado no `localStorage` porque quem abaixou por estar no trabalho vai querer baixo na próxima também. |
| **Mudo usa `mute()`, não volume 0** | Em 0 o YouTube ainda deixa passar um fiapo de som em alguns navegadores. Além disso `mute()` preserva o nível anterior, então voltar do mudo devolve o volume que a pessoa tinha escolhido em vez de chutar 100. |
| **O endereço do código carrega a versão** | `/v/<hash>/js/sala.js`, com o hash tirado do conteúdo dos `.js` e `.css`. Mudou o código, muda o endereço — e não existe cópia velha daquele endereço pra o navegador reusar. O arquivo então pode ir com `immutable` e cache eterno, sem risco. **Só o `no-cache` não bastava**: ele vale das respostas dali pra frente, e quem já tinha cópia guardada continuava com ela até vencer. O detalhe que faz a solução ser barata: os `import` dos nossos `.js` são **relativos**, então versionar o ponto de entrada versiona a árvore toda sozinho, sem tocar em nenhum import. |
| **As páginas HTML vão com `no-cache`** | Elas são o mapa que aponta pros endereços versionados; mapa velho levaria de volta ao código velho. Isso estava faltando: as páginas são servidas por `FileResponse` direto nas rotas e **não passavam pelo `StaticFiles`**, então a correção de cache anterior não as alcançava. |
| **Você vê o próprio balão, mas não a própria linha** | Num chat comum ver o próprio "digitando" seria redundante — mas aqui você **enxerga o seu boneco**, e vê-lo pensando enquanto escreve é retorno visual que um chat não teria onde dar. O balão é desenhado **localmente**, sem passar pelo servidor: aparece já no primeiro toque de tecla em vez de depois da ida e volta, e continua certo com a conexão caída. O servidor segue mandando o aviso só pros outros (`exceto=uid`) — não faz sentido ecoar de volta o que já sabemos. A **linha do chat** continua sendo só dos outros: "você está digitando..." é ruído. |
| **A linha "fulano está digitando" fica fora do histórico** | Como o aviso é reenviado a cada 2s enquanto a pessoa escreve, virar mensagem de chat encheria o log de linhas repetidas. É **estado, não acontecimento**: tem lugar fixo embaixo do histórico e some quando acaba. A altura fica reservada mesmo vazia, senão o chat pula toda vez que alguém começa a digitar. |
| **A linha e o balão saem do mesmo estado** | Os dois são derivados do `pensandoAte` de cada pessoa, em vez de a linha ter contagem própria. Duas fontes de verdade pra mesma coisa acabam discordando — o balão sumindo e a linha ficando pendurada, ou o contrário. |
| **"Está digitando" não carrega texto** | Só um liga/desliga. Mandar o que a pessoa escreve antes de ela apertar enter vazaria rascunho — inclusive o que ela escreveu, pensou melhor e apagou. |
| **Presença em memória, memória no banco** | A tentação era persistir a sala inteira. Mas quem está dentro *agora* é fato do instante: se o servidor cair no meio, as linhas gravadas viram gente fantasma numa sala que ninguém está — e a lista de salas passaria a mentir exatamente sobre a coisa que ela existe pra informar. Então presença (quem está, onde o boneco está, quem segurou o controle, que segundo do vídeo toca) fica em memória e morre com o processo, de propósito. Dono, contador, histórico e frequentadores vão pro banco. A régua: **se um crash tornar o dado falso, ele não devia estar gravado.** |
| **O contador é somado pelo banco, não pela memória** | `video_acabou` manda o banco incrementar e adota o total que volta de lá. Somar em memória e gravar depois daria dois números pra mesma coisa, e o de memória mentiria depois de qualquer restart — que no Fly acontece toda vez que a máquina dorme. Uma fonte de verdade só. |
| **O histórico anota quando o vídeo entra** | Não quando acaba. Metade das músicas é pulada antes do fim, e o histórico existe pra responder "o que já rolou nessa sala", não "o que foi ouvido inteiro". Anotar no fim perderia justamente as que alguém pulou por serem ruins — que é informação sobre a sala. |
| **O título do histórico é preenchido depois** | A linha nasce com o título vazio porque no instante em que o vídeo entra o oEmbed quase nunca respondeu ainda. Esperar o rótulo pra gravar repetiria o erro que a decisão "o título nunca segura o vídeo" já resolveu. Quando a busca volta, ela preenche **só o que está vazio** — título já gravado é o que a sala viu na época, e reescrever apagaria isso à toa. |
| **A faxina de salas vazias não apaga sala** | Ela descarta a **cópia em memória** de quem não tem ninguém há uma hora. A sala continua inteira no banco, com dono, contador, histórico e membros. Quem voltar amanhã encontra o lugar de volta — que é exatamente a diferença entre um lugar e um link. |
| **"Suas salas" mostra sala vazia; "onde tem gente" não** | Parece contradição e não é: são perguntas diferentes. A lista de cima é **descoberta** — entrar num lugar deserto de estranhos e sair é a pior primeira impressão, então sala vazia não entra. A de baixo é **retorno**: a sua sala vazia é um lugar que você conhece, e você pode querer abrir justamente pra ser o primeiro. Mesma informação, decisões opostas. |
| **O passado da sala chega pelo chat, não num painel** | Sala que abre com um relatório do lado vira ferramenta, e a tese é que ela seja um lugar. No chat, "342 músicas já tocaram aqui" e "a última foi X, que a duda colocou" chegam como alguém te contando. Sala sem história fica **calada** em vez de anunciar três zeros. |
| **Quem chega primeiro numa sala nova vira dono** | Não dá poder nenhum hoje. É o gancho da sala privada por convite, que precisa de um dono que sobreviva ao restart — e era exatamente por isso que aquele item estava travado. Entrar depois não muda o dono. |
| **O lobby não nasce mais no import** | `RoomManager.__init__` criava o lobby na hora de importar o módulo. Montar uma sala hoje **escreve no banco**, e o import acontece antes de `db.iniciar()` ter criado as tabelas. Agora quem chama é o lifespan, depois do banco de pé. |
| **Sala privada é convite, não lista de permissões** | O dono tranca, o link vai pra área de transferência, ele manda pra quem quiser. Quem abre o link **vira membro** e entra. A porta pergunta uma coisa só: "você é membro desta sala?" — e membro é a mesma tabela que já alimenta "suas salas" e a lista de quem frequenta. Uma lista de permissões separada seria cadastro paralelo pra manter, e entre amigos ninguém mantém. |
| **Trancar rotaciona o convite** | Destrancar e trancar de novo gera um link **novo**, e o antigo morre. Enquanto a sala esteve aberta o link velho circulou de graça; reaproveitá-lo deixaria entrar todo mundo que passou por ali no meio-tempo. |
| **Sala trancada não aparece na lista de quem não é de lá** | Mostrar e barrar na porta seria pior que esconder: a lista entrega **quem está onde**, com apelido e avatar, e é exatamente disso que quem trancou quer privacidade. Convite inválido e sala inexistente dão a mesma resposta, pelo mesmo motivo. |
| **O convite sobrevive ao login** | Quem clica no link sem estar logado é mandado pro login com o convite guardado num cookie de 15 min, e a home o devolve pro convite depois. Sem isso o link viraria "faça login" e morreria ali — que é onde a maioria dos convites morre de verdade. |
| **O lobby não tranca, nem forçado no banco** | A rota recusa, e o `Room` ignora a coluna se ela vier ligada. O lobby é o destino padrão de quem entra sem sala; trancado, essa gente não teria pra onde ir. Duas travas porque a consequência é a porta da frente do site. |
| **Favorito é da sala, não de quem clicou** | A chave é (sala, vídeo): duas pessoas marcando a mesma música é uma linha só. Favorito por pessoa seria playlist pessoal — e playlist pessoal não é o que faz um grupo ter repertório. Pelo mesmo motivo não exige o controle remoto: o controle existe pra ninguém brigar pelo play/pause, não pra decidir o que a sala escuta. |
| **Clicar num favorito põe na fila** | Sem isso a lista seria enfeite: um lugar pra olhar o que já foi bom e não poder fazer nada com isso. Vai pra fila e não pro play direto porque play atropelaria o que está tocando — que é justamente o que o controle remoto existe pra impedir. |
| **Arrastar móvel só no modo decorar** | Fora dele o sofá deixa o clique passar (`pointer-events: none`) pra clicar nele mandar o boneco andar até lá — a reação esperada de quem clica num sofá. Se o móvel capturasse o ponteiro o tempo todo, mover a mobília custaria o passeio, e o passeio é a parte que a galera gostou. O modo tem contorno tracejado: modo que muda o que o clique faz precisa aparecer na tela. |
| **O móvel anda na hora e só avisa no fim** | Mesma regra do boneco: posição prevista no cliente, servidor só conta aos outros. E a mensagem sai no `pointerup`, não a cada pixel — mandar durante o arrasto encheria o socket pra desenhar a mesma coisa. O servidor não ecoa de volta pra quem arrastou, senão o móvel daria um pulinho quando a resposta chegasse. |
| **"Estou arrastando?" é estado explícito, não `hasPointerCapture`** | Dava pra perguntar ao próprio elemento se ele capturou o ponteiro. Mas aí a resposta passa a depender de a captura ter dado certo, e quando ela falha o arrasto morre **em silêncio, sem erro nenhum** — o pior tipo de bug pra diagnosticar. Agora a captura é o que ela é de fato: reforço pra o ponteiro não escapar, dentro de um `try`. |
| **Quem frequenta abre num popover, não numa janela fixa** | A lista de nomes fixa foi cortada de propósito e continua cortada: quem está **agora** já aparece no chão, com boneco e apelido. "Quem costuma estar aqui?" é outra pergunta, e merece resposta — mas só ocupa tela quando alguém pergunta. |
| **Offline aparece apagadinho em vez de sumir** | Numa sala vazia, ver os bonecos de quem costuma vir é o que faz o lugar parecer de alguém. Sumindo, sala vazia vira tela em branco — que é exatamente a sensação que a Etapa 5 existe pra evitar. |
| **A coluna nova precisa de remendo, não só de `CREATE TABLE`** | `CREATE TABLE IF NOT EXISTS` não alcança tabela que já existe, e existe um banco no ar com volume. Sem o `ALTER TABLE` no boot, o deploy sobe, a tabela "já está lá", e o app quebra na primeira consulta que usa a coluna nova — falha que **só aparece em produção**, porque local o banco é sempre recriado do zero. Ver `REMENDOS` em `db.py`. |
| **Supabase + Vercel descartado** | Funcionaria via Supabase Realtime, mas jogaria fora o backend inteiro. Pior: a sincronia de vídeo depende do servidor ser fonte da verdade; sem servidor, seria preciso eleger um cliente como dono do relógio, e a sala dessincroniza quando ele fecha a aba. |

---

## Etapa 2 — YouTube sincronizado ✅ concluída

A parte tecnicamente difícil do projeto. Estimativa era 5 a 7 dias.
**Fechada em 2026-07-21**, quando o critério de saída foi cumprido com
gente de verdade — ver o fim desta seção.

### Arquitetura

O servidor é a fonte da verdade. Ele guarda por sala:

```
{video_id, tocando, posicao_na_ultima_atualizacao, timestamp_do_servidor}
```

Clientes **nunca** tratam o próprio player como verdade. Eles calculam a
posição esperada e corrigem a sua.

### Tarefas

- [x] Carregar a YouTube Iframe API e montar o player na sala
- [x] Estado do vídeo em `rooms.py` (id, tocando, posição, timestamp)
- [x] Mensagens novas no `protocol.py`: `video_por`, `video_play`,
      `video_pause`, `video_seek`, `video_estado`, `video_fim`
- [x] Heartbeat do servidor a cada ~3s com a posição canônica
- [x] Correção de deriva no cliente (ver armadilha 2 abaixo)
- [x] Tela de "clique pra entrar" resolvendo o autoplay (armadilha 3)
- [x] Aviso no chat quando alguém está carregando (armadilha 4)
- [x] Contador `musicas_ouvidas` da sala, com guarda contra contar N vezes
      (o fim do vídeo dispara no player de todo mundo quase junto)
- [x] Quem entra no meio do vídeo já cai no ponto certo
- [x] Título do vídeo — resolvido pelo **oEmbed**, sem chave de API (ver
      decisão travada). Aparece na linha do que está tocando, em cada item
      da fila e no cartão da sala no lobby

- [x] **Controle remoto como objeto da sala** — resolveu o "papel de host"
      do plano original, e melhor: em vez de um cargo invisível numa caixa
      de permissão, é uma **coisa que existe no chão**. Quem quer mandar
      vai lá e pega; quem terminou devolve, e ela cai onde a pessoa
      estava. A transferência vira gesto visível e social em vez de
      configuração — que é exatamente a tese do projeto ("a sala é um
      lugar", não uma ferramenta).
- [x] Fila de vídeos por sala (pôr, tirar, pular, e o próximo entra
      sozinho quando o atual acaba)

### Armadilhas — ler antes de codar

**1. Loop de eco.** Cliente A dá play → servidor avisa B → o player de B
dispara `onStateChange` → B manda "play" pro servidor → servidor avisa A →
infinito. Solução: uma flag `mudancaRemota` que suprime o envio quando a
mudança veio da rede.

**2. Deriva.** Latência faz cada um ficar num ponto diferente. Solução: no
heartbeat, o cliente compara sua posição com a canônica. Diferença abaixo de
0,5s ignora; entre 0,5s e 2s ajusta o `playbackRate` levemente (correção
suave); acima de 2s dá `seekTo` (correção dura). **O ajuste de playbackRate é
o que separa "funciona" de "funciona bem"** — sem ele, o vídeo fica dando
pulinhos o tempo todo.

**3. Autoplay bloqueado.** Navegador não deixa tocar áudio sem interação do
usuário. Precisa de uma tela "clique para entrar na sala" que serve como
gesto. Não é opcional, é requisito do navegador.

**4. Buffering assimétrico.** Alguém com internet ruim trava. Decisão de
produto já tomada: **seguir em frente**, e avisar no chat que fulano está
carregando. Esperar todos trava a sala inteira no usuário mais lento.

### O que foi verificado, e o que não foi

**Verificado rodando:** extração do id de todo formato de link do YouTube
(watch, youtu.be, embed, shorts, m.youtube, com `&t=`), e rejeição de lixo
incluindo `<script>`; a posição canônica andando sozinha no ritmo de 3s sem
ninguém mandar nada; quem entra no meio recebendo o ponto certo; pause
congelando de verdade (3,5s depois continuava no mesmo lugar) e parando de
mandar batida; o fim do vídeo contando **uma** música com dois clientes
avisando; link inválido não derrubando a conexão; a decisão de deriva em
todas as faixas e fronteiras (< 0,5s não mexe, 0,5–2s corrige por
velocidade em no máximo 5%, > 2s pula); e — no navegador — o player
tocando de verdade (`estado: 1`), com a posição dele batendo com a
canônica do servidor dentro de décimos e `playbackRate` em 1.

**Verificado nos títulos:** o oEmbed respondendo (uma leva de 4 ids em
0,65s, cache depois em 0μs); id inválido voltando vazio, entrando no cache
como vazio — sem isto um vídeo apagado na fila renderia busca nova a cada
repintura — e sem derrubar a conexão; o `video_trocou` chegando **antes**
do `titulos`, que é a prova de que o vídeo não espera o rótulo; quem entra
depois recebendo os títulos já no `bemvindo` em 0,000s; e no navegador, a
fila mostrando "Me at the zoo" e caindo no id cru pro vídeo inexistente.

**Bug achado nesse teste:** a linha do que está tocando não tinha
`white-space: nowrap`. Com a palavra "tocando" era sempre uma linha; com
título de tamanho imprevisível virou três (30,6px) e empurrava a fila pra
fora da coluna de 260px. É a pendência "não cabe na tela" aparecendo de
novo, e pelo mesmo motivo: **componente dimensionado pelo conteúdo dentro
de coluna de largura fixa.** Corrigido com reticências, e o título inteiro
continua no `title` do elemento.

**Verificado nos móveis (no navegador, medindo o DOM):** o iframe caindo
exatamente no buraco da tela; a tela verde aparecendo com a TV desligada e
sumindo quando entra vídeo; o boneco nascendo entre a TV e o sofá, na
frente de uma e atrás do outro; e — a dúvida que valia a pena tirar — o
YouTube **tocando de verdade num player de 46×30**: um vídeo de 19s rodou
até o fim sozinho e o contador de músicas da sala subiu.

**Verificado no digitando e na buzina (dois clientes):** o balão de
pontinhos aparecendo sobre o boneco certo, com os três pontos animando
escalonados, e sumindo quando a pessoa sai; quem digita **não** recebe o
próprio aviso; a buzina chegando nos dois lados (inclusive em quem
apertou, que é o retorno de que funcionou); uma **rajada de 10 seguidas
passando sem espera nenhuma** e o saldo caindo 9→0; a 11ª sendo barrada
com aviso e **não** chegando nos outros; a contagem regressiva andando
(40s → 35s); o título piscando e voltando ao normal quando a aba é
focada; e `ligado: "talvez"` sendo ignorado sem derrubar a conexão.

**Verificado no som (renderizado offline e medido, já que ouvir não
dava):** a corneta com pico 0,88 e zero amostras estouradas; o mesmo com
4 e com 10 sobrepostas (0,92 e 0,95) graças ao limitador; e o espectro
batendo com o desenho — energia igual nas duas vozes (311 e 415 Hz),
harmônicos presentes, e frequências fora de nota **11× mais fracas**, ou
seja tonal e não ruído.

**Bug de uso achado aí:** o spawn do servidor sorteava `y` entre 20 e 60%,
e a TV ocupa a partir de ~36% — quem caísse atrás dela entrava na sala
**invisível**, coberto pela televisão, sem entender que já estava dentro.
Trocado pra 10..32%. Andar pra trás do móvel e sumir tudo bem, porque foi
escolha de quem andou; nascer escondido, não.

**Verificado no volume:** o valor guardado voltando do `localStorage` e
chegando **no player de verdade** depois de recarregar a página
(`volumeQuero: 25` e `volumeReal: 25`); mudar o slider mexendo nos dois
juntos; e o mudo deixando `volumeReal` em 60 com `mudo: true` — ou seja,
silenciando sem perder o nível escolhido.

**Cuidado ao mexer:** `YT.Player` **substitui** o elemento alvo pelo
iframe em vez de inserir dentro dele. Ou seja, `#player` deixa de ser um
`div` e passa a ser o próprio `<iframe>` — procurar por `#player iframe`
não acha nada e parece que o player não montou. Já custou um susto.

**Pra investigar sincronia:** no console, `sala.video()` devolve o que o
player está fazendo de fato — posição, estado, taxa e volume (o que
queremos e o que ele está usando; se discordarem, o ajuste não chegou).
A sincronia é a parte difícil do projeto e é toda invisível — sem isso,
investigar dessincronia é adivinhação. Só lê, não muda nada.

**Nem todo vídeo do YouTube toca embutido.** O dono pode bloquear a
reprodução fora do site. Isso apareceu testando com o clipe do Rick
Astley: o player ficava em `estado: -1` parado no zero, com cara de bug
nosso. Não era — o app já trata e escreve no chat "o dono desse vídeo não
deixa tocar fora do YouTube". **Ao testar reprodução, use um vídeo sabido
livre** ("Me at the zoo", `jNQXAC9IVRw`), senão a investigação vai pro
lado errado.

**Verificado com gente de verdade (2026-07-21):** seis pessoas em
máquinas diferentes assistindo juntas, **com sincronia perfeita**. Era o
único item que faltava aqui, e era o que separava "a lógica está certa"
de "a coisa funciona".

**Ainda não sabemos** (o teste aconteceu, mas estes detalhes não foram
registrados — vale perguntar a quem estava lá antes de assumir
qualquer coisa):

- se alguém entrou pelo **celular**, e como foi
- se alguém pegou **internet ruim** de verdade — a armadilha 4 tem
  código, mas ninguém confirmou ter visto buffering real e o aviso no
  chat aparecendo
- se a **buzina** foi usada, e se incomodou
- quanto tempo a sessão durou, e o que a galera fez além de assistir

### Critério de saída — ✅ cumprido em 2026-07-21

Pedia quatro pessoas em máquinas diferentes assistindo o mesmo vídeo sem
perceber dessincronia. **Aconteceu com seis, e a sincronia foi
perfeita.**

Vale registrar o que isso significa e o que não significa. A parte
tecnicamente difícil do projeto — o servidor como fonte da verdade, a
correção de deriva, o eco suprimido, o autoplay — **funciona fora do
laboratório**, com latências reais e máquinas que não são a do
desenvolvedor. Isso era hipótese até aqui; todo o teste anterior tinha
sido um navegador mais clientes de WebSocket em Python, o que valida a
lógica e não a experiência.

Pelo critério deste documento, **existe produto lançável a partir daqui.**

O que este teste **não** respondeu: se eles voltam. Ver logo abaixo — é
outra pergunta, e continua aberta.

---

## Etapa 3 — Arte nova

Trocar os bonecos de 8×14 desenhados por código por sprites de verdade.

### O que já foi decidido

- **Tamanho: 32 × 48**, exibido em 2× (fica 64×96 na tela). Desenhar pequeno
  e ampliar é o que mantém o pixel visível — é disso que a estética depende.
  O teto útil é 48×64; acima disso a sala fica apertada e a arte custa caro.
- **5 camadas**, empilhadas nesta ordem (de baixo pra cima):

  ```
  1. pele      cabeça + braços + mãos     ← cor de pele
  2. pernas                               ← cor da calça
  3. sapatos                              ← cor do sapato
  4. torso     camisa (cobre os braços)   ← cor da camisa
  5. cabelo                               ← cor do cabelo
  ```

  Os braços vão no arquivo da **pele**, não em separado: como a camisa é
  desenhada por cima, o comprimento da manga vira decisão da camisa. Ganha-se
  manga curta, longa e regata sem nenhum arquivo novo.

- **Movimento: pulo com sombra**, não ciclo de caminhada. Motivos: (a) sprite
  quicando é a linguagem visual da web de 2001; (b) num sprite pequeno, o
  movimento vertical lê melhor que troca de perna; (c) ciclo de 4 quadros ×
  5 camadas = 20 sprites, e mataria o editor pixel a pixel. A **sombra que
  encolhe quando o boneco sobe** é o que faz o pulo parecer intenção e não
  bug — não é opcional.

- **Direção da arte:** Dark Y2K — quase-preto arroxeado, magenta neon, ciano.

### Tarefas

- [x] `avatar.js` compondo camadas de imagem em vez de gerar pixels
- [x] Recoloração **por deslocamento**: o tom base da arte vira exatamente
      a cor escolhida e o resto se move junto, mantendo a distância que
      tinha. Pixel abaixo de 16% de claridade não é recolorido, pra o
      contorno continuar preto
- [x] Sombra elíptica que encolhe no pulo
- [x] Catálogo de peças lido da pasta e servido em `/api/pecas` — acrescentar
      roupa é soltar o arquivo e reiniciar, sem tocar em código
- [x] Escala ajustada na sala (2x), no editor (3x) e nas listas (1x)
- [x] Camadas provisórias pra o sistema ficar testável
- [ ] **Receber as 5 camadas de verdade** e validar com
      `ferramentas/conferir_sprites.py`
- [ ] Direção: frente, costas e lado (hoje só existe uma vista, espelhada)
- [ ] Reintroduzir o editor de retoque (ver "Pendências")

### ⚠ Migração

Os bonecos de 8×14 **não migram** — geometria diferente. As contas sobrevivem;
os avatares e o guarda-roupa precisam ser refeitos. Como são poucos e de
teste, refazer sai melhor que escalar na marra. **Avisar a galera antes.**

### Licença dos assets

Se vier de itch.io ou similar, registrar no repositório: link da página,
licença e autor. CC0 e CC-BY servem; "personal use only" e "no
redistribution" **não servem** pra algo publicado num site.

---

## Etapa 4 — Cine Privê (WebRTC)

Compartilhar a tela com áudio pra assistir filme junto. Deixado por último de
propósito: é a parte mais frágil e a que menos gerou entusiasmo.

### Tarefas

- [ ] Sinalização (troca de SDP e ICE) pelo WebSocket que já existe — não
      precisa de infra nova
- [ ] `getDisplayMedia` com captura de áudio da aba
- [ ] Malha P2P entre os participantes
- [ ] STUN público do Google
- [ ] Interface: quem está transmitindo, quem está assistindo, parar
- [ ] Avisar quando o navegador não suporta, antes da pessoa tentar

### Armadilhas

- **Só funciona no Chrome/Edge desktop.** Firefox é limitado, Safari é ruim,
  celular não existe. Deixar isso claro na interface **antes** da tentativa.
- **Malha P2P não passa de 4 ou 5 pessoas.** Acima disso precisaria de SFU
  (mediasoup, LiveKit), que é caro e complexo. Tratar "sala pequena" como
  característica, não como limitação.
- **TURN.** STUN resolve ~80% dos casos. Os outros 20% (NAT simétrico, CGNAT
  — comum nas operadoras brasileiras) precisam de relay, que custa banda de
  verdade: ~1 GB por hora por espectador. Opções: coturn numa VM gratuita, ou
  aceitar que alguns pares não conectam. **Este é o único item do projeto que
  pode gerar custo real.**

---

## Etapa 5 — A sala persistente

O que fecha a tese. Hoje a sala some quando o servidor reinicia — e no Fly
isso acontece toda vez que a máquina dorme por falta de gente.

- [x] Salas no banco (não só em memória). Tabelas `salas`,
      `sala_historico` e `sala_membros`. A divisão que vale lembrar:
      **presença fica em memória, memória fica no banco.** Quem está
      dentro agora, onde o boneco está e quem segurou o controle são
      estado de agora — guardar isso criaria gente fantasma
      sobrevivendo a um crash. Dono, contador, histórico e frequentadores
      são passado, e é o passado que faz a sala ser um lugar.
- [x] Histórico: o que já tocou ali. Anotado quando o vídeo **entra**, não
      quando acaba — metade das músicas é pulada, e a pergunta que o
      histórico responde é "o que já rolou aqui", não "o que foi ouvido
      inteiro". Teto de 200 linhas por sala, podado na mesma transação da
      inserção.
- [x] Contador visível. Aparece no chat na entrada e na linha da sala em
      "suas salas"
- [x] Membros: quem frequenta, com o boneco de cada um e **apagadinho pra
      quem está offline**. Abre clicando na contagem de gente, num
      popover — a lista de nomes fixa continua cortada, porque quem está
      *agora* já aparece no chão. São perguntas diferentes: "quem está
      aqui?" o chão responde, "quem costuma estar?" não
- [x] "Suas salas" na home — as que você frequenta, que é exatamente o
      comportamento recorrente que a tese quer premiar
- [x] **Sala privada por link de convite.** Convite e não lista de
      permissões: o dono tranca, o link vai pra área de transferência, e
      quem abre o link vira membro e entra. A porta pergunta "você é
      membro?" — a mesma tabela que já alimenta "suas salas" e os
      frequentadores, sem cadastro paralelo nenhum
- [x] Favoritos do grupo — o repertório da sala. Clicar num favorito põe
      na fila, que é o que faz a lista servir pra alguma coisa
- [x] Decoração: a TV e o sofá viraram estado da sala. Arrastar acontece
      no **modo decorar**, ligado por um botão
Esse conjunto é o que faz alguém abrir o site sem motivo específico — que é
exatamente o comportamento que o projeto quer.

**A etapa está fechada em código.** O que sobra dela é do mesmo tipo do
resto do projeto: ninguém usou com gente de verdade ainda. Ideias que
apareceram no caminho e ficam registradas como *não decididas* — mais
móveis pra decorar (hoje são dois), sentar no sofá, e uma segunda tela pra
quem quiser assistir em vez de ouvir de fundo.

---

## Pendências e perguntas abertas

- [x] **Fazer o teste com os amigos.** Feito em 2026-07-21: 6 pessoas,
      sincronia perfeita. Fechou a Etapa 2.
- [ ] **Ver se eles voltam sozinhos.** O que sobrou da tarefa acima, e
      agora é ela a mais importante da lista. Não marcar a próxima
      noite; deixar a semana passar e olhar `sala_membros.visitas`.
- [ ] **O projeto ainda não tem nome.** O endereço público ficou `2gether`
      porque `together` já estava tomado no Fly e era preciso escolher algo
      pra deployar — **não é uma decisão de nome do projeto**. Fica
      registrado o risco levantado na hora: `2gether` é quase o nome do
      concorrente direto que o README usa como contraste (Watch2Gether), e
      a leitura provável de quem recebe o link é "é tipo o Watch2Gether".
      Se o grupo escolher um nome de verdade, trocar cedo custa menos.
      Pedido genérico ao grupo já falhou uma vez; tentar completar frase
      ("a gente se encontra no ___").
- [ ] **Moderação do lobby.** O lobby é onde estranhos se encontram — é ele
      que transforma moderação de problema teórico em problema de dia um.
- [ ] **O editor de boneco não cabe na tela — nos dois lugares.** Achado
      testando no navegador, em 2026-07-21.

      Dentro da sala, o `#painel` flutuante (`sala.html`) tem largura fixa
      de 200px e **nenhum teto de altura nem rolagem**: as cinco camadas
      empilhadas passam da altura do chão e o fim do editor fica
      inalcançável. Na home (`index.html`), a coluna do editor estica até
      encostar no topo e domina a página.

      A causa é a mesma nos dois: o editor cresce linearmente com o número
      de camadas × (seletor de peça + paleta de cores), e hoje são 5
      camadas com paletas de até 10 cores. **Acrescentar peça piora.**

      **Decidido esperar a arte definitiva antes de mexer.** O layout certo
      depende de quantas peças e cores vão existir de verdade, e do
      tamanho final do preview — remendar agora seria refazer depois. Vale
      resolver junto com o editor de retoque, que é o item abaixo.

      Caminhos, pra não redescobrir: abas por camada em vez de tudo
      empilhado; paleta em popover em vez de grade sempre aberta; ou o
      painel da sala com `max-height` e rolagem, que é o remendo mínimo se
      a arte demorar.
- [ ] **Tirar a buzina — combinado desde o dia em que entrou.** Ela nasceu
      pra um uso específico: o autor no escritório, com colegas e chefe na
      mesma sala, todos de música com a aba escondida — em vez de mandar
      WhatsApp por algo urgente, aperta o botão e todo mundo olha a aba.
      Fora desse contexto é só um botão que faz barulho na máquina alheia.
      Tem teto de 10 por 40s (ver decisões travadas), mas teto não resolve
      o problema de fundo, que é não ter dono: **qualquer um buzina pra
      qualquer um**. Se for pra ficar, precisa virar outra
      coisa — menção com @, ou aviso só pra quem escolheu receber. Pra
      remover: `BuzinaIn` no `protocol.py`, o ramo no `main.py`,
      `Room.buzinar`, e o botão + `tocarBuzina`/`chamarAtencao` no
      `sala.js`.
- [ ] **Screenshots no README.** Faltam; o README de portfólio ganharia muito.
- [ ] **Reintroduzir o editor de pixel como retoque.** Decidido: ele não é
      pra desenhar do zero (a 32×48 são 1.536 pixels, ninguém faria), e sim
      pra **editar por cima de uma peça pronta** — mudar uma cor, acrescentar
      um detalhe. Foi retirado na troca de arte porque o editor antigo
      trabalhava em cima do sprite gerado por código, que deixou de existir.
      O novo precisa abrir uma peça do catálogo e salvar a versão editada
      como peça própria do usuário. Amadurecer o formato depois que a arte
      de verdade chegar.
- [ ] **Moderação.** O editor livre permite desenhar qualquer coisa. Entre
      amigos é problema teórico; numa sala aberta vira problema no primeiro
      dia. Precisa de resposta antes de qualquer abertura ao público.

---

## O que já foi feito

Ordem cronológica, com o commit correspondente. Serve pra saber o que **não**
precisa ser refeito.

### Etapa 1 — sala, chat e contas · `440594e`

- [x] Servidor FastAPI com WebSocket; mensagens validadas por Pydantic
- [x] Sala em memória, criada na hora que alguém entra; código vem do nome
- [x] Chat com balão sobre a cabeça e histórico lateral
- [x] Movimento previsto no cliente, com interpolação e ordenação por
      profundidade
- [x] Reconexão automática com espera crescente
- [x] Contas com senha por scrypt, sessão por cookie httponly
- [x] Identidade do WebSocket vinda do cookie (a mensagem de "join" com nome
      foi eliminada)
- [x] Limite de tentativas de login por IP; resposta e tempo iguais pra
      usuário inexistente
- [x] Trocar apelido e senha; trocar senha derruba as outras sessões
- [x] Guarda-roupa de até 12 looks, isolado por conta
- [x] Estética Win98 em CSS puro
- [x] Deploy pro Fly.io configurado: Dockerfile, `fly.toml` com volume,
      `PORT` e `DB_PATH` por variável de ambiente, cookie `secure` conforme
      o protocolo
- [x] Repositório público com README de portfólio

### Documentação · `5694400`

- [x] Este plano, com as decisões e seus motivos

### Etapa 3 (parcial) — sprites em camadas · `ae44828`

- [x] `sprites.js`: carregamento, recoloração por matiz preservando a
      claridade, e cache
- [x] `avatar.js` reescrito pra compor 5 camadas de imagem
- [x] Pulo com sombra que encolhe
- [x] `/api/pecas` monta o catálogo lendo a pasta de sprites
- [x] Modelo do avatar no Pydantic trocado pra peça + cor por camada, com
      nome de peça validado (barra travessia de caminho)
- [x] Editor adaptado: peças e cores das 5 camadas
- [x] Escalas ajustadas: sala 2×, editor 3×, listas 1×
- [x] `gerar_placeholders.py` — camadas de andaime pra testar sem a arte final
- [x] `conferir_sprites.py` — valida tamanho, transparência, suavização,
      encaixe perna/sapato e número de cores
- [x] Removidos o editor pixel a pixel e o template de 8×14, que dependiam do
      sprite gerado por código

### Lobby, lista de salas e deploy

- [x] Lobby: sala oficial `lobby`, criada no boot do `RoomManager`, imune à
      faxina de salas vazias, teto de 30 contra 12 da sala comum
- [x] `Room.resumo()` e `/api/salas` — presença, não nota (ver decisão
      travada). Exige sessão: a lista revela quem está onde
- [x] Lista na home com os avatares renderizados, recarregando a cada 8s e
      só com a aba visível
- [x] Botões `lobby`, `salas` e `✕` na barra de título da sala
- [x] Deploy no Fly: app `2gether`, volume `dados` em `gru`, build remoto
- [x] **Persistência verificada de verdade:** conta criada, máquina
      reiniciada, login continuou funcionando

### Bugs achados e corrigidos

Todos apareceram rodando, nenhum aparecia lendo o código:

- Balão de fala sem a setinha apontando pra cabeça de quem falou; junto, o
  `text-align: center` herdado do `.pessoa` deixava a última linha de um
  balão de várias linhas boiando no meio
- Bonequinhos da lista de salas vazando 20px pra cima, por cima da legenda
  do fieldset: o canvas do sprite tem 51px (48 do boneco + folga do pulo) e
  a faixa tinha 26px
- Título da sala mostrava o texto cru digitado enquanto o chat mostrava o
  slug — "teste de QA" contra "teste-de-qa". Agora os dois vêm do código
  canônico que o servidor devolve no `bemvindo`

- Balão de fala saía uma letra por linha (`max-width` não resolve contra um
  pai de 32px; precisa de `width: max-content`)
- Painel do boneco abria sozinho e vazio (`display:flex` do `.win` ganhava do
  atributo `hidden`)
- Cabeça cortada ao andar (o canvas não tinha folga no topo pro pulo)
- Primeiro desenho de cada boneco saía vazio (a função de camada só devolvia
  resultado assíncrono; quem desenha uma vez ficava com o boneco invisível)
- `setPointerCapture` antes do primeiro traço no editor de pixel
- Coluna do guarda-roupa estourando o painel (`white-space: nowrap` no botão)

---

## Armadilhas que valem pra tudo

- **Rodar antes de afirmar.** Vários bugs deste projeto só apareceram no
  teste: a cabeça cortada ao andar, o balão de fala saindo uma letra por
  linha, o painel que abria vazio. Nenhum aparecia lendo o código.
- **Cache do navegador em `file://` e no preview engana.** Já aconteceu de
  edição de CSS parecer não ter efeito. Forçar render limpo antes de concluir
  que algo não funcionou.
- **⚠ Deploy que chega pela metade é o bug mais traiçoeiro que este
  projeto teve.** Aconteceu de verdade: recurso novo no ar, servidor
  entregando o arquivo certo, e na tela o botão existindo e não fazendo
  nada. O navegador revalida o documento principal quando a pessoa
  recarrega, mas reusa os subrecursos do cache — dava **HTML novo com
  `sala.js` velho**. Não aparece em nenhum teste local, porque local o
  cache está sempre quente com o código atual. Agora o endereço do código
  carrega o hash do conteúdo (ver decisões travadas), o que fecha a porta.
  **Se um recurso novo "não funciona" pra alguém mas funciona pra você, a
  primeira suspeita é essa** — e o jeito rápido de confirmar é pedir o
  resultado de `typeof window.sala` no console: `"undefined"` significa
  código velho.
- **PowerShell expande `*` em argumento.** Passar `--forwarded-allow-ips '*'`
  quebra; usar a variável de ambiente `FORWARDED_ALLOW_IPS` no lugar.
- **`flyctl ssh console -C` quebra o comando por espaço.** Não adianta
  brigar com aspas: pra rodar algo com espaços na máquina do Fly, use um
  comando de token único (`rm -f /caminho`) ou abra sessão interativa.
- **Testar disponibilidade de um domínio envenena o cache do DNS.** A
  consulta a `2gether.fly.dev` antes de o app existir deixou o NXDOMAIN
  cacheado, e o site "não abria" depois do deploy. `Clear-DnsClientCache`
  resolve.
- **O deploy do Fly avisa que a app não está escutando, e mente.** É corrida
  entre o check e o uvicorn subir. Confira `flyctl logs` antes de investigar.
- **Não commitar `dados.sqlite3`.** Tem hash de senha. Já está no
  `.gitignore`, mas conferir antes de qualquer push.
