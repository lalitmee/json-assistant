<div align="center">
  <h1>JSON Assistant</h1>
  <p>A focused workspace for editing and inspecting JSON.</p>

  <img src="docs/screenshots/theme-cobalt2-dark.png" width="80%" alt="JSON Assistant using the Cobalt2 theme">
</div>

A browser-based workspace for inspecting and editing one JSON document at a time. Try the [hosted app](https://json-assistant-one.vercel.app/).

## Features

- Edit JSON in Code and browse or search it in Tree. Tree editing is off by default and can be enabled in Settings.
- Open or paste a document, format or minify it, undo or redo edits, copy paths or subtrees, and download the source.
- Choose editor fonts, color themes, and light/dark appearance.
- Process documents in the browser. The host serves the app and its static assets; the app does not upload JSON documents to a backend.

## Themes and fonts

<details>
<summary>Compare all themes in light and dark mode</summary>

| Theme | Editor font | Light | Dark |
| --- | --- | --- | --- |
| Tokyo Night | JetBrains Mono | <img src="docs/screenshots/theme-tokyo-night-light.png" width="100%" alt="Tokyo Night theme in light mode"> | <img src="docs/screenshots/theme-tokyo-night-dark.png" width="100%" alt="Tokyo Night theme in dark mode"> |
| Catppuccin | Iosevka Mono | <img src="docs/screenshots/theme-catppuccin-light.png" width="100%" alt="Catppuccin theme in light mode"> | <img src="docs/screenshots/theme-catppuccin-dark.png" width="100%" alt="Catppuccin theme in dark mode"> |
| Rosé Pine | Cascadia Code | <img src="docs/screenshots/theme-rose-pine-light.png" width="100%" alt="Rosé Pine theme in light mode"> | <img src="docs/screenshots/theme-rose-pine-dark.png" width="100%" alt="Rosé Pine theme in dark mode"> |
| Solarized | Fira Code | <img src="docs/screenshots/theme-solarized-light.png" width="100%" alt="Solarized theme in light mode"> | <img src="docs/screenshots/theme-solarized-dark.png" width="100%" alt="Solarized theme in dark mode"> |
| VS Code Dark+ | System default | <img src="docs/screenshots/theme-vscode-dark-plus-light.png" width="100%" alt="VS Code Dark+ theme in light mode"> | <img src="docs/screenshots/theme-vscode-dark-plus-dark.png" width="100%" alt="VS Code Dark+ theme in dark mode"> |
| GitHub | JetBrains Mono | <img src="docs/screenshots/theme-github-light.png" width="100%" alt="GitHub theme in light mode"> | <img src="docs/screenshots/theme-github-dark.png" width="100%" alt="GitHub theme in dark mode"> |

</details>

## Run locally

Requires Node.js 22.12 or newer and pnpm 10.24.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. JSON documents remain in the current browser session; they are not automatically saved or recovered. Export important work before closing or refreshing the page.

## Development checks

```sh
pnpm check       # Svelte and TypeScript checks
pnpm test        # Unit tests
pnpm test:e2e    # Browser tests in Chromium and Firefox
pnpm build       # Production build
pnpm benchmark   # Generated browser fixtures; output is gitignored
```

## Limits and privacy

Processing is client-side; serving the site still requires normal requests for the app and its assets. The app has no account or cloud-document workflow, and does not automatically persist document content. Browser memory and responsiveness vary by device and document shape; benchmark sizes are test inputs, not quotas or support promises. Documents above 100,000 scanner tokens use a read-only tree that loads branches in pages and renders the visible rows. Formatting and minifying are unavailable in this mode. The viewer still parses the full source in a worker, and the 256-level nesting limit applies. See the [historical release verification](docs/verification/2026-10-17-release.md) for earlier browser measurements. Do not treat the app as unlimited-size storage or the sole copy of important data.

## Project documentation

- [Design specification](docs/superpowers/specs/2026-10-17-json-workspace-design.md)
- [Settings and themes](docs/superpowers/specs/2026-10-18-settings-and-themes-design.md)
- [Release notes](docs/releases/0.2.2.md) · [0.2.1](docs/releases/0.2.1.md) · [0.2.0](docs/releases/0.2.0.md)
- [Research](docs/research/2026-10-17-json-tools.md)
- [Roadmap](docs/roadmap.md)

## License

No project-level license is currently provided. Public visibility does not grant permission to reuse or distribute the source.
