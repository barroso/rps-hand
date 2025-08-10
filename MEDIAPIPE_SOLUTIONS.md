### MediaPipe Solutions — Visão geral prática (voltada para este projeto)

Este documento resume os conceitos essenciais do MediaPipe Solutions e como eles se conectam ao uso do Hands neste projeto (detecção de gestos para pedra/papel/tesoura), além de apontar caminhos para migrar para as APIs mais novas quando fizer sentido.

### O que é o MediaPipe

- **MediaPipe** é um conjunto de soluções de visão computacional e ML otimizadas para tempo real (mãos, face, pose, etc.), com implementações multiplataforma.
- No ecossistema atual, há duas famílias principais:
  - **Soluções “clássicas”** (ex.: `@mediapipe/hands`), usadas aqui via CDN. São leves e prontas para uso, com callbacks por frame.
  - **MediaPipe Tasks** (ex.: Hand Landmarker), a nova geração com APIs unificadas e modelos atualizados. Disponível para Web (WASM/WASM+SIMD), Android, iOS e desktop.

### MediaPipe Hands (clássico) — como funciona

No browser, o `Hands` retorna, por frame, um conjunto de landmarks por mão detectada. Cada mão tem:

- `landmarks` em coordenadas normalizadas 2D da imagem (x, y em [0,1]) e um `z` relativo (profundidade aproximada, não calibrada).
- `multiHandLandmarks` (array de mãos), `multiHandedness` (esquerda/direita com score), e opcionalmente conexões (`HAND_CONNECTIONS`) para desenho.

Parâmetros importantes ao configurar `Hands`:

- `maxNumHands`: quantas mãos no máximo detectar.
- `modelComplexity`: 0/1/2. Maior complexidade = mais precisão, menos FPS.
- `minDetectionConfidence`: confiança mínima para DETECTAR uma mão nova.
- `minTrackingConfidence`: confiança mínima para RASTREAR uma mão já detectada.

Exemplo mínimo (o projeto já utiliza algo equivalente):

```html
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
<script>
const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.65,
  minTrackingConfidence: 0.65
});
hands.onResults(onResults);
// a cada frame, enviar imagem: hands.send({ image })
</script>
```

### Índice dos 21 landmarks de mão

Para gestos, é essencial saber “quem é quem” nos 21 pontos. Padrão do MediaPipe Hands:

```text
0: wrist
1: thumb_cmc    2: thumb_mcp    3: thumb_ip    4: thumb_tip
5: index_mcp    6: index_pip    7: index_dip    8: index_tip
9: middle_mcp  10: middle_pip  11: middle_dip  12: middle_tip
13: ring_mcp   14: ring_pip    15: ring_dip    16: ring_tip
17: pinky_mcp  18: pinky_pip   19: pinky_dip   20: pinky_tip
```

Notas úteis:

- `x` cresce para a direita, `y` cresce para baixo. Valores são normalizados ao tamanho da imagem.
- `z` é relativo e não calibrado; útil para ordenar pontos (mais perto/longe), mas não para medir profundidade real.
- Há também “world landmarks” em alguns Tasks (3D em mm aproximados) — não estão disponíveis no Hands clássico para Web.

### Dicas para robustez de gestos

- Prefira heurísticas geométricas que combinem:
  - ângulo de curvatura (por exemplo, no PIP: relação entre vetores tip→PIP e MCP→PIP),
  - distâncias relativas ao punho/centro da palma (p. ex., ponta mais perto do centro da palma indica dobra),
  - e suavização temporal (maioria nos últimos N frames).
- Evite depender de `z` para decisões finas (escala/ruído variam por dispositivo).
- Iluminação frontal e enquadramento central reduzem falhas de detecção.
- Se usar câmera frontal, atenção ao espelhamento. Se desenhar landmarks/filtros, garanta consistência entre imagem e pontos.

### Performance e qualidade

- Reduza a resolução do vídeo ou desative efeitos visuais pesados se o FPS cair.
- `modelComplexity: 0` aumenta FPS, mas pode reduzir estabilidade; `1` é um bom compromisso; `2` melhora mais a precisão.
- Ajuste `minDetectionConfidence` e `minTrackingConfidence` para equilibrar sensibilidade a perdas/oscilações.

### MediaPipe Tasks (novo) — Hand Landmarker

Para projetos novos ou que precisem de modelos mais recentes e API unificada, considere o **Hand Landmarker** das MediaPipe Tasks.

Benefícios:

- Modelos atualizados e padronização entre plataformas (Web, Android, iOS, desktop).
- Opções avançadas (ex.: handness, landmarks 3D/world quando disponível, quantização WASM+SIMD).

Pontos de atenção na Web:

- Requer carregar o runtime `@mediapipe/tasks-vision` (WASM). Com SIMDe/ou WebGPU (quando suportado) pode ganhar performance.
- A API é diferente do Hands clássico (instanciação do `Vision`, criação do `HandLandmarker`, etc.).

Referências oficiais:

- Documentação MediaPipe Solutions: [Página principal do MediaPipe](https://developers.google.com/mediapipe)
- Hands (clássico, Web): [Hands Solution (Web)](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker#legacy)
- MediaPipe Tasks (Hand Landmarker): [Hand Landmarker (Tasks)](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)

### Quando migrar do Hands clássico para Tasks

Considere migrar se você precisa de:

- Melhor compatibilidade cross‑plataforma e manutenção futura.
- Acesso a recursos de runtime mais modernos (SIMD, WASM acelerado, WebGPU quando disponível).
- API consistente com outras soluções (pose, face, etc.) do ecossistema Tasks.

Se o foco é um app Web simples com baixa dependência externa e máximo de leveza, o Hands clássico via CDN continua sendo uma boa opção.

### Boas práticas de produção

- Sirva via HTTPS/localhost para acesso à câmera.
- Mostre mensagens claras de permissão/erros para o usuário.
- Ofereça fallback de vídeo de teste para depuração (o projeto já oferece).
- Faça throttling de logs e desative debug visual em produção para economizar CPU.


