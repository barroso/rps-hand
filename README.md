## Pedra, Papel e Tesoura com a mão (MediaPipe Hands)

Jogo de pedra, papel e tesoura controlado por gestos de mão usando a câmera do navegador e a biblioteca MediaPipe Hands. Faça um joinha (👍) para iniciar uma contagem regressiva de 3 segundos e, em seguida, mostre sua jogada: pedra (✊), papel (✋) ou tesoura (✌️). O app detecta sua jogada, sorteia a jogada do computador e exibe o vencedor com animações.

### Tecnologias
- MediaPipe Hands (Google) — detecção de mão e landmarks em tempo real
  - `@mediapipe/hands`
  - `@mediapipe/camera_utils`
  - `@mediapipe/drawing_utils`
- HTML5 Canvas para desenhar vídeo, contagem e overlay textual
- JavaScript (vanilla) para lógica de jogo e classificação dos gestos
- CSS (vanilla) para layout e animações

### Estrutura
```
.
├── index.html
├── assets
│   ├── css
│   │   └── app.css
│   └── js
│       └── app.js
└── README.md
```

### Como executar
1. Sirva os arquivos via HTTP (requerido por alguns navegadores para liberar a câmera):
   - macOS/Linux: `python3 -m http.server 8000`
   - Node: `npx serve` ou `npm i -g serve && serve`
2. Abra `http://localhost:8000` no navegador.
3. Clique em “Iniciar câmera” e permita o acesso.
4. Faça um joinha (👍) para iniciar a contagem de 3s.
5. Mostre pedra (✊), papel (✋) ou tesoura (✌️).

### Gestos detectados
- Joinha (👍) — inicia a rodada
  - Heurística: polegar para cima; demais dedos dobrados
- Pedra (✊) — quatro dedos dobrados
- Papel (✋) — quatro dedos estendidos
- Tesoura (✌️) — indicador e médio estendidos; anelar e mindinho dobrados

Obs.: A detecção usa regras simples sobre os landmarks do MediaPipe e uma suavização temporal para maior robustez. Luz adequada e enquadramento da mão ajudam a precisão.

### Como funciona (resumo)
- `app.js` inicializa o `Hands` do MediaPipe e recebe os landmarks por frame.
- Um buffer curto de frames classifica joinha e RPS (pedra/papel/tesoura).
- Ao detectar joinha, inicia um timer de 3s (independente do framerate).
- No “reveal”, pega a maioria das classificações dos últimos ~900ms, sorteia a jogada do computador e decide o vencedor.
- O canvas mostra contagem e um cabeçalho de texto; um overlay HTML mostra emojis, nomes das jogadas e realça o vencedor.

### Dependências via CDN
- `https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js`
- `https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js`
- `https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js`

### Dicas
- Use `localhost` ou HTTPS para que a câmera funcione.
- Se a rodada não iniciar, mantenha o joinha visível por ~0,5–1s.
- Se a jogada não for reconhecida, tente estabilizar a mão por um instante.

### Licença
Uso educacional/demonstração. MediaPipe pertence ao Google e segue sua própria licença.


