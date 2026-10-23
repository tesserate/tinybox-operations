# Tinybox Operations

Interactive prototype for Tinybox tasks, quotes and orders, production, inventory, presets, and people.

**Live prototype:** https://tinybox-operations-v2.sleeps.chatgpt.site/

This is a browser-only prototype with sample data, not a connected operational database. Business changes are session-local; do not use it to maintain real orders or inventory.

## Run locally

Requires Python 3. No package installation is needed.

```sh
python3 src/build.py
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. The prebuilt `dist/index.html` is also included.

## Edit the prototype

- `src/app-base.js`: core application and sample data.
- `src/*.js` and `src/*.css`: feature extensions, including timelines, orders, inventory, people, and fulfillment.
- `src/build.py`: combines the base and extensions into the final page.
- `src/frame-base.html`, `src/wrapper-original.html`, and `src/viewport-host.js`: page shell, isolated iframe, and viewport handling.
- `src/app-built.js`, `src/frame-built.html`, and `dist/index.html`: generated output; rebuild after editing source.

Preserve the iframe sandbox and both Content Security Policies. The build checks that they remain unchanged.

For a JavaScript syntax check, with Node.js installed:

```sh
node --check src/app-built.js
```

## Main workflows

Tasks share list and timeline views, including production and person filters. Timeline stages span their subtasks, and date changes require confirmation.

Quotes combine option presets into material and labour requirements. A 3PL order task commits selected quantities; dispatch deducts on-hand stock. Partial orders and dispatches are supported in the prototype.

## Hosting

The site serves the static `dist` directory. `.openai/hosting.json` identifies the existing Sites project. A GitHub push shares source code; it does not automatically update the live site.
