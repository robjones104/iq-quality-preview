# iQ Quality — Working Context

UX prototype for Allegion SAT iQ Quality L4 portal redesign. App lives in `app/`. All data is mocked in `app/data/`.

## Stack

Next.js 16 · TypeScript · Ant Design v5 · Zustand · pnpm 10 · Node 24

## Key conventions

- Use Ant Design tokens and built-in component variants — no inline color overrides
- G2 chart config: flat props only (`labelFill`, `gridStroke`) — nested style objects silently become booleans in G2 v5
- Order type derived from `jobNo` prefix: `SO` = Sales Order, `WO` = Work Order
- DFO LIN and EL LIN are SO-only fields — hide on WO events and orders

## Running

```bash
cd app && pnpm dev
```
