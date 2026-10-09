---
title: Jak zablokować równoległe wywołania funkcji między procesami w Pythonie
date: 2026-10-08T08:00:00Z
author: SpaceShaman
description: Jak użyć dekoratora i blokady pliku, aby zapobiec równoległemu wykonywaniu funkcji przez różne procesy w Pythonie.
tags: [python, dekoratory, współbieżność, blokady, linux]
translationKey: locking-functions-across-processes
showToc: true
---

Czasami ta sama funkcja może zostać wywołana równolegle przez kilka procesów, choć jej logika zupełnie się do tego nie nadaje. Jeden worker zmienia hasło do zewnętrznego systemu, drugi robi dokładnie to samo, a trzeci próbuje się właśnie zalogować. Każdy chciał dobrze, tylko teraz nikt nie zna aktualnego hasła XD.

Podobny problem pojawia się przy odświeżaniu wspólnych danych, generowaniu tego samego raportu czy modyfikowaniu pliku. Jeśli operacje wejdą sobie w drogę, otrzymujemy klasyczny *race condition*, czyli wyścig, w którym zwycięzcą bywa zgłoszenie błędu.

Chciałem rozwiązać to za pomocą dekoratora, który pozwala wybrać jedno z dwóch zachowań:

- **`skip`** — jeśli ktoś już wykonuje funkcję, pomiń kolejne wywołanie.
- **`wait`** — poczekaj, aż funkcja będzie dostępna, i dopiero wtedy ją wykonaj.

Do tego potrzebowałem opcjonalnego opóźnienia po przejęciu wcześniej zajętej blokady. Niektóre zewnętrzne systemy potrzebują chwili, żeby przetrawić zmianę. Najwyraźniej też lubią przerwę na kawę.

## Dekorator

Do blokowania użyłem [`fcntl.flock`](https://docs.python.org/3/library/fcntl.html#fcntl.flock), które pozwala założyć systemową blokadę na otwarty plik. Moduł `fcntl` jest dostępny na systemach uniksowych, więc ten przykład jest przeznaczony przede wszystkim dla Linuksa. Składnia parametrów typów wymaga Pythona 3.12 lub nowszego.

Tak wygląda cała implementacja:

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

## Jak go używać

Gdy kolejne równoległe wywołanie jest zbędne, wystarczy domyślny tryb `skip`:

```python
@lock_function()
def refresh_shared_cache() -> None:
    ...
```

Pierwszy proces przejmuje blokadę i odświeża dane. Jeśli drugi trafi na zajętą blokadę, pomija ciało funkcji i otrzymuje `None`.

Można też dodać opóźnienie:

```python
@lock_function(mode="skip", delay=60)
def change_password() -> None:
    ...
```

Tutaj wywołanie, które trafiło na zajętą blokadę, **czeka na jej przejęcie, odczekuje dodatkowe 60 sekund i dopiero wtedy kończy się bez wykonania funkcji**. To celowe zachowanie: proces wróci do dalszej pracy po zakończeniu konkurencyjnej operacji i dodatkowej pauzie.

Jeśli każde wywołanie powinno zostać wykonane, wybieramy `wait`:

```python
@lock_function(mode="wait", delay=2)
def update_shared_file(value: str) -> None:
    ...
```

Załóżmy, że funkcję próbują uruchomić trzy procesy. Pierwszy wykonuje ją od razu. Pozostałe dwa czekają. Po zwolnieniu blokady jeden z nich przejmuje ją, odczekuje dwie sekundy i wykonuje funkcję. Następnie przychodzi kolej na ostatni proces.

Wszystkie trzy wywołania zostaną wykonane, ale pojedynczo. Nie należy przy tym zakładać kolejności zgłoszeń — blokada nie jest kolejką z numerkami.

**`delay` działa tylko wtedy, gdy pierwsza próba przejęcia blokady nie powiodła się.** Jeśli blokada była wolna, funkcja rusza bez opóźnienia. Parametr nie jest też limitem czasu oczekiwania: w trybie `wait` proces może czekać tak długo, jak blokada pozostaje zajęta.

## Jak to wszystko działa

### Wspólny plik blokady

Na początku dekorowania funkcji ustalam ścieżkę pliku:

```python
source = str(Path(getfile(func)).resolve()).replace("/", "_").replace(".py", "")
filename = f"{source}_{func.__name__}.lock"
lock_path = Path(gettempdir()) / "locks" / filename
```

`getfile()` zwraca lokalizację funkcji, a `resolve()` tworzy ścieżkę bezwzględną. Zamieniam ukośniki na podkreślenia i dokładam nazwę funkcji, żeby uzyskać nazwę pliku we wspólnym katalogu tymczasowym.

Dzięki temu funkcje o tej samej nazwie w różnych plikach zwykle otrzymają osobne blokady. Argumenty wywołania nie wpływają na nazwę: `update_shared_file("a")` i `update_shared_file("b")` konkurują o ten sam lock.

### Opakowanie oryginalnej funkcji

`decorator` przyjmuje funkcję, a `wrapper` zastępuje ją podczas wywołań. To wewnątrz `wrapper` przejmujemy blokadę i ewentualnie uruchamiamy oryginalne ciało:

```python
return func(*args, **kwargs)
```

`@wraps(func)` zachowuje metadane funkcji, a parametry typów `P` i `R` opisują jej argumenty oraz wynik. Wynik dekorowanej funkcji może dodatkowo być `None`, ponieważ tryb `skip` pozwala pominąć wykonanie.

### Próba przejęcia blokady

Przy każdym wywołaniu tworzę katalog, jeśli go brakuje, i otwieram plik. Następnie próbuję przejąć blokadę:

```python
fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
```

`LOCK_EX` oznacza blokadę wyłączną, a `LOCK_NB` wyłącza oczekiwanie. Jeśli blokada jest zajęta, dostaję `BlockingIOError`. Wtedy albo od razu pomijam wywołanie, albo ponawiam próbę bez `LOCK_NB`, tym razem czekając na dostęp. Szczegóły tych flag opisuje [dokumentacja `flock`](https://man7.org/linux/man-pages/man2/flock.2.html).

Zmienna `contended` zapamiętuje, czy pierwsza próba trafiła na zajętą blokadę.

### Pauza i wykonanie

Po przejęciu wcześniej zajętej blokady wykonuję `sleep(delay)`, a następnie pomijam funkcję lub ją uruchamiam, zależnie od trybu.

Przez całą pauzę **trzymam blokadę**. Dzięki temu inny proces nie wskoczy przede mnie podczas oczekiwania.

### Zwalnianie blokady

Na końcu działa `finally`:

```python
finally:
    fcntl.flock(lock_file, fcntl.LOCK_UN)
```

Blokada zostaje zwolniona także wtedy, gdy funkcja zgłosi wyjątek. Sam wyjątek trafia dalej do wywołującego, a `with` zamyka plik.

Pliku nie usuwam. Jego istnienie nie oznacza zajętej blokady — decyduje o tym systemowy lock. Usunięcie i ponowne utworzenie pliku mogłoby sprawić, że procesy blokowałyby różne pliki pod tą samą ścieżką.

## Gdzie są granice tego rozwiązania

Dekorator jest przygotowany na wyjątki, ale nie na utknięcie funkcji na zawsze. Jeśli połączenie sieciowe do zewnętrznego systemu zawiesi się bez limitu czasu, kod nie dotrze do `finally`, a proces nadal będzie trzymał blokadę. Kolejne wywołania w trybie `wait` lub `skip` z opóźnieniem też mogą wtedy czekać w nieskończoność. Dlatego limity czasu dla takich operacji trzeba ustawić osobno — dekorator pilnuje drzwi, ale nie wyciągnie nikogo z zawieszonej rozmowy telefonicznej.

Procesy muszą widzieć ten sam plik blokady. Osobne katalogi tymczasowe w kontenerach czy inne lokalizacje kodu mogą oznaczać osobne locki. To rozwiązanie do współpracy procesów we wspólnym środowisku, nie gotowa blokada rozproszona.

Podobna pułapka czeka w systemd: usługa z [`PrivateTmp=yes`](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#PrivateTmp=) dostaje własne `/tmp` i `/var/tmp`. Dwie usługi na tym samym hoście, każda z prywatnym `/tmp`, domyślnie utworzą więc różne pliki blokady, nawet jeśli ścieżka w kodzie wygląda identycznie. Każda grzecznie pilnuje swoich drzwi, tylko że to dwa różne wejścia. Jeśli mają się wzajemnie blokować, trzeba zapewnić im wspólny katalog blokad i odpowiednio zmienić `lock_path` albo świadomie współdzielić prywatne katalogi tymczasowe przez `JoinsNamespaceOf=`.

Wszystkie konkurujące wywołania powinny też korzystać z dekoratora. Blokada ma charakter umowny: kod, który ją ignoruje, nadal może zmodyfikować wspólny zasób. [`flock`](https://man7.org/linux/man-pages/man2/flock.2.html) nie przypilnuje za nas całej aplikacji.

## Podsumowanie

Kilka linijek dekoratora wystarcza, żeby przenieść obsługę blokady poza ciało funkcji. `skip` pozwala pominąć konkurencyjne wywołanie, `wait` wykonuje je po przejęciu locka, a `delay` daje dodatkową chwilę oddechu po zajętej blokadzie.

Wyścigów w całym projekcie to nie rozwiąże, ale przynajmniej procesy przestaną przepychać się w drzwiach do tej jednej funkcji 😉.
