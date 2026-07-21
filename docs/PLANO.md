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

Etapa 1 concluída e testada. Etapa 2 (YouTube sincronizado) com o código
todo pronto — falta só o teste com gente de verdade, que é o critério de
saída dela. Lobby e lista de salas prontos. **No ar em
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
- Sprites de 32×48 em 5 camadas, com recoloração que preserva o sombreado,
  pulo com sombra, e catálogo de peças lido da pasta `static/sprites/`
- Editor de avatar em 2 abas: peças (5 camadas, cores livres) e
  guarda-roupa de até 12 looks
- Ferramentas de gerar camadas provisórias e validar sprites
- Deploy no Fly.io rodando, com volume persistente verificado
- YouTube sincronizado pelo servidor, com correção de deriva; controle
  remoto como objeto da sala; fila de vídeos; título de cada vídeo pelo
  oEmbed, sem chave de API
- Móveis na sala: uma TV de tubo (com o vídeo rodando dentro da tela dela,
  e tela verde quando não tem nada) e um sofá de 3 lugares, com a mesma
  regra de profundidade dos bonecos
- Balão de "está digitando" com três pontinhos sobre a cabeça
- Buzina que toca um som e pisca o título pra chamar quem está com a aba
  escondida — **temporária**, ver a nota nas pendências
- Barra de digitar atravessando o rodapé, conversa ocupando a coluna
  direita inteira, e a lista de nomes trocada por cabecinha + número
- Volume individual, com mudo e memória entre visitas

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

1. **Marcar a noite com a galera.** O deploy já está feito e o link é
   <https://2gether.fly.dev>. Ver "A pergunta que ainda não foi respondida"
   logo abaixo — continua sendo a tarefa mais importante da lista.
2. **Receber as 5 camadas de arte** e validar com
   `python ferramentas/conferir_sprites.py`. O usuário estava produzindo a
   partir de uma base de 27×46 que ia expandir pra 32×48.
3. **Etapa 5 — a sala persistente.** Com a Etapa 2 fechada em código, esta
   passou a ser a maior fatia de trabalho restante, e é a que fecha a tese.
   A Etapa 4 (WebRTC) segue por último de propósito.

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

**NÃO verificado visualmente:** a sala com os bonecos novos em movimento. O
painel de preview mantinha a aba com `visibilityState: "hidden"`, e o
`requestAnimationFrame` não dispara em aba oculta — o laço nunca rodou ali.
O caminho de desenho foi conferido chamando `desenhar()` na mão, no mesmo
canvas da sala, com o avatar real da conta: as 5 camadas entram completas nas
três variações (parado, andando, virado). Ainda assim, **abrir num navegador
de verdade e confirmar é a primeira coisa a fazer.**

### ⚠ A pergunta que ainda não foi respondida

**Ninguém usou isso com os amigos de verdade ainda.** A apresentação foi
validada, o código funciona, mas nenhuma noite real aconteceu.

A pergunta que decide o projeto é: **eles voltam na semana seguinte sem
ninguém chamar?** Se a resposta for não, nenhuma quantidade de YouTube ou
WebRTC salva. Fazer esse teste vale mais que qualquer tarefa da lista abaixo.

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
| **A buzina nasce com trava, mesmo sendo temporária** | Ela toca som na máquina dos outros — a coisa mais fácil do projeto de virar brincadeira, e quem paga é quem está de fone. A trava (6s) é **por sala e não por pessoa**: o incômodo é o barulho, e pra quem ouve tanto faz se as dez buzinas vieram de um ou de dez. Limitar por pessoa deixaria a sala inteira buzinar em fila com o mesmo efeito. |
| **A buzina pisca o título além de tocar** | Só o som não resolve: metade do caso de uso é quem está com o volume baixo ou o fone tirado, e só enxerga a barra de abas. O som chama quem escuta; o título piscando chama quem só olha. Ele volta ao normal assim que a pessoa foca a aba, e desiste sozinho depois de 25s. |
| **Volume é de cada um e não passa pelo servidor** | É o único ajuste do vídeo que não exige o controle remoto. Play, pause e seek mudam o que a sala inteira vê, e por isso são disputa; volume só mexe no ouvido de quem mexeu. Quem está de fone no escritório não deveria pedir licença pra abaixar — nem estourar o som dos outros ao ajustar o seu. Fica guardado no `localStorage` porque quem abaixou por estar no trabalho vai querer baixo na próxima também. |
| **Mudo usa `mute()`, não volume 0** | Em 0 o YouTube ainda deixa passar um fiapo de som em alguns navegadores. Além disso `mute()` preserva o nível anterior, então voltar do mudo devolve o volume que a pessoa tinha escolhido em vez de chutar 100. |
| **Estático vai com `Cache-Control: no-cache`** | O `StaticFiles` responde sem nenhum cabeçalho de cache, e aí o navegador decide por heurística quanto guardar — o que significa que **um deploy pode não chegar em quem já visitou o site**: a pessoa fica com o JS antigo falando com o servidor novo. Custou uma investigação pra achar (um `export` novo do `video.js` simplesmente não existia no navegador, embora o servidor já o entregasse). `no-cache` não é "não guarde", é "guarde mas pergunte antes de usar" — e com o ETag que já vinha, a pergunta volta 304 sem corpo. |
| **"Está digitando" não carrega texto** | Só um liga/desliga. Mandar o que a pessoa escreve antes de ela apertar enter vazaria rascunho — inclusive o que ela escreveu, pensou melhor e apagou. |
| **Supabase + Vercel descartado** | Funcionaria via Supabase Realtime, mas jogaria fora o backend inteiro. Pior: a sincronia de vídeo depende do servidor ser fonte da verdade; sem servidor, seria preciso eleger um cliente como dono do relógio, e a sala dessincroniza quando ele fecha a aba. |

---

## Etapa 2 — YouTube sincronizado

A parte tecnicamente difícil do projeto. Estimativa: 5 a 7 dias.

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
apertou, que é o retorno de que funcionou); a segunda buzina seguida sendo
barrada com aviso e **não** chegando nos outros; a trava soltando depois
do intervalo; o título piscando e voltando ao normal quando a aba é
focada; e `ligado: "talvez"` sendo ignorado sem derrubar a conexão.

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

**NÃO verificado:** duas pessoas de verdade, em máquinas diferentes,
assistindo juntas. Todo o teste de sincronia foi feito com um navegador e
clientes de WebSocket em Python — o que valida o servidor e a lógica, mas
não a experiência. **É exatamente o critério de saída abaixo, e continua em
aberto.**

Também não foi testado: internet ruim de verdade (a armadilha 4 tem código,
mas nunca viu buffering real), nem celular.

### Critério de saída

Quatro pessoas em máquinas diferentes assistindo o mesmo vídeo sem perceber
dessincronia. Aqui já existe produto lançável.

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
- [x] Recoloração por matiz preservando a claridade (o sombreado sobrevive);
      pixel abaixo de 16% de claridade não é recolorido, pra o contorno
      continuar preto
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

- [ ] Salas no banco (não só em memória)
- [ ] **Sala privada por link de convite.** Decidido que é convite e não
      lista de permissões: entre amigos, gerenciar permissão é burocracia
      que ninguém usa. Depende deste item de persistência pra ter dono.
- [ ] Histórico: o que já tocou ali
- [ ] Contador visível ("342 músicas ouvidas aqui")
- [ ] Favoritos do grupo
- [ ] Membros: quem frequenta, com avatar apagadinho pra quem está offline
- [ ] "Suas salas" no lobby — as que você frequenta, que é exatamente o
      comportamento recorrente que a tese quer premiar
- [ ] Decoração da sala. **Já existe um primeiro passo**: a TV e a poltrona
      são móveis de verdade no `#chao`, com profundidade igual à dos
      bonecos. Mas a posição das duas está **fixa no CSS/JS** — não é
      estado de sala, não vem do servidor e ninguém pode mover. Virar
      decoração de verdade é justamente pôr isso no banco junto com a
      sala, que é o item de persistência aqui em cima.

Esse conjunto é o que faz alguém abrir o site sem motivo específico — que é
exatamente o comportamento que o projeto quer.

---

## Pendências e perguntas abertas

- [ ] **Fazer o teste com os amigos.** É a tarefa mais importante da lista.
      O link existe: <https://2gether.fly.dev>.
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
      Já nasceu com trava de 6s por sala (ver decisões travadas), mas trava
      não resolve o problema de fundo, que é não ter dono: **qualquer um
      buzina pra qualquer um**. Se for pra ficar, precisa virar outra
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
