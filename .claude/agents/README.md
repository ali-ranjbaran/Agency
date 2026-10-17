# Subagents

Imported 17 Oct 2026 from [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) (MIT, see `LICENSE-agency-agents`), commit pinned at import.

Included: all of `sales/` and `testing/`, plus Frontend Developer, UX Architect, UI Designer, SEO Specialist, Pricing Analyst, Legal Compliance Checker.

Rules:
- `CLAUDE.md` overrides any agent persona (voice, CASL gates, plan mode, no "AI-powered").
- Agents advise; skills in `skills/` own the gated workflows. An agent never bypasses a skill gate.
- Legal Compliance Checker is a second read, not legal advice.
- To update: re-copy from upstream deliberately; don't edit these files in place except to fix conflicts with CLAUDE.md.
