---
sidebar_position: 2
---

# Online Demo

The online demo runs the whole of Arch Register inside your browser, with no server behind it. It opens
signed in as an administrator and comes with a sample workspace, so you can explore the catalog, projects and
diagrams straight away.

The demo is meant for exploring. Keep these limits in mind:

- **Data stays in your browser.** Changes are saved to this browser a couple of seconds after you make them, so they
  survive a reload. They are never sent anywhere, and clearing site data removes them. Use **Global Settings → Demo
  data → Reset demo** to start over with the sample data. If you open the demo in several tabs, the tab that saves last
  wins.
- **No real-time collaboration.** Diagrams are saved explicitly.
- **No AI assistant, email, webhooks, automation or background jobs.**
- **No real security.** Sign-in is automatic and passwords are not protected, so do not enter sensitive data.

Open the demo at [`/diagram-craft/arch-register-demo/`](pathname:///diagram-craft/arch-register-demo/).

## Run it locally

From the repository root:

```bash
pnpm install
pnpm ar:demo:dev        # development server with hot reload
```

To try the static build that is published online:

```bash
pnpm ar:demo:build      # builds the static site into arch-register-packages/web/dist
pnpm ar:demo:preview    # serves the build locally
```

The sample workspace is created in your browser on first load (about a second) and restored from the saved copy
afterwards. A saved copy from an older build of the demo is discarded automatically. To host the
output under a subpath, set `VITE_DEMO_BASE` when building, for example
`VITE_DEMO_BASE=/my/path/ pnpm ar:demo:build`. Without it, the build works from any location.
