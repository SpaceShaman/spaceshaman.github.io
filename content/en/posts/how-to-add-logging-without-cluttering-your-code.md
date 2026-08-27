---
title: How to Add Logging Without Cluttering Your Code
date: 2026-08-27T06:06:09Z
author: SpaceShaman
description: How to use context managers and decorators to create detailed logs without cluttering business logic.
tags: [python, logging, decorators, context managers, clean code]
translationKey: logging-without-cluttering-code
showToc: true
---

In one of my Python projects, I needed to create fairly detailed logs describing the program's execution. Most of the project is *glue code* that uses numerous external services and automates processes that were previously performed manually. I do not have full control over them, and my knowledge of how they work is very limited. Because different processes often use the same services, I wrapped those services in classes. The code implementing one of these automations looks roughly like this:

```python
from clients.invoices import InvoiceClient
from clients.orders import OrderClient
from clients.partner import PartnerClient


def export_order(
    order_id: str,
    orders: OrderClient,
    invoices: InvoiceClient,
    partner: PartnerClient,
) -> None:
    order = orders.get_order(order_id)
    attachments = orders.get_attachments(order_id)

    if order.requires_invoice:
        invoice = invoices.create(
            order_id=order_id,
            positions=order.costs,
            payment_term=14,
        )
        attachments.append(invoice)

    partner.send_order(order, attachments)
    orders.set_status(order_id, "exported")
```

At first, I added logging calls directly to the code, like this:

```python
def export_order(
    order_id: str,
    orders: OrderClient,
    invoices: InvoiceClient,
    partner: PartnerClient,
) -> None:
    logger.info(f"Exporting order {order_id}")
    order = orders.get_order(order_id)
    logger.info(f"Got order {order_id}: {order}")

    logger.info(f"Getting attachments for order {order_id}")
    attachments = orders.get_attachments(order_id)

    if order.requires_invoice:
        logger.info(f"Creating invoice for order {order_id}")
        invoice = invoices.create(
            order_id=order_id,
            positions=order.costs,
            payment_term=14,
        )
        logger.info(f"Created invoice for order {order_id}: {invoice}")
        attachments.append(invoice)

    logger.info(f"Sending order {order_id} to partner")
    partner.send_order(order, attachments)
    logger.info(f"Setting status of order {order_id} to 'exported'")
    orders.set_status(order_id, "exported")
```

It is easy to see how cluttered the code has become. Add dozens of similar functions throughout the project, and the code becomes difficult to read and maintain.

My first step toward cleaning it up was to extract the repeated pattern into a separate context manager. After all, every stage of the process looked similar: record when it starts, perform the operation, and then record either its success or failure.

```python
from collections.abc import Iterator
from contextlib import contextmanager


@contextmanager
def log_step(message: str) -> Iterator[None]:
    try:
        logger.info(f"Starting: {message}")
        yield
    except Exception:
        logger.exception(f"Error during: {message}")
        raise
    else:
        logger.info(f"Finished: {message}")
```

Everything before `yield` runs when execution enters the `with` block. If the block completes successfully, the `else` branch runs. If an exception occurs, the context manager records the failure and raises the exception again, so logging does not change the application's behavior.

I could now write the automation code like this:

```python
def export_order(
    order_id: str,
    orders: OrderClient,
    invoices: InvoiceClient,
    partner: PartnerClient,
) -> None:
    with log_step(f"Getting order {order_id}"):
        order = orders.get_order(order_id)
        attachments = orders.get_attachments(order_id)

    if order.requires_invoice:
        with log_step(f"Creating invoice for order {order_id}"):
            invoice = invoices.create(
                order_id=order_id,
                positions=order.costs,
                payment_term=14,
            )
            attachments.append(invoice)

    with log_step(f"Sending order {order_id} to partner"):
        partner.send_order(order, attachments)

    with log_step(f"Setting status of order {order_id} to 'exported'"):
        orders.set_status(order_id, "exported")
```

This way, I still get an entry for the start, completion, or failure of every stage, but the business logic is no longer interleaved with pairs of nearly identical `logger.info` calls. The context manager also ensures that every event is recorded in a consistent format.

There is admittedly a little less code, but the result still does not look ideal. In more complex processes, successive `with` blocks introduce many additional levels of indentation, which can be cumbersome and significantly reduce readability.

At this point, I decided to use decorators for logging and apply them to methods of classes responsible for communicating with external services. The decorator did not need to implement the entire mechanism again—it only needed to execute the function inside the context manager I had already prepared:

```python
from functools import wraps
from typing import Callable, ParamSpec, TypeVar


P = ParamSpec("P")
R = TypeVar("R")


def log_function(message: str):
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            with log_step(message):
                return func(*args, **kwargs)

        return wrapper

    return decorator
```

This decorator also works with instance methods. The wrapped function remains a descriptor, so Python automatically passes the instance as the first argument, `self`. Meanwhile, `@wraps` preserves the original method's name, documentation, and other metadata.

I could therefore move responsibility for logging into the client classes:

```python
class OrderClient:
    @log_function("Getting order")
    def get_order(self, order_id: str) -> Order:
        return self._api.get_order(order_id)

    @log_function("Getting order attachments")
    def get_attachments(self, order_id: str) -> list[Attachment]:
        return self._api.get_attachments(order_id)

    @log_function("Setting order status")
    def set_status(self, order_id: str, status: str) -> None:
        self._api.set_status(order_id, status)


class InvoiceClient:
    @log_function("Creating invoice")
    def create(
        self,
        order_id: str,
        positions: list[Cost],
        payment_term: int,
    ) -> Invoice:
        return self._api.create_invoice(
            order_id=order_id,
            positions=positions,
            payment_term=payment_term,
        )


class PartnerClient:
    @log_function("Sending order to partner")
    def send_order(
        self,
        order: Order,
        attachments: list[Attachment],
    ) -> None:
        self._api.send_order(order, attachments)
```

As a result, the process code returned almost to its original form:

```python
def export_order(
    order_id: str,
    orders: OrderClient,
    invoices: InvoiceClient,
    partner: PartnerClient,
) -> None:
    order = orders.get_order(order_id)
    attachments = orders.get_attachments(order_id)

    if order.requires_invoice:
        invoice = invoices.create(
            order_id=order_id,
            positions=order.costs,
            payment_term=14,
        )
        attachments.append(invoice)

    partner.send_order(order, attachments)
    orders.set_status(order_id, "exported")
```

Logging now lives at the boundary where the application communicates with external systems, while the function describing the process once again focuses on its logic. Every call to a decorated method still generates an entry for its start, completion, or failure—regardless of how many automations use a given client.

This solution has an important limitation, however: the message passed to the decorator is static. Every order therefore produces exactly the same `Getting order` entry. While defining the class, I cannot use `f"Getting order {order_id}"` because the value of `order_id` does not exist until the method is called.

I wanted to retain the decorator's simple syntax while allowing the message to refer to function arguments:

```python
class OrderClient:
    @log_function("Getting order {order_id}")
    def get_order(self, order_id: str) -> Order:
        return self._api.get_order(order_id)
```

Simply calling `message.format(**kwargs)` is not enough. After all, the method can be called as either `get_order(order_id="123")` or `get_order("123")`. In the second case, the `kwargs` dictionary is empty, while `args` contains the client instance and the order identifier.

Python provides the appropriate tools for this in the [`inspect`](https://docs.python.org/3/library/inspect.html#introspecting-callables-with-the-signature-object) module. The `signature()` function reads the decorated function's signature, while [`Signature.bind()`](https://docs.python.org/3/library/inspect.html#inspect.Signature.bind) maps the supplied positional and keyword arguments to its parameter names. The result is a `BoundArguments` object containing a ready-to-use mapping such as `{"self": client, "order_id": "123"}`.

The extended version of the decorator looks like this:

```python
from functools import wraps
from inspect import signature
from typing import Callable, ParamSpec, TypeVar


P = ParamSpec("P")
R = TypeVar("R")


def log_function(
    message_template: str,
) -> Callable[[Callable[P, R]], Callable[P, R]]:
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        func_signature = signature(func)

        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            bound_args = func_signature.bind(*args, **kwargs)
            bound_args.apply_defaults()
            log_context = {
                name: value
                for name, value in bound_args.arguments.items()
                if name not in {"self", "cls"}
            }
            message = message_template.format_map(log_context)

            with log_step(message):
                return func(*args, **kwargs)

        return wrapper

    return decorator
```

The signature is read only once, when the function is decorated. On every call, `bind()` builds a mapping of the supplied values, and `apply_defaults()` fills in the default values of omitted arguments. I remove `self` and `cls` from that mapping to prevent the representation of an entire instance from accidentally ending up in the message. Finally, `format_map()` substitutes the selected values into the template.

The decorators can now use method arguments regardless of how those arguments are passed:

```python
class OrderClient:
    @log_function("Getting order {order_id}")
    def get_order(self, order_id: str) -> Order:
        return self._api.get_order(order_id)

    @log_function("Getting attachments for order {order_id}")
    def get_attachments(self, order_id: str) -> list[Attachment]:
        return self._api.get_attachments(order_id)

    @log_function("Setting order {order_id} status to {status}")
    def set_status(self, order_id: str, status: str) -> None:
        self._api.set_status(order_id, status)


class InvoiceClient:
    @log_function(
        "Creating invoice for order {order_id} "
        "with a {payment_term}-day payment term"
    )
    def create(
        self,
        order_id: str,
        positions: list[Cost],
        payment_term: int,
    ) -> Invoice:
        return self._api.create_invoice(
            order_id=order_id,
            positions=positions,
            payment_term=payment_term,
        )


class PartnerClient:
    @log_function("Sending order {order.id} to partner")
    def send_order(
        self,
        order: Order,
        attachments: list[Attachment],
    ) -> None:
        self._api.send_order(order, attachments)
```

[Format string syntax](https://docs.python.org/3/library/string.html#format-string-syntax) supports references not only to arguments themselves but also to their attributes. Therefore, `{order.id}` retrieves only the identifier from an `Order` object. The resulting logs become much more useful:

```text
Starting: Getting order 123
Finished: Getting order 123
Starting: Creating invoice for order 123 with a 14-day payment term
Finished: Creating invoice for order 123 with a 14-day payment term
```

I chose not to append every argument automatically. A list of costs, attachments, or the entire order object could generate enormous entries and, worse, expose personal data, tokens, or passwords. The template forces a deliberate choice of the information needed to diagnose a problem—usually an order identifier, the operation name, and the new status. It is also important to remember that a typo in a template field name raises a `KeyError`, so decorators like this should be covered by tests.

Ultimately, a small abstraction allowed me to retain detailed, consistent logs without letting them obscure the program's actual logic. It does not solve every logging problem, but it has worked very well in code that integrates numerous external services.

What does logging look like in your projects? Do you prefer explicit logger calls, decorators, or another solution? Where do you draw the line between useful context and too much information in your logs?
