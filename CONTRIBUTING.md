# Contributing to OpenMLC

First — thanks 💚. Bug reports, fixes, features, docs, and design feedback
are all welcome.

This document covers:

1. [How to contribute](#how-to-contribute)
2. [Development setup](#development-setup)
3. [Pull request process](#pull-request-process)
4. [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)

---

## How to contribute

### Reporting bugs

- Search [existing issues](https://github.com/inversifyai-cloud/OpenMLC/issues)
  first — chances are someone hit the same thing.
- Open a new issue with: what you expected, what actually happened, the
  steps to reproduce, and your environment (OS, Docker version, browser).
- Logs help a lot. `docker compose logs openmlc` is the magic command.

### Suggesting features

- Open an issue tagged `enhancement` describing the use case first, before
  building. Lets us catch "this conflicts with X already in flight" early.
- Small, scoped PRs land faster than 3,000-line refactors.

### Submitting code

1. Fork the repo, branch off `main`.
2. Make your change. Keep the diff minimal — don't bundle unrelated cleanup
   into a feature PR.
3. Run `npm run typecheck` and make sure it passes.
4. Open a PR with a clear description of *why* the change matters, not just
   what it does.

---

## Development setup

```bash
git clone https://github.com/inversifyai-cloud/OpenMLC.git
cd OpenMLC
npm install
cp .env.example .env
# fill SESSION_SECRET and ENCRYPTION_KEY (see .env.example)
npm run db:push
npm run dev
```

Open http://localhost:3000.

For Docker development:

```bash
docker compose up -d --build
docker compose logs -f
```

---

## Pull request process

1. **One concern per PR.** A bug fix and a feature are two PRs.
2. **Tests where it makes sense.** UI tweaks don't need them; logic changes
   usually do.
3. **Match the existing style.** Run the formatter on touched files only —
   don't reformat the whole repo.
4. **Reference the issue.** `Closes #123` in the description if applicable.
5. **Be patient on review.** This is a small project. Maintainers might take
   a few days to get to you.

---

## Contributor License Agreement (CLA)

> **Read this carefully.** By opening a pull request to this repository, you
> agree to the following CLA. If you can't agree, please don't submit a PR —
> open an issue instead and we'll figure something else out.

OpenMLC is licensed under the **OpenMLC Fair Source License v1.0** (the
"Project License"), which automatically converts to Apache 2.0 six years
after each release. To keep this licensing model sustainable, every
contributor needs to grant the project a small set of rights up front —
otherwise we couldn't legally ship contributed code under our license.

**This CLA is inbound = outbound style** (your contributions are licensed to
the project under the same terms the project ships under) **plus a
copyright/patent grant** (so the maintainers can defend and relicense if
needed in the future, e.g. moving from FSL to Apache 2.0 early).

### Your grant

By submitting a contribution (a "Contribution") to this repository:

1. **License grant.** You license your Contribution to inversifyai-cloud and
   to all recipients of OpenMLC under:
   - the OpenMLC Fair Source License v1.0 (the Project License at the time
     of submission), **and**
   - the Apache License 2.0,
   - **at the project's option.** This dual grant means we can ship your
     Contribution under the current Project License, and we can also relicense
     the project under Apache 2.0 (or compatible) earlier than the 6-year
     DOSP if that ever becomes the right call.

2. **Patent grant.** You grant a perpetual, worldwide, non-exclusive,
   royalty-free, irrevocable patent license to make, use, sell, offer for
   sale, import, and otherwise transfer the Contribution and any work that
   includes it, to the extent your Contribution alone or combined with the
   project necessarily infringes patents you own or control.

3. **Originality.** You represent that the Contribution is your original
   work, OR that you have the rights to submit it under the terms above.
   If the Contribution is or contains anything you got from somewhere else
   (a snippet from Stack Overflow, an AI-generated suggestion, code from
   another open source project), you'll flag that in the PR so we can review
   it for compatibility.

4. **Employer rights.** If your employer has rights to intellectual property
   you create (most employment contracts include something like this), you
   represent that you've gotten permission to make this Contribution on
   their behalf, OR that your employer has waived their rights for this
   Contribution.

5. **No warranty.** You provide the Contribution "AS IS," without warranty of
   any kind.

### How agreement works

Opening a pull request constitutes agreement. We don't require a separate
signed document — the PR itself is the record. If you'd prefer to sign
something explicit (some employers require this), email
**legal@openmlc.cloud** and we'll send a standard CLA PDF.

### Why this exists

A lot of open source projects skip the CLA and run on "inbound = outbound"
alone. That works fine for pure permissive (MIT/Apache) projects. For Fair
Source projects with a future-license clause, the CLA lets us:

- Defend the project against bad-faith forks that strip the license.
- Relicense to Apache 2.0 *earlier* than 6 years if the community wants it.
- Add a security-focused dual-license tier for enterprises if that becomes
  necessary to fund development.

We promise we will **never** relicense the project to be *more* restrictive
than the OpenMLC Fair Source License. The only direction this CLA permits us
to move is *toward* fully open source.

---

## Questions

- General questions: open a [discussion](https://github.com/inversifyai-cloud/OpenMLC/discussions)
- Security issues: **security@openmlc.cloud** (do not open a public issue)
- Licensing questions: **licensing@openmlc.cloud**
- CLA questions: **legal@openmlc.cloud**
