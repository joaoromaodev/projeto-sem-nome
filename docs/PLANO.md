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

Etapa 1 concluída e testada. Repositório público em
`github.com/joaoromaodev/projeto-sem-nome`.

**Funciona:**

- Conta com apelido e senha (scrypt), sessão por cookie httponly
- Sala em tempo real por WebSocket; entra pelo nome
- Bonequinho anda (setas, WASD, clique no chão) com ordenação de profundidade
- Chat com balão de fala sobre a cabeça
- Editor de avatar em 2 abas: peças (5 camadas, cores livres) e
  guarda-roupa de até 12 looks
- Ferramentas de exportar, reimportar e validar sprites
- Configuração de deploy pro Fly.io pronta (não deployado ainda)

- Sprites de 32x48 em 5 camadas, com recoloração que preserva o sombreado,
  pulo com sombra, e catálogo de peças lido da pasta `static/sprites/`

**Não funciona ainda:** YouTube, compartilhamento de tela, histórico da sala.

**A arte atual é provisória.** `ferramentas/gerar_placeholders.py` gera
camadas de andaime pra o sistema ficar testável. Quando os sprites de
verdade chegarem, é sobrescrever os arquivos em `static/sprites/` e apagar
esse script — nenhum código muda.

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

- [ ] Carregar a YouTube Iframe API e montar o player na sala
- [ ] Estado do vídeo em `rooms.py` (id, tocando, posição, timestamp)
- [ ] Mensagens novas no `protocol.py`: `video_por`, `video_play`,
      `video_pause`, `video_seek`, `video_estado`
- [ ] Fila de vídeos por sala (adicionar, remover, pular)
- [ ] Papel de host: só quem tem o controle manda no player
- [ ] Heartbeat do servidor a cada ~3s com a posição canônica
- [ ] Correção de deriva no cliente (ver armadilha 2 abaixo)
- [ ] Tela de "clique pra entrar" resolvendo o autoplay (armadilha 3)
- [ ] Aviso no chat quando alguém está carregando (armadilha 4)
- [ ] Contador `musicas_ouvidas` da sala (já existe o campo, falta incrementar)

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

O que fecha a tese. Hoje a sala some quando o servidor reinicia.

- [ ] Salas no banco (não só em memória)
- [ ] Histórico: o que já tocou ali
- [ ] Contador visível ("342 músicas ouvidas aqui")
- [ ] Favoritos do grupo
- [ ] Membros: quem frequenta, com avatar apagadinho pra quem está offline
- [ ] Decoração da sala

Esse conjunto é o que faz alguém abrir o site sem motivo específico — que é
exatamente o comportamento que o projeto quer.

---

## Pendências e perguntas abertas

- [ ] **Fazer o teste com os amigos.** É a tarefa mais importante da lista.
- [ ] **O projeto não tem nome.** Já foi pedido ao grupo, sem retorno. Pedido
      genérico não funciona; tentar completar frase ("a gente se encontra
      no ___").
- [ ] **`fly deploy` ainda não foi rodado.** Config pronta.
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

## Armadilhas que valem pra tudo

- **Rodar antes de afirmar.** Vários bugs deste projeto só apareceram no
  teste: a cabeça cortada ao andar, o balão de fala saindo uma letra por
  linha, o painel que abria vazio. Nenhum aparecia lendo o código.
- **Cache do navegador em `file://` e no preview engana.** Já aconteceu de
  edição de CSS parecer não ter efeito. Forçar render limpo antes de concluir
  que algo não funcionou.
- **PowerShell expande `*` em argumento.** Passar `--forwarded-allow-ips '*'`
  quebra; usar a variável de ambiente `FORWARDED_ALLOW_IPS` no lugar.
- **Não commitar `dados.sqlite3`.** Tem hash de senha. Já está no
  `.gitignore`, mas conferir antes de qualquer push.
