# iQ Quality UX Prototype

UX prototype for the Allegion SAT iQ Quality L4 portal redesign. Built by Rob Jones (contracted UX designer). **Work in progress — code has not been reviewed for production use.**

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Components | Ant Design v5 |
| State | Zustand |
| Package manager | pnpm 10.x |
| Node | 24.x |

All data is mocked. No backend or authentication.

---

## Running locally

```bash
cd app
pnpm install
pnpm dev
```

Opens at [http://localhost:3000](http://localhost:3000).

---

## Structure

```
app/
├── app/(main)/        # Pages — dashboard, events, orders, escalations, manage
├── components/        # Shared UI components
├── data/              # Mock data and types
├── hooks/             # React hooks
├── lib/               # Theme and nav config
└── store/             # Zustand stores
```

---

## Status

Active UX prototype. Screens in progress: Dashboard, Events, Orders, Escalations. Mock data throughout — replace with real API calls when integrating.
