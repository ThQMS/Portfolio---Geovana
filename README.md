# Portfólio — Geovana Zys

Portfólio pessoal de **Geovana Zys** — Analista de Testes / QA, com pós-graduação em **Engenharia de Qualidade de Software** (Bookplay) e em **Segurança Ofensiva e Inteligência Cibernética** (FACINT). Também desenvolve aplicativos mobile em Flutter.

Interface com estética de IDE/terminal em **preto e roxo**, com toques gótico-fofos: morceguinhos que acompanham o cursor, um gatinho preto espiando no canto e uma entrada em que um **enxame de morcegos revela a página**. Inclui globo 3D de ferramentas de QA e segurança, timeline de experiência em estilo `git log` e alternância de idioma PT/EN.

> Toda a arte (morcegos, gato, ícones) é original, desenhada em canvas/SVG — nada de personagens de terceiros.

🌐 **Site:** https://thqms.github.io/Portfolio---Geovana/

🔗 **LinkedIn:** [Geovana Zys](https://www.linkedin.com/in/geovana-zys-039a48216) · **E-mail:** geovana.bragafzys@gmail.com

## Tecnologias

- **HTML + CSS (Tailwind, build estático)** — layout, tokens de cor e utilitários
- **JavaScript (vanilla)** — máquina de escrever do terminal, scroll-reveal, navegação por teclado, alternância PT/EN, morcegos e gato
- **Three.js** (via CDN) — globo 3D interativo de ferramentas (CSS3DRenderer + OrbitControls)
- **Lucide** — ícones da interface
- **Devicon** — ícones de tecnologias no globo
- **Geist / Geist Mono** — tipografia
- **mailto** — o formulário de contato abre o cliente de e-mail com a mensagem pronta (sem backend)

## Idiomas

O site é **PT-BR por padrão** com um botão **PT / EN** no canto superior esquerdo. A escolha fica salva no navegador e troca todos os textos na hora, sem recarregar.

## Estrutura

```
index.html
assets/
  css/                # estilos (tema, componentes, efeitos)
  js/                 # interações, globo 3D, efeitos, entrada, morcegos/gato
  fonts/              # fontes locais
```

## Rodando localmente

Como usa caminhos relativos e módulos ES, sirva por um servidor local (não abra via `file://`):

```bash
python -m http.server 8000
# depois acesse http://localhost:8000
```

## Deploy

Site estático, pronto para **GitHub Pages**. Com o repositório publicado, basta ativar o Pages apontando para a branch principal / raiz.

---

© 2026 Geovana Zys. Todos os direitos reservados.
