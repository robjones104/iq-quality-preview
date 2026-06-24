# iQ Quality — Personas & Roles

---

## Portal Roles

These are the 7 RBAC roles for users who have access to the iQ Quality web portal.

| # | Role | Description |
|---|------|-------------|
| 1 | **Full Access** | Users with unrestricted administrative privileges. They have global data visibility and the authority to perform system-level configurations, manage classification lists (CRUD operations), and execute any workflow action across the portal. **Note:** For security purposes and the way Allegion Access Management is designed today, Full Access will not have the ability to provision or revoke user access (this is strictly reserved for the App Manager). |
| 2 | **Field Quality** | The primary users responsible for validating data, categorizing/grouping issues, routing downstream actions, tagging events, and utilizing AI insights. |
| 3 | **Customer Service** | Users who handle part requests, process replacement orders, and approve or decline part fulfillment. |
| 4 | **Procurement** | Users who *optionally* receive approved part requests from Customer Service. They have the ability to view assigned orders, enter Replacement Order Numbers, and close out the complaint. |
| 5 | **Global (View-Only)** | Users who require comprehensive oversight of quality trends across the entire organization (all branches, plants, and Field Technicians). They can view all events, orders, and dashboards, but cannot edit records, change statuses, or perform any actionable workflows (e.g., Plant Quality, Field Ops, DRM Team). |
| 6 | **Branch (View-Only)** | Users whose data visibility is strictly restricted to their assigned branch(es) via SSO integration. They can monitor events, order statuses, and metrics relevant *only* to their location. They cannot view external branch data or execute workflow actions (e.g., Branch Manager, Service Dispatcher, Install Coordinator). |
| 7 | **App Manager** | A specialized administrative user whose *sole* responsibility is provisioning user access and assigning RBAC roles. They do not have access to view, edit, or process operational data (Events, Orders, or Dashboards). |

---

## Supporting Personas

These personas are used to aid in requirement derivations. **These users do not need access to the portal.**

| # | Persona | Description |
|---|---------|-------------|
| 1 | **Portal User** | A Portal User refers exclusively to internal employees who access the web-based iQ Quality Portal using valid Single Sign-On (SSO) credentials. These users interact with the backend web system to view, manage, or process data based on their assigned Role-Based Access Control (RBAC) permissions. **Examples:** Field Quality, Customer Service, Procurement, Branch Managers, Factory Quality, and System Admins. If a requirement mentions a "Portal User," it applies to the web dashboard experience, not the iQ Quality Mobile App. |
| 2 | **Field Technician** | A Field Technician is the frontline user responsible for identifying and submitting quality events and part requests directly from the field. They primarily interact with the system via the mobile application (or mobile-friendly form) to scan product labels (Configuration IDs) and input issue details. Technicians only have access to view and track the specific records they personally submitted. They do not require backend web portal access, nor do they need complex RBAC mappings. |
| 3 | **Branch Level User** | A supporting persona representing a group of users at the branch level (e.g., Branch Managers, Service Dispatchers, Install Coordinators). Their data visibility is strictly restricted to their assigned branch(es) via SSO integration. They can monitor events, order statuses, and metrics relevant *only* to their location, but cannot execute workflow actions. This supporting persona is related to the role 'Branch (View-Only)'. |

---

## Feature / Action Matrix

| # | Feature / Action | Full Access | Field Quality | Customer Service | Global (View-Only) | Branch (View-Only) | Procurement | App Manager |
|---|-----------------|:-----------:|:-------------:|:----------------:|:------------------:|:------------------:|:-----------:|:-----------:|
| 1 | Provide / Revoke User Access | | | | | | | X |
| 2 | Home Screen Dashboard & AI | X | X | X | X | X (Branch-Only) | X | |
| 3 | Events Table (View) | X | X | X | X | X (Branch-Only) | X | |
| 4 | Event Page (View) | X | X | X | X | X (Branch-Only) | X | |
| 5 | Events Page (Update / Delete) | X | X | | | | | |
| 6 | Orders Table (View) | X | X | X | X | X (Branch-Only) | X | |
| 7 | Orders Page (View) | X | X | X | X | X (Branch-Only) | X | |
| 8 | Orders Page (Update / Approve / Decline) | X | | X | | | | |
| 9 | Orders Page (Close / Add Replacement #) | | | X | | | | X |

---

## Key Design Implications

- **Field Quality is the primary portal persona** — the prototype defaults to FQ's workflow. All primary action controls (validate, tag, route, escalate, AI summary) are designed for FQ first.
- **Field Technicians do not use this portal.** They submit events via a separate mobile app. The iQ Quality portal is for internal Allegion office staff only.
- **Mobile users of this portal are knowledge workers** — Branch Managers, Field Quality managers, Customer Service reps checking in on the go. Not field workers. 14px body text and information-dense layouts are appropriate.
- **Event edit controls** (root cause, escalation, tags, status changes, Send Message) are FQ + Full Access only. All other roles see read-only event detail.
- **Orders workflow is CS-led** — Approve/Decline is CS. Close/Add Replacement # is CS + Procurement.
- **Procurement is orders-only** — they never touch events directly.
- **Branch and Global are observers** — no actionable controls needed; Branch data is scoped to their assigned location.
- **App Manager is isolated** — no operational data access at all, purely user provisioning.
