# Licensing FAQ

OpenMLC is licensed under the **OpenMLC Fair Source License v1.0**
([full text](./LICENSE.md)).

This document is a plain-English explainer. It is **not legally binding** —
the actual license file controls. If your use case is sensitive (legal,
enterprise, large-scale commercial), consult a lawyer or open an issue and
we'll talk.

---

## TL;DR

| Use case                                                  | Allowed?                  |
| --------------------------------------------------------- | ------------------------- |
| Run it on your laptop                                     | ✅ Free                   |
| Run it on your homelab / personal VPS                     | ✅ Free                   |
| Run it inside your company for your own employees         | ✅ Free                   |
| Use it for school, research, side projects                | ✅ Free                   |
| Modify the code, fork it, contribute back                 | ✅ Free                   |
| Build a product on top of OpenMLC and sell that product   | ✅ Free                   |
| Sell consulting / support services around OpenMLC         | ✅ Free                   |
| Bundle OpenMLC inside something you ship to customers     | ✅ Free                   |
| **Run a hosted "OpenMLC-as-a-service" SaaS competitor**   | ❌ Not without a license  |
| **Resell OpenMLC, lightly skinned, as your own product**  | ❌ Not without a license  |

If you want to do one of the ❌ things, that's fine — just reach out and we
can work out a commercial license.

---

## Why Fair Source?

Pure open source is great, but it has a known failure mode: someone with
deeper pockets clones your project, runs it as a managed service, out-markets
you, and you starve.

Fair Source draws a single narrow line — **don't take this and run it as a
direct hosted competitor to us** — while keeping everything else (personal,
internal, commercial, modification, redistribution) completely free.

---

## The 6-year clock

Every version of OpenMLC automatically converts to **Apache 2.0** (a real,
unrestricted open source license) on the **6th anniversary** of its release.

Concretely:

- OpenMLC 1.0 ships on 2026-04-29 → Apache 2.0 on **2032-04-29**
- OpenMLC 1.1 ships on 2026-08-01 → Apache 2.0 on **2032-08-01**
- ...and so on for each numbered release.

Once a version converts, you can do anything Apache 2.0 allows — including
running it as a hosted service. The Fair Source restriction only ever applies
to the most recent six years of releases.

This means even in the worst case (we vanish, get hit by a bus, sold to a
private equity firm), the code is guaranteed to become fully open source on
a known schedule. You always own a usable, eventually-fully-free copy.

---

## Why six years (instead of two)?

The standard Functional Source License (FSL) uses two years. We chose six
because:

1. **Self-hosted infrastructure has long sales cycles.** Two years isn't
   enough time to build the commercial flywheel needed to keep the project
   alive.
2. **Six years is still a hard ceiling.** It's not "until we feel like it" —
   it's a contractual guarantee. You can plan around it.
3. **The vast majority of real-world uses are already free under this
   license.** The 6-year window only matters if you specifically want to
   build a competing hosted service, in which case waiting is a feature.

---

## Common scenarios

### "I want to run OpenMLC for my team at work."
Go for it. Internal use is unrestricted.

### "I'm a freelancer setting up OpenMLC for my client."
Allowed. Professional services to a licensee are explicitly permitted.

### "I want to fork it and add a feature, then push it back upstream."
Please do! Contributions welcome.

### "I want to fork it and ship my own private modifications inside my company."
Allowed. You don't have to share modifications.

### "I want to fork it, modify it heavily, and sell it as a different product."
This depends on whether your product substitutes for OpenMLC. If your
product solves a fundamentally different problem (even using OpenMLC code as
a base), that's likely fine. If your product is "OpenMLC, but my brand,"
that's a competing use. **Open an issue and ask** — we'd rather talk than
have a misunderstanding.

### "I want to launch OpenMLC.io as a hosted multi-tenant SaaS."
Not without a commercial license. Email us.

### "I want to redistribute OpenMLC bundled with my open-source project."
Allowed, as long as you include a copy or link to this license and don't
strip our copyright notices.

---

## Commercial licensing

If you need rights beyond what Fair Source gives you (e.g., you want to run
a hosted service), email **licensing@openmlc.cloud** with a brief
description of your use case. We'll work something out.

---

## Reporting concerns

If you spot a potential license violation in the wild, please email
**security@openmlc.cloud**. We don't want to fight, but we will defend the
project's sustainability.
