---
title: "Building UserHarbor: Framework-Agnostic User Management for Python"
date: 2026-08-17T12:31:04Z
author: SpaceShaman
description: The architecture behind UserHarbor and its framework-independent core, adapters and executable storage contract.
tags: [python, architecture, authentication, open source]
translationKey: building-userharbor
canonicalURL: https://coderlegion.com/24763/building-userharbor-framework-agnostic-user-management-for-python
showToc: true
---

User management is one of those problems that rarely feels difficult enough to deserve much attention.

Until you implement it for the fifth time.

Registration, login, sessions, email verification, password resets, password changes, account deletion, roles, permissions — none of these features are particularly unusual. But almost every application needs some combination of them, and the implementation often ends up tightly coupled to whatever framework, ORM, or infrastructure the project happened to use at the time.

That was the problem that led me to build **UserHarbor**.

UserHarbor is a framework-agnostic Python library for user account management. The goal is not to build another web framework or a complete identity platform. Instead, it provides a small domain-level API for common account operations while leaving HTTP, databases and email delivery to separate integrations.

Since I first wrote about the project, the interesting part has increasingly become not just the authentication API itself, but the boundary between the core and its integrations.

## The problem I wanted to solve

Imagine building two applications.

One uses:

- FastAPI
- SQLAlchemy
- PostgreSQL
- SMTP

Another uses:

- Flask
- MongoDB
- an external email API

The user-management rules are mostly the same.

A password still needs to be validated and hashed. A verification token still needs to expire. Password reset tokens still need to be protected. Sessions need to be created and invalidated. Roles and permissions need to be checked.

But in many libraries these rules are mixed together with database models, HTTP handlers or framework-specific abstractions.

I wanted the opposite.

The core should know **what should happen**, but not necessarily **how the application stores or transports the data**.

That leads to an architecture that looks roughly like this:

```text
Application / Framework
        │
        ▼
    UserHarbor
        │
        ├── UserStore
        │       └── database / ORM / custom backend
        │
        └── EmailSender
                └── SMTP / API / custom provider
```

The core owns things such as registration, validation, password hashing, token generation, token hashing, session handling and authorization rules.

The adapters own infrastructure.

## A small domain-level API

UserHarbor currently handles the common account lifecycle:

- user registration
- email verification
- login
- sessions
- logout from one or all sessions
- password change
- password reset
- account deletion
- roles and permissions

It deliberately does not expose HTTP endpoints itself.

That means code using the core can look like this:

```python
user = harbor.register(
    username="jane",
    email="*Emails are not allowed*",
    password="StrongPassword123!",
)

harbor.verify_email(verification_token)

session_token = harbor.login(
    username="jane",
    password="StrongPassword123!",
)

current_user = harbor.get_current_user(session_token)
```

The same `UserHarbor` instance can be used from FastAPI, Flask, Django, a CLI application or something that does not expose HTTP at all.

Authorization follows the same idea:

```python
harbor.roles.create("admin")
harbor.permissions.create("users.delete")

harbor.roles.grant_permission(
    "admin",
    "users.delete",
)

harbor.grant_role("jane", "admin")

if harbor.has_permission(session_token, "users.delete"):
    delete_user()
```

Or, if access should be enforced:

```python
user = harbor.require_permission(
    session_token,
    "users.delete",
)
```

UserHarbor implements simple role-based access control, but leaves application-specific authorization policy outside the core. It intentionally does not try to become a general policy engine.

## Framework-agnostic does not mean framework-unfriendly

One thing I wanted to avoid was making framework independence come at the cost of developer experience.

For example, there is an official `userharbor-fastapi` integration.

Instead of manually writing authentication routes and dependencies, a FastAPI application can configure UserHarbor and attach the adapter:

```python
from fastapi import FastAPI
from userharbor import UserHarbor
from userharbor_fastapi import UserHarborFastAPI

harbor = UserHarbor(
    secret_key="your-secret-key",
    store=store,
    email_sender=email_sender,
)

auth = UserHarborFastAPI(harbor)

app = FastAPI()
app.include_router(
    auth.router,
    prefix="/auth",
    tags=["auth"],
)
```

The adapter provides the framework-specific layer: routers, request schemas, bearer authentication dependencies, error mapping and helpers for requiring roles or permissions.

The important part is that FastAPI still does not leak into the UserHarbor core.

You can replace the web framework without replacing the account-management logic.

## The harder problem: what does it mean to implement `UserStore`?

Originally, separating persistence behind a `UserStore` interface seemed like the obvious solution.

Define an interface, implement the methods, and now SQLAlchemy, MongoDB, Redis or anything else can provide storage.

But there is a subtle problem.

Matching method signatures does not mean two storage implementations behave the same way.

Consider a password reset token.

Should creating a new token remove an older token?

What happens when a user is deleted?

Should their sessions disappear automatically?

What should happen if a transaction fails halfway through a password change?

Should deleting something that no longer exists raise an error?

These behaviors are part of the storage contract even though Python's type system cannot express them.

This became one of the most important changes in UserHarbor 0.7.0.

## Turning the adapter contract into executable tests

UserHarbor now ships a reusable contract test suite for `UserStore` implementations.

An adapter can import the complete suite:

```python
# tests/test_user_store_contract.py

from userharbor.testing.user_store_contract import *
```

Then it only needs to provide a clean store:

```python
import pytest


@pytest.fixture
def user_store():
    store = create_user_store()

    try:
        yield store
    finally:
        dispose_user_store(store)
```

The same tests can then run against SQLAlchemy, an in-memory implementation, or a completely different persistence backend.

Version 0.7.0 introduced **57 reusable contract tests** covering users, password hashes, verification tokens, password reset tokens, sessions, roles, permissions, relationships and transaction behavior.

This changes the meaning of an adapter.

A compatible `UserStore` no longer just claims to implement an interface. It can demonstrate that it follows the behavioral semantics expected by the core.

For example, the contract specifies that:

- usernames and email addresses are unique
- user creation and the initial verification token are atomic
- a new verification token replaces the previous one
- a new password reset token replaces the previous one
- deleting a user removes their sessions and related tokens
- repeated relationship assignments are idempotent
- deleting roles and permissions removes their assignments
- successful transactions commit
- failed transactions roll back
- nested transactions participate in the outer transaction

These details are easy to overlook when implementing another backend, and they are exactly the type of differences that can produce authentication bugs which only appear much later.

For me, this was an important step in the architecture: the abstraction is now described not only by Python protocols and documentation, but also by executable behavior.

## A template for building new storage adapters

To make that process easier, I also created `userharbor-inmemory`.

It is a minimal in-memory `UserStore` implementation that passes the complete storage contract.

It serves two purposes.

First, it is useful for tests and examples where a real database is unnecessary.

Second, the repository itself can be used as a template for creating new storage integrations. A developer can start with a working implementation and passing contract tests, replace the in-memory backend incrementally, and continuously verify that the new adapter still behaves correctly.

The idea is that creating something like a future database adapter should mostly become:

```text
working UserStore template
        │
        ▼
replace persistence implementation
        │
        ▼
run shared contract tests
        │
        ▼
add backend-specific tests
```

instead of reverse-engineering the expected behavior from the core implementation.

## Keeping security behavior inside the core

Another important architectural boundary is that storage adapters never receive raw tokens for persistence.

UserHarbor generates the raw verification, reset and session tokens, but hashes them before passing them to `UserStore`.

The raw token is given only to the part of the application that needs it — for example, to an email sender or to the user after login.

The database stores the hash.

The core also owns behavior such as token expiration and session validation.

Sensitive account-discovery flows are designed to return neutral responses where appropriate. For example, requesting a password reset for an unknown email address does not reveal whether that account exists.

There are also account lifecycle notifications for events such as:

- successful email verification
- password changes
- password resets
- account deletion

The `EmailSender` interface decides how those messages are delivered, but it does not decide when the operation is valid. That decision remains in the core.

## SQLAlchemy without owning your application

The official SQLAlchemy adapter is useful out of the box, but one design requirement was that adopting UserHarbor should not force an application to adopt a completely separate user model.

By default, the adapter can manage its own user table.

But applications that already have a SQLAlchemy model can provide it instead:

```python
store = SQLAlchemyUserStore(
    SessionLocal,
    user_model=AppUser,
)
```

Applications can also map their model to a richer public user object instead of being limited to UserHarbor's minimal representation.

The documentation now also covers using the adapter with Alembic migrations rather than relying on `metadata.create_all()` at application startup.

That distinction matters because examples should be easy to run, but real applications need a sensible path toward managing schema changes properly.

## Installation

The core can be installed on its own:

```bash
pip install userharbor
```

Or with selected official integrations:

```bash
pip install "userharbor[sqlalchemy,smtp,fastapi]"
```

For experimenting with the complete official stack:

```bash
pip install "userharbor[all]"
```

The main official integrations currently include SQLAlchemy storage, SMTP email delivery and FastAPI support.

## What I deliberately do not want UserHarbor to become

Feature creep is an easy trap for this kind of project.

Once you have authentication, it is tempting to add OAuth. Then social login. Then MFA. Organizations. Teams. ACLs. Resource ownership. Admin panels. A policy language.

Eventually the "small authentication library" becomes an application framework.

That is specifically what I am trying to avoid.

The core should remain focused on common account-management primitives.

More specialized functionality can exist as integrations or separate libraries if there is demand for it, but it should not make the basic package more complicated for everyone else.

One of the design principles of UserHarbor is therefore deliberately boring:

**stability is more important than feature count.**

Once the public API stabilizes, I would rather spend development effort on security, reliability, compatibility and performance than continuously expand the scope of the core.

## Current status

UserHarbor is currently at version **0.7.0**.

The project is still young, and I do not consider the API stable or the library ready for production use yet.

At this stage, the project is as much about validating the architecture as adding functionality.

The areas I am particularly interested in getting feedback on are:

- the boundary between the core and integrations
- the `UserStore` contract
- the contract-testing approach
- the FastAPI integration
- custom storage backends
- the shape of the public API
- what should — and should not — belong in the core

There are plenty of good framework-specific authentication libraries in Python.

UserHarbor is exploring a slightly different question:

**Can the account-management domain itself be reusable across frameworks and infrastructure, while integrations remain small, replaceable and independently testable?**

So far, I think that boundary is turning out to be the most interesting part of the project.

## Links

Documentation:  
<https://userharbor.github.io/userharbor/>

Repository:  
<https://github.com/userharbor/userharbor>

FastAPI integration:  
<https://github.com/userharbor/userharbor-fastapi>

SQLAlchemy adapter:  
<https://github.com/userharbor/userharbor-sqlalchemy>

SMTP adapter:  
<https://github.com/userharbor/userharbor-smtp>

_Originally published on [CoderLegion](https://coderlegion.com/24763/building-userharbor-framework-agnostic-user-management-for-python)._
