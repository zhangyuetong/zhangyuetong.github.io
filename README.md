# zhangyuetong.github.io

Personal Jekyll blog with KaTeX math support and HTML mini-games.

Live site: [https://g.zhenran.net](https://g.zhenran.net)

## Local development

Requirements: Ruby 3.x, Bundler

```bash
bundle install
bundle exec jekyll serve --livereload
```

Open [http://localhost:4000](http://localhost:4000).

## Project structure

| Path | Purpose |
|------|---------|
| `_posts/` | Blog posts (Markdown) |
| `_games/` | Game entry pages (Jekyll collection) |
| `assets/games/<id>/` | Self-contained HTML game files |
| `_site_pages/` | Static pages (about, archives) |
| `_layouts/` | Page templates |
| `_includes/` | Reusable components |
| `_data/navigation.yml` | Top navigation items |

## Add a new post

Create `_posts/YYYY-MM-DD-slug.md`:

```markdown
---
layout: post
title: "My Post"
date: 2026-07-28
math: true
---

Your content. Inline math: $a^2 + b^2 = c^2$

$$
\int_0^\infty e^{-x} \, dx = 1
$$
```

## Add a new game

1. Put the game files in `assets/games/my-game/` (must include `index.html`)
2. Create `_games/my-game.md`:

```markdown
---
title: My Game
description: Short description for the card.
game_url: /assets/games/my-game/index.html
game_mode: embedded
---
Optional intro text shown above the iframe.
```

3. Push to `main` — GitHub Actions deploys automatically.

### Game display modes (`game_mode`)

| Mode | Value | Behavior |
|------|-------|----------|
| Blog embedded | `embedded` (default) | Blog header/nav, title, description, game in a card iframe — looks like a site page |
| Standalone | `standalone` | Full-screen game only — no blog header, nav, footer, or site styles; suitable for WeChat share links |

Examples:

- [`_games/demo-snake.md`](_games/demo-snake.md) — `game_mode: embedded`
- [`_games/demo-snake-wechat.md`](_games/demo-snake-wechat.md) — `game_mode: standalone` (share `/games/demo-snake-wechat/` in WeChat)

For WeChat, share the standalone entry URL (e.g. `https://g.zhenran.net/games/demo-snake-wechat/`). Users see only the game UI.

## Deployment

- Workflow: `.github/workflows/deploy.yml`
- Trigger: push to `main`
- After first deploy, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**

## Extending the site

- **New nav item**: edit `_data/navigation.yml`
- **New section (e.g. projects)**: add a collection in `_config.yml`, create `_projects/`, add a card block in `_layouts/home.html`
- **Comments**: add an include in `_layouts/post.html` (utterances, giscus, etc.)
- **Dark mode**: CSS variables in `assets/css/main.scss` are ready for a theme toggle
