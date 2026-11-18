# API Monitoring Dashboard — Documentation Index

This folder is the implementation source of truth for the MVP. Read in this order:

1. `PRD.md` — why the product exists and what it must do.
2. `TRD.md` — technology, runtime contracts, and engineering constraints.
3. `SYSTEM_ARCHITECTURE.md` — system boundaries and process responsibilities.
4. `DATABASE_DESIGN.md` — persisted entities, indexes, and retention.
5. `API_DOCUMENTATION.md` — REST and realtime contracts.
6. `WORKFLOW.md` — operational and business workflows.
7. `UI_UX_GUIDELINES.md` and `COMPONENT_LIBRARY.md` — frontend experience and reusable UI.
8. `USER_ROLES_PERMISSIONS.md` and `SECURITY_DOCUMENTATION.md` — authorization and security controls.
9. `TESTING_DOCUMENTATION.md` and `ACCEPTANCE_CRITERIA.md` — verification and release gates.
10. `PROJECT_ROADMAP.md` and `DEPLOYMENT_GUIDE.md` — delivery and operations.

`diagrams/` contains standalone Mermaid diagrams. The PDFs are generated from the Markdown files and are convenience exports; Markdown remains canonical.

## Implementation rule
Do not begin feature implementation until the team has reviewed ADR-001 through ADR-010, environment assumptions, hosting constraints, and SSRF threat model. If implementation changes a contract, update every affected document and its traceability references in the same change.
