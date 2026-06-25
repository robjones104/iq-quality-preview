# Ant Design Component Audit

Migration reference for iQ Quality portal. If the design system switches (e.g. to a Stanley/Allegion org design system), this file identifies every AntD dependency, which category it falls into, and how hard it is to replace.

**Packages in use:**
- `antd` — core component library
- `@ant-design/icons` — icon set
- `@ant-design/plots` — chart library (G2 v5 wrapper)
- `@ant-design/nextjs-registry` — SSR style injection shim

---

## Replacement Difficulty Key

| Tag | Meaning |
|---|---|
| **Drop-in** | Direct equivalent in virtually every design system (Button, Input, Modal, etc.) |
| **Map** | Exists in most systems but may have API differences (Table, Select, Tabs, etc.) |
| **Custom** | Complex component — likely needs a custom build or heavy wrapper |
| **Charts** | Entire chart library swap — separate effort |
| **Tokens** | Not a component — theme/token infrastructure |

---

## Layout & Structure

| Component | Used in | Difficulty |
|---|---|---|
| `Row` / `Col` | dashboard, detail pages, cards | Drop-in |
| `Flex` | dashboard | Drop-in |
| `Grid` (`useBreakpoint`) | PageHeader, SidebarNav, ContentPadding, DateRangeFilter, FilterPanel, events, orders | **Map** — breakpoint hook is AntD-specific; replace with CSS or your DS equivalent |
| `Space` | dashboard, EscalationDetail, events | Drop-in |
| `Divider` | OrderDetail, EscalationDetail, ManageLists | Drop-in |

---

## Data Display

| Component | Used in | Difficulty |
|---|---|---|
| `Table` | events, orders, OrderDetail, ManageLists, EscalationDetail, users, logs | **Map** — virtual scroll, column config, row selection, inline editing all need mapping |
| `Card` | dashboard, detail pages, AiSummary, EventCard, OrderCard, login | Drop-in |
| `Statistic` | dashboard, prototype | **Map** — prefix/suffix/delta pattern may differ |
| `Tag` | events, orders, detail pages, StatusTag, dashboard | Drop-in |
| `Badge` | FilterPanel, users | Drop-in |
| `List` | AiSummary, events, orders | Drop-in |
| `Progress` | dashboard | Drop-in |
| `Tooltip` | StatusTag, SidebarNav, OrderCard, logs | Drop-in |
| `Typography` (`Title`, `Text`, `Paragraph`) | nearly everywhere | Drop-in |

---

## Navigation

| Component | Used in | Difficulty |
|---|---|---|
| `Menu` | PageHeader (mobile nav drawer) | **Map** — menu item shape, `selectedKeys`, `mode` are AntD-specific |
| `Tabs` | FilterPanel, orders, ManageLists | **Map** — `items` API and `inkBarColor` token customization |
| `Segmented` | DateRangeFilter, dashboard, FieldIntake | **Custom** — Segmented is rare outside AntD; likely needs a custom tab-like toggle |
| `Collapse` | FilterDrawer | Drop-in |

---

## Forms & Inputs

| Component | Used in | Difficulty |
|---|---|---|
| `Form` / `Form.Item` | login, users, CreateEscalationModal, EventDetail, OrderDetail | **Map** — validation model and `name` binding differ across libraries |
| `Input` / `Input.TextArea` / `Input.Search` | widespread | Drop-in |
| `Select` | widespread | **Map** — `options` shape, `mode="multiple"`, `showSearch` all need mapping |
| `Checkbox` | FilterDrawer, FilterPanel | Drop-in |
| `Switch` | SidebarNav, orders, OrderDetail | Drop-in |
| `DatePicker` / `DatePicker.RangePicker` | DateRangeFilter | **Custom** — DateRangeFilter is a fully custom AntD DatePicker wrapper with preset ranges, calendar navigation, and Segmented presets. Full custom build required. |
| `Calendar` | DateRangeFilter | **Custom** — used inside the custom DateRangeFilter |

---

## Feedback & Overlays

| Component | Used in | Difficulty |
|---|---|---|
| `Modal` | widespread | Drop-in |
| `Drawer` | DateRangeFilter, FilterDrawer, FilterPanel, PageHeader | Drop-in |
| `Popover` | FilterPanel | Drop-in |
| `Popconfirm` | ManageLists, users | **Map** — inline confirmation pattern; may need custom if DS doesn't have it |
| `notification` (API) | events, orders, EscalationDetail, CreateEscalationModal | **Map** — `notifApi.success()` / `.error()` pattern; most DS have a toast API but shape differs |
| `Skeleton` | AiSummary | Drop-in |
| `Dropdown` | OrderCard, orders | **Map** — `items` array API, `trigger`, `placement` differ |

---

## Buttons

| Component | Variants used | Difficulty |
|---|---|---|
| `Button` | `type="primary"`, `type="default"`, `type="text"`, `type="link"` · `size="small"` · `icon={...}` | Drop-in — map each variant to DS equivalent |

---

## Theme / Token Infrastructure

| Item | File | Notes |
|---|---|---|
| `ConfigProvider` | AntdProvider.tsx | Wraps entire app — swap out for DS provider |
| `theme.useToken()` | ~18 files | Returns design tokens (color, spacing, font) — every call site needs a token replacement |
| `ThemeConfig` (type) | lib/theme.ts | AntD-specific config shape for seed tokens, component overrides |
| `SEED_TOKENS` | lib/theme.ts | colorPrimary, borderRadius, fontSize, fontFamily, colorError, etc. |
| `DARK_SEED_OVERRIDES` | lib/theme.ts | Dark mode token overrides |
| `DARK_COMPONENT_TOKENS` | lib/theme.ts | Tooltip, Button, Card, Table scoped overrides |
| `LIGHT_COMPONENT_TOKENS` | lib/theme.ts | Table headerBg, Tabs ink bar color |
| `SEMANTIC` / `SemanticTokens` | lib/theme.ts | Custom semantic layer on top of AntD — maps to DS semantic tokens |
| `@ant-design/nextjs-registry` | app/layout.tsx | SSR style injection — replace with DS equivalent or remove if DS handles SSR |

> **Note:** `theme.useToken()` is called in ~18 files. All token reads (`token.colorText`, `token.fontSizeSM`, `token.colorBgContainer`, etc.) will need to be remapped to the new DS token API. This is the highest-volume change in a migration.

---

## Icons (`@ant-design/icons`)

All icons are from AntD's icon set. In a migration, map each to the new DS icon library or a general set (Lucide, Heroicons, etc.).

| Icon | Used in |
|---|---|
| `ArrowLeftOutlined` | EscalationDetail, EventDetail, OrderDetail, events |
| `ArrowRightOutlined` | AiSummary |
| `AppstoreFilled` | dashboard, prototype |
| `BarcodeOutlined` | OrderDetail |
| `BellFilled` | PageHeader, SidebarNav |
| `CalendarFilled` | PageHeader, SidebarNav |
| `CalendarOutlined` | DateRangeFilter |
| `CaretDownFilled` | AiSummary, dashboard, prototype |
| `CaretRightFilled` | dashboard, prototype |
| `CaretUpFilled` | AiSummary |
| `CheckCircleFilled` | orders, OrderDetail |
| `CheckOutlined` | CopyableValue, ManageLists, orders, OrderDetail, EscalationDetail |
| `CloseCircleFilled` | orders, OrderDetail |
| `CloseOutlined` | ManageLists, dashboard, prototype, events, orders, EscalationDetail |
| `ContactsFilled` | PageHeader, SidebarNav |
| `CopyFilled` | CopyableValue |
| `DatabaseFilled` | PageHeader, SidebarNav |
| `DeleteFilled` | ManageLists, users |
| `EditFilled` | TriageReview, ManageLists, EscalationDetail, OrderDetail, EventDetail |
| `ExclamationCircleFilled` | EventDetail |
| `ExportOutlined` | events, orders |
| `FileAddFilled` | EventDetail |
| `FilterFilled` | FilterPanel |
| `FormOutlined` | dashboard, prototype |
| `HomeFilled` | PageHeader, SidebarNav |
| `HourglassFilled` | TriageReview, dashboard |
| `InfoCircleFilled` | StatusTag |
| `LeftOutlined` / `RightOutlined` | DateRangeFilter |
| `MessageFilled` | EventDetail |
| `MenuOutlined` | PageHeader |
| `MoreOutlined` | OrderCard, logs, events |
| `MoonFilled` / `SunFilled` | PageHeader, SidebarNav |
| `PictureFilled` | EscalationDetail, EventDetail |
| `PlusOutlined` | EscalationsClient, ManageLists, EscalationDetail, users, OrderDetail, EventDetail |
| `ProfileFilled` | PageHeader, SidebarNav |
| `RobotFilled` | AiSummary |
| `RollbackOutlined` | orders, OrderDetail, EventDetail |
| `SaveFilled` | EventDetail |
| `SearchOutlined` | FilterPanel, dashboard, users, events, orders |
| `SendOutlined` | EscalationDetail, orders, OrderDetail |
| `SettingFilled` | PageHeader, SidebarNav |
| `ShoppingCartOutlined` | OrderFulfillment, StatusTag |
| `ShoppingFilled` | PageHeader, SidebarNav |
| `StarFilled` | EventDetail |
| `StopFilled` | EventDetail |
| `ToolFilled` | EventDetail |

---

## Charts (`@ant-design/plots`)

Charts are a separate migration concern from the component library. All chart config uses G2 v5 flat props — see `feedback-g2-axis-style.md` in memory for the gotcha.

| Chart | Used in | Notes |
|---|---|---|
| `Line` | FieldIntake | Events over time |
| `Bar` | FieldIntake | Events by Branch (horizontal) |
| `Pie` | FieldIntake | Events by Discrepancy / Product (donut mode) |
| `Column` | OrderFulfillment | Orders by Branch (vertical) |

> **TriageReview** uses manual SVG/div-based visualization (queue health matrix, stat rows) — no chart library dependency there.

**Migration path for charts:** `@ant-design/plots` is a thin G2 v5 wrapper. Replacing it means either swapping to another G2-based library (minimal config changes) or rebuilding in Recharts/Victory/Nivo (significant config rewrite). The theme-integration (`plotTheme` toggling dark/light) is also AntD-token-specific and would need rewiring.

---

## Summary — Migration Effort by Category

| Category | Effort |
|---|---|
| Layout primitives (Row/Col/Flex/Space/Divider) | Low — near drop-in |
| Display components (Card, Tag, Badge, List, Progress, Skeleton) | Low |
| Typography | Low |
| Buttons | Low — map 4 variants |
| Overlays (Modal, Drawer, Tooltip, Popover, notification) | Medium |
| Navigation (Menu, Tabs, Dropdown) | Medium |
| Form inputs (Input, Select, Checkbox, Switch, Form) | Medium |
| Table | Medium-High — large API surface |
| Segmented | High — custom build |
| DateRangeFilter | High — fully custom AntD component, full rebuild |
| Theme tokens (`theme.useToken()` in 18 files) | High — highest volume change |
| Icons | Medium — 40+ icons, 1-for-1 remapping |
| Charts | High — separate library swap |
