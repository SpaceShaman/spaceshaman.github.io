---
title: How to Lock a Function Across Processes with a Decorator in Python
date: 2026-10-08T00:08:00Z
author: SpaceShaman
description: How to use a decorator and a file lock to prevent different processes from executing a function concurrently in Python.
tags: [python, decorators, concurrency, locks, linux]
translationKey: locking-functions-across-processes
showToc: true
---

Sometimes several processes can call the same function at once, even though its logic is completely unsuited to that. One worker changes the password for an external system, another does exactly the same thing, and a third is trying to log in. Everyone meant well, but now nobody knows the current password XD.

A similar problem comes up when refreshing shared data, generating the same report, or modifying a file. If these operations get in each other's way, we get a classic *race condition*: a race where the winner sometimes turns out to be an error message.

I wanted to solve this with a decorator that lets you choose between two behaviors:

- **`skip`** — if someone is already executing the function, skip the next call.
- **`wait`** — wait until the function is available, then execute it.

I also needed an optional delay after acquiring a lock that had previously been held. Some external systems need a moment to digest a change. Apparently, they enjoy coffee breaks too.

## The Decorator

For locking, I used [`fcntl.flock`](https://docs.python.org/3/library/fcntl.html#fcntl.flock), which lets you place an operating system lock on an open file. The `fcntl` module is available on Unix systems, so this example is primarily intended for Linux. The type parameter syntax requires Python 3.12 or later.

Here's the complete implementation:

```python
import fcntl
from collections.abc import Callable
from functools import wraps
from inspect import getfile
from pathlib import Path
from tempfile import gettempdir
from time import sleep
from typing import Literal


def lock_function[**P, R](
    mode: Literal["skip", "wait"] = "skip",
    delay: float = 0,
) -> Callable[[Callable[P, R]], Callable[P, R | None]]:
    def decorator(func: Callable[P, R]) -> Callable[P, R | None]:
        source = str(Path(getfile(func)).resolve()).replace("/", "_").replace(".py", "")
        filename = f"{source}_{func.__name__}.lock"
        lock_path = Path(gettempdir()) / "locks" / filename

        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R | None:
            lock_path.parent.mkdir(parents=True, exist_ok=True)
            with lock_path.open("a") as lock_file:
                try:
                    fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    if mode == "skip" and delay == 0:
                        return None
                    fcntl.flock(lock_file, fcntl.LOCK_EX)
                    contended = True
                else:
                    contended = False

                try:
                    if contended:
                        sleep(delay)
                        if mode == "skip":
                            return None
                    return func(*args, **kwargs)
                finally:
                    fcntl.flock(lock_file, fcntl.LOCK_UN)

        return wrapper

    return decorator
```

## How to Use It

When another concurrent call is unnecessary, the default `skip` mode is enough:

```python
@lock_function()
def refresh_shared_cache() -> None:
    ...
```

The first process acquires the lock and refreshes the data. If the second encounters a lock that's already held, it skips the function body and receives `None`.

You can also add a delay:

```python
@lock_function(mode="skip", delay=60)
def change_password() -> None:
    ...
```

Here, a call that encounters a lock that's already held **waits to acquire it, waits another 60 seconds, and only then returns without executing the function**. This behavior is intentional: the process resumes its other work after the competing operation has finished and the extra pause has elapsed.

If every call should be executed, choose `wait`:

```python
@lock_function(mode="wait", delay=2)
def update_shared_file(value: str) -> None:
    ...
```

Suppose three processes try to run the function. The first executes it immediately. The other two wait. Once the lock is released, one of them acquires it, waits two seconds, and executes the function. Then it's the last process's turn.

All three calls will execute, but one at a time. Don't assume they'll run in the order they arrived, though — a lock isn't a queue with numbered tickets.

**`delay` applies only when the first attempt to acquire the lock fails.** If the lock was free, the function starts without a delay. This parameter isn't a timeout either: in `wait` mode, a process can wait for as long as the lock remains held.

## How It All Works

### A Shared Lock File

When decorating the function, I first determine the file path:

```python
source = str(Path(getfile(func)).resolve()).replace("/", "_").replace(".py", "")
filename = f"{source}_{func.__name__}.lock"
lock_path = Path(gettempdir()) / "locks" / filename
```

`getfile()` returns the function's location, and `resolve()` produces an absolute path. I replace slashes with underscores and append the function name to produce a filename in the shared temporary directory.

This means functions with the same name in different files will usually get separate locks. Call arguments don't affect the name: `update_shared_file("a")` and `update_shared_file("b")` compete for the same lock.

### Wrapping the Original Function

`decorator` takes a function, and `wrapper` replaces it when it's called. Inside `wrapper`, we acquire the lock and, if appropriate, run the original body:

```python
return func(*args, **kwargs)
```

`@wraps(func)` preserves the function's metadata, while the type parameters `P` and `R` describe its arguments and return value. The decorated function can also return `None`, because `skip` mode allows execution to be skipped.

### Attempting to Acquire the Lock

On each call, I create the directory if it's missing and open the file. Then I try to acquire the lock:

```python
fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
```

`LOCK_EX` means an exclusive lock, and `LOCK_NB` disables waiting. If the lock is already held, I get a `BlockingIOError`. I then either skip the call immediately or retry without `LOCK_NB`, this time waiting for access. The [`flock` documentation](https://man7.org/linux/man-pages/man2/flock.2.html) describes these flags in detail.

The `contended` variable records whether the first attempt encountered a lock that was already held.

### Pausing and Executing

After acquiring a lock that was previously held, I run `sleep(delay)` and then either skip the function or execute it, depending on the mode.

I **hold the lock** throughout the pause. This prevents another process from jumping ahead of me while I wait.

### Releasing the Lock

Finally, the `finally` block runs:

```python
finally:
    fcntl.flock(lock_file, fcntl.LOCK_UN)
```

The lock is released even if the function raises an exception. The exception itself propagates to the caller, and `with` closes the file.

I don't delete the file. Its existence doesn't mean the lock is held — that's determined by the operating system lock. Deleting and recreating the file could cause processes to lock different files at the same path.

## The Limits of This Approach

The decorator handles exceptions, but it isn't prepared for a function getting stuck forever. If a network connection to an external system hangs without a timeout, the code won't reach `finally`, and the process will keep holding the lock. Subsequent calls in `wait` mode or `skip` mode with a delay can then wait forever too. That's why timeouts for these operations need to be configured separately — the decorator guards the door, but it won't rescue anyone from a never-ending phone call.

The processes must see the same lock file. Separate temporary directories in containers or different code locations can mean separate locks. This is a solution for coordinating processes in a shared environment, rather than a ready-made distributed lock.

A similar trap awaits in systemd: a service with [`PrivateTmp=yes`](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#PrivateTmp=) gets its own `/tmp` and `/var/tmp`. Two services on the same host, each with a private `/tmp`, will therefore create different lock files by default, even if the path in the code looks identical. Each politely guards its own door, but those are two different entrances. If they need to block each other, give them a shared lock directory and adjust `lock_path` accordingly, or deliberately share their private temporary directories through `JoinsNamespaceOf=`.

All competing calls should also use the decorator. The lock is advisory: code that ignores it can still modify the shared resource. [`flock`](https://man7.org/linux/man-pages/man2/flock.2.html) won't keep the entire application in check for us.

## Summary

A few lines of decorator code are enough to move lock handling out of the function body. `skip` lets you skip a competing call, `wait` executes it after acquiring the lock, and `delay` provides a little extra breathing room after encountering a lock that was already held.

This won't solve every race condition in the project, but at least the processes will stop jostling in the doorway to this one function 😉.
