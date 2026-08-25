---
title: "I built UserHarbor — a framework-agnostic user management library for Python"
date: 2026-07-01T17:19:53Z
author: SpaceShaman
description: Why I built UserHarbor and separated user-management logic from web frameworks, databases, ORMs and email providers.
tags: [python, userharbor, open source, web development, fastapi]
translationKey: i-built-userharbor
canonicalURL: https://dev.to/spaceshaman/i-built-userharbor-a-framework-agnostic-user-management-library-for-python-1mkj
showToc: true
---

While working on a SaaS application recently, I once again had to implement the same user account flow:

- registration
- login
- sessions
- email verification
- password reset
- password change
- account deletion
- basic roles and permissions

None of that was especially hard.

But it was repetitive.

I had written similar code before, and I did not want to keep rebuilding the same user-management boilerplate in every new Python project.

So I started working on **UserHarbor**.

## What is UserHarbor?

**UserHarbor** is a framework-agnostic Python library for user account management.

The idea is simple:

> keep the core small, predictable, and independent from any specific web framework, database, ORM, or email provider.

The core handles the account-management logic.
Integrations are handled by separate adapter packages.

So instead of building something only for FastAPI, Flask, Django, or one specific stack, I wanted a core that could be used in different kinds of Python applications.

For example:

- FastAPI apps
- Flask apps
- Django apps
- CLI tools
- internal tools
- custom Python services

## Why not just use a framework-specific library?

There are already good tools for specific frameworks.

But I wanted something slightly different.

I did not want the user-management logic to be tightly coupled to:

- a web framework
- a database layer
- an email provider
- a specific request/response model

Instead, UserHarbor uses small interfaces for things like storage and email delivery.

The main interfaces are:

```python
class UserStore:
    ...

class EmailSender:
    ...
```

The core does not care how users are stored or how emails are sent.

That part belongs to adapters.

## Installation

Install only the core package if you want to provide your own `UserStore` and `EmailSender` implementations:

```bash
pip install userharbor
```

Install the core package with the official SQLAlchemy, SMTP, and FastAPI adapters:

```bash
pip install "userharbor[sqlalchemy,smtp,fastapi]"
```

Or install all official integrations at once:

```bash
pip install "userharbor[all]"
```

## Official adapters

At the moment, there are a few official adapter packages:

- `userharbor-sqlalchemy` — SQLAlchemy storage
- `userharbor-smtp` — SMTP email sender
- `userharbor-fastapi` — FastAPI integration

This keeps the core small while still making the common setup easy to install and use.

## Quick example

Here is a longer example using SQLAlchemy storage and SMTP email delivery:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from userharbor import UserHarbor
from userharbor_sqlalchemy import SQLAlchemyUserStore
from userharbor_smtp import SMTPEmailSender

engine = create_engine("sqlite:///users.db")
SessionLocal = sessionmaker(bind=engine)

store = SQLAlchemyUserStore(SessionLocal)
store.metadata.create_all(engine)

email_sender = SMTPEmailSender(
    host="smtp.example.com",
    port=587,
    username="smtp-user",
    password="smtp-password",
    from_email="noreply@example.com",
)

harbor = UserHarbor(
    secret_key="your-secret-key",
    store=store,
    email_sender=email_sender,
)

# Register a user
harbor.register(
    username="jane",
    email="jane@example.com",
    password="StrongPassword123!",
)

# Verify email address
harbor.verify_email("verification-token-from-email")

# Login
session_token = harbor.login(
    username="jane",
    password="StrongPassword123!",
)

# Verify session
if harbor.verify_session(session_token):
    print("User is logged in")

# Get current user
current_user = harbor.get_current_user(session_token)
print(current_user.username)

# Create roles and permissions
harbor.roles.create("admin")
harbor.permissions.create("users.delete")

harbor.roles.grant_permission("admin", "users.delete")
harbor.grant_role("jane", "admin")

# Check access
if harbor.has_permission(session_token, "users.delete"):
    print("User can delete users")

current_admin = harbor.require_role(session_token, "admin")
print(current_admin.username)

# Logout
harbor.logout(session_token)

# Change password
session_token = harbor.login(
    username="jane",
    password="StrongPassword123!",
)

harbor.change_password(
    old_password="StrongPassword123!",
    new_password="EvenStrongerPassword123!",
    session_token=session_token,
)

# Send password reset email
harbor.send_password_reset("jane@example.com")

# Reset password
harbor.reset_password(
    new_password="NewStrongPassword123!",
    reset_token="reset-token-from-email",
)

# Delete account
session_token = harbor.login(
    username="jane",
    password="NewStrongPassword123!",
)

harbor.delete_account(
    password="NewStrongPassword123!",
    session_token=session_token,
)
```

## Full FastAPI example with official integrations

If you want to try the full setup with FastAPI, SQLAlchemy, and SMTP, install all official integrations:

```bash
pip install "userharbor[all]"
```

Then create a FastAPI application:

```python
import os

from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from userharbor import UserHarbor
from userharbor_fastapi import UserHarborFastAPI
from userharbor_smtp import SMTPEmailSender
from userharbor_sqlalchemy import SQLAlchemyUserStore

engine = create_engine("sqlite:///users.db")
SessionLocal = sessionmaker(bind=engine)

store = SQLAlchemyUserStore(SessionLocal)
store.metadata.create_all(engine)

email_sender = SMTPEmailSender(
    host=os.getenv("HOST", "smtp.example.com"),
    port=int(os.getenv("PORT", 587)),
    username=os.getenv("USERNAME"),
    password=os.getenv("PASSWORD"),
    from_email=os.getenv("USERNAME", ""),
)

harbor = UserHarbor(
    secret_key="your-secret-key",
    store=store,
    email_sender=email_sender,
)

auth = UserHarborFastAPI(harbor)

app = FastAPI()

app.include_router(auth.router, prefix="/auth", tags=["auth"])

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## Design principles

The project is built around a few constraints.

### The core should stay small

UserHarbor is not meant to become a full identity platform.

The core focuses on basic account-management flows:

- registration
- login
- sessions
- email verification
- password reset
- password change
- account deletion
- simple role-based access control

Anything highly application-specific should stay outside the core.

### Adapters should live outside the core

Database, ORM, email, and framework integrations should be separate packages.

That keeps the core independent and makes it easier for other people to build their own integrations.

For example, someone could build:

- `userharbor-redis`
- `userharbor-mongodb`
- `userharbor-sendgrid`
- `userharbor-resend`
- `userharbor-django`
- `userharbor-flask`

without changing the main package.

### The API should be boring

I am trying to keep the public API explicit and predictable.

No hidden framework magic.
No forced database model.
No dependency on one specific way of building Python applications.

## Current status

The project is still early.

The basic flows work, but I do not consider the API fully stable yet. It is not something I would call production-ready today.

Right now I am mostly looking for feedback around:

- the public API
- the adapter architecture
- the boundary between core and integrations
- the SQLAlchemy integration
- the FastAPI integration
- whether simple RBAC belongs in the core
- what a good developer experience for custom adapters should look like

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

## Feedback welcome

I would appreciate any feedback, especially from people who have built user-management flows multiple times in Python projects.

Does this adapter-based approach make sense?

Would you expect simple roles and permissions to be part of the core, or should they live in a separate package?

And if you were integrating this into your own project, what would you want the API to look like?

_Update: I later wrote [a deeper architectural follow-up about UserHarbor's adapters and executable storage contract]({{< relref "building-userharbor-framework-agnostic-user-management-for-python.md" >}})._

_Originally published on [DEV Community](https://dev.to/spaceshaman/i-built-userharbor-a-framework-agnostic-user-management-library-for-python-1mkj)._
