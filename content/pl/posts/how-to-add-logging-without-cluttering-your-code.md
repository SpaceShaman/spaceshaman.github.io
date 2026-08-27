---
title: Jak tworzyć logi i nie zaśmiecać nimi kodu
date: 2026-08-27T06:06:09Z
author: SpaceShaman
description: Jak wykorzystać menedżery kontekstu i dekoratory, aby tworzyć szczegółowe logi bez zaśmiecania logiki biznesowej.
tags: [python, logowanie, dekoratory, context manager, clean code]
translationKey: logging-without-cluttering-code
showToc: true
---

W jednym z moich projektów w Pythonie musiałem tworzyć dość szczegółowe logi opisujące przebieg działania programu. Kod projektu to w dużej mierze *glue code*, który korzysta z wielu zewnętrznych usług i automatyzuje procesy wykonywane wcześniej ręcznie. Nie mam nad nimi pełnej kontroli, a moja wiedza o ich działaniu jest bardzo ograniczona. Ponieważ różne procesy często korzystają z tych samych usług, opakowałem je w klasy. Przykładowy kod implementujący jedną z automatyzacji wygląda mniej więcej tak:

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

Początkowo logi dodawałem wprost do kodu, np. tak:

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

Nietrudno zauważyć, że kod został mocno zaśmiecony. Jeżeli dodamy do tego dziesiątki podobnych funkcji w całym projekcie, stanie się on nieczytelny i trudny w utrzymaniu.

Pierwszym krokiem do uporządkowania kodu było wyciągnięcie powtarzalnego schematu do osobnego menedżera kontekstu (*context managera*). Każdy etap procesu wyglądał przecież podobnie: zapisz informację o jego rozpoczęciu, wykonaj operację, a następnie zapisz informację o sukcesie albo błędzie.

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

Wszystko przed `yield` wykonuje się przy wejściu do bloku `with`. Jeżeli jego zawartość zakończy się poprawnie, wykonana zostanie gałąź `else`. Jeżeli pojawi się wyjątek, menedżer kontekstu zapisze informację o błędzie i ponownie go zgłosi, dzięki czemu logowanie nie zmieni zachowania aplikacji.

Kod automatyzacji mogłem teraz zapisać w ten sposób:

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

W ten sposób przy każdym etapie nadal otrzymuję wpis informujący o jego rozpoczęciu, zakończeniu albo wystąpieniu błędu, ale logika biznesowa nie jest już poprzeplatana parami niemal identycznych wywołań `logger.info`. Menedżer kontekstu pilnuje również, aby wszystkie zdarzenia były zapisywane w jednakowym formacie.

Kodu jest wprawdzie trochę mniej, ale rezultat wciąż nie wygląda najlepiej. W bardziej skomplikowanych procesach kolejne bloki `with` tworzą wiele dodatkowych wcięć, co może być uciążliwe i mocno pogarszać czytelność.

Na tym etapie wpadłem na pomysł, aby wykorzystać dekoratory do logowania i oznaczać nimi metody klas odpowiedzialnych za komunikację z zewnętrznymi usługami. Dekorator nie musiał implementować całego mechanizmu od nowa — wystarczyło, aby uruchamiał funkcję wewnątrz przygotowanego wcześniej menedżera kontekstu:

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

Taki dekorator działa również w przypadku metod instancji. Opakowana funkcja nadal jest deskryptorem, dlatego Python automatycznie przekaże instancję jako pierwszy argument `self`. Z kolei `@wraps` zachowa nazwę, dokumentację i pozostałe metadane oryginalnej metody.

Mogłem więc przenieść odpowiedzialność za logowanie do klas klientów:

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

Dzięki temu kod procesu wrócił do swojej pierwotnej postaci:

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

Logowanie znalazło się na granicy komunikacji z zewnętrznymi systemami, a funkcja opisująca proces ponownie pokazuje przede wszystkim jego logikę. Każde wywołanie udekorowanej metody nadal generuje wpis informujący o rozpoczęciu, zakończeniu albo wystąpieniu błędu — niezależnie od tego, w ilu automatyzacjach dany klient jest wykorzystywany.

To rozwiązanie ma jednak istotne ograniczenie: komunikat przekazany do dekoratora jest statyczny. Dla każdego zlecenia powstanie więc dokładnie taki sam wpis: `Getting order`. Podczas definiowania klasy nie mogę użyć zapisu `f"Getting order {order_id}"`, ponieważ wartość `order_id` pojawi się dopiero podczas wywołania metody.

Chciałem zachować prostą składnię dekoratora, a jednocześnie umożliwić odwoływanie się w komunikacie do argumentów funkcji:

```python
class OrderClient:
    @log_function("Getting order {order_id}")
    def get_order(self, order_id: str) -> Order:
        return self._api.get_order(order_id)
```

Samo wywołanie `message.format(**kwargs)` nie wystarczy. Metodę można przecież wywołać zarówno jako `get_order(order_id="123")`, jak i `get_order("123")`. W drugim przypadku słownik `kwargs` będzie pusty, natomiast `args` będzie zawierać instancję klienta oraz identyfikator zlecenia.

Python udostępnia do tego odpowiednie narzędzia w module [`inspect`](https://docs.python.org/3/library/inspect.html#introspecting-callables-with-the-signature-object). Funkcja `signature()` odczytuje sygnaturę dekorowanej funkcji, a [`Signature.bind()`](https://docs.python.org/3/library/inspect.html#inspect.Signature.bind) przypisuje otrzymane argumenty pozycyjne i nazwane do nazw jej parametrów. Wynikiem jest obiekt `BoundArguments`, który zawiera gotowe mapowanie, na przykład `{"self": client, "order_id": "123"}`.

Rozszerzona wersja dekoratora wygląda następująco:

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

Sygnatura jest odczytywana tylko raz — podczas dekorowania funkcji. Przy każdym jej wywołaniu `bind()` tworzy mapowanie przekazanych wartości, a `apply_defaults()` uzupełnia je wartościami domyślnymi pominiętych argumentów. Usuwam z niego `self` i `cls`, aby reprezentacja całej instancji nie trafiła przypadkowo do komunikatu. Na koniec `format_map()` podstawia wybrane wartości do szablonu.

Teraz dekoratory mogą korzystać z argumentów metod niezależnie od sposobu ich przekazania:

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

[Składnia formatowania](https://docs.python.org/3/library/string.html#format-string-syntax) pozwala odwoływać się nie tylko bezpośrednio do argumentów, lecz także do ich atrybutów. Dzięki temu `{order.id}` pobierze z obiektu `Order` wyłącznie jego identyfikator. Przykładowe logi stają się znacznie bardziej użyteczne:

```text
Starting: Getting order 123
Finished: Getting order 123
Starting: Creating invoice for order 123 with a 14-day payment term
Finished: Creating invoice for order 123 with a 14-day payment term
```

Nie zdecydowałem się na automatyczne dopisywanie wszystkich argumentów. Lista kosztów, załączniki albo cały obiekt zlecenia mogłyby generować ogromne wpisy, a co gorsza, ujawnić dane osobowe, tokeny lub hasła. Szablon wymusza świadomy wybór informacji potrzebnych do zdiagnozowania problemu — zwykle są to identyfikator zlecenia, nazwa operacji i nowy status. Trzeba również pamiętać, że literówka w nazwie pola szablonu spowoduje zgłoszenie wyjątku `KeyError`, dlatego takie dekoratory warto objąć testami.

Ostatecznie niewielka abstrakcja pozwoliła mi zachować szczegółowe i spójne logi bez zasłaniania nimi właściwej logiki programu. Nie rozwiązuje to każdego problemu związanego z logowaniem, ale w kodzie integrującym wiele zewnętrznych usług sprawdziło się bardzo dobrze.

A jak wygląda logowanie w Twoich projektach? Wolisz jawne wywołania loggera, dekoratory czy inne rozwiązania? Gdzie stawiasz granicę między przydatnym kontekstem a nadmiarem informacji w logach?

_Artykuł możesz również przeczytać po angielsku na [CoderLegion](https://coderlegion.com/25521/how-to-add-logging-without-cluttering-your-code)._
