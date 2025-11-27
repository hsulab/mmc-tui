# core

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/index.ts
```

## Configuration

You can override defaults by creating `~/.config/molcrafts/config.toml`:

```toml
[backend]
backend_url = "http://127.0.0.1:8000"

[ui]
# Choose the spinner size shown in workflow panes
spinner_size = "tiny" # tiny | medium | large
```

This project was created using `bun create tui`. [create-tui](https://git.new/create-tui) is the easiest way to get started with OpenTUI.
