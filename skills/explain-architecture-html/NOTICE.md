# Upstream tools and notices

This skill uses the following upstream tools. Their code, templates, and authoring references are fetched into a task-local directory; they are not bundled as complete tool checkouts in this package.

- [Archify](https://github.com/tt-a1i/archify): MIT License. Copyright (c) 2026 tt-a1i (Archify); Copyright (c) 2025 Cocoon AI. The full license is retained in [references/licenses/archify.txt](references/licenses/archify.txt).
- [Answer me with HTML](https://github.com/QingYunA/answer-me-with-html): MIT License. Copyright (c) 2026 Answer me with HTML contributors. The full license is retained in [references/licenses/answer-me-with-html.txt](references/licenses/answer-me-with-html.txt).

The supported upstream revisions are recorded in [scripts/toolchain.json](scripts/toolchain.json). The display adapters target those revisions and modify task-local renderer copies or generated explanation pages.

Archify's MIT license covers its own code. It also records separate terms for embedded fonts and optional third-party brand marks in [its third-party notices](references/licenses/archify-third-party-notices.md). The embedded JetBrains Mono font's [SIL Open Font License](references/licenses/JetBrainsMono-OFL.txt) is retained here. Preserve those terms when distributing applicable generated assets; the MIT license does not replace individual logo licenses or trademark rights.

Retain the applicable upstream copyright and permission notices when redistributing generated HTML or copies of upstream code/templates. Keep these notices with the skill when installing it or copying it into another repository.
