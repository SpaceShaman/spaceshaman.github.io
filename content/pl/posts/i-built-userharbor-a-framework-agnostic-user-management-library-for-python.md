---
title: "Stworzyłem UserHarbor — niezależną od frameworka bibliotekę do zarządzania użytkownikami w Pythonie"
date: 2026-07-01T17:19:53Z
author: SpaceShaman
description: Dlaczego stworzyłem UserHarbor i oddzieliłem logikę zarządzania użytkownikami od frameworków webowych, baz danych, ORM-ów i dostawców poczty.
tags: [python, userharbor, open source, web development, fastapi]
translationKey: i-built-userharbor
showToc: true
---

Pracując ostatnio nad aplikacją SaaS, po raz kolejny musiałem zaimplementować ten sam zestaw funkcji związanych z kontami użytkowników:

- rejestrację
- logowanie
- sesje
- weryfikację adresu e-mail
- reset hasła
- zmianę hasła
- usuwanie konta
- podstawowe role i uprawnienia

Żadna z tych rzeczy nie była szczególnie trudna.

Była za to powtarzalna.

Pisałem już wcześniej podobny kod i nie chciałem w każdym nowym projekcie w Pythonie odtwarzać od podstaw tej samej warstwy zarządzania użytkownikami.

Zacząłem więc pracować nad **UserHarbor**.

## Czym jest UserHarbor?

**UserHarbor** to niezależna od frameworka biblioteka Pythona służąca do zarządzania kontami użytkowników.

Założenie jest proste:

> rdzeń powinien pozostać mały, przewidywalny i niezależny od konkretnego frameworka webowego, bazy danych, ORM-u czy dostawcy poczty.

Rdzeń obsługuje logikę zarządzania kontami.
Integracjami zajmują się osobne pakiety adapterów.

Zamiast tworzyć rozwiązanie wyłącznie dla FastAPI, Flaska, Django czy jednego konkretnego stosu technologicznego, chciałem zbudować rdzeń nadający się do użycia w różnych rodzajach aplikacji w Pythonie.

Na przykład w:

- aplikacjach FastAPI
- aplikacjach Flask
- aplikacjach Django
- narzędziach CLI
- narzędziach wewnętrznych
- własnych usługach w Pythonie

## Dlaczego nie użyć po prostu biblioteki dla konkretnego frameworka?

Istnieją już dobre narzędzia przeznaczone dla konkretnych frameworków.

Mnie jednak zależało na czymś nieco innym.

Nie chciałem, aby logika zarządzania użytkownikami była ściśle powiązana z:

- frameworkiem webowym
- warstwą bazy danych
- dostawcą poczty
- konkretnym modelem żądań i odpowiedzi

Zamiast tego UserHarbor używa niewielkich interfejsów dla takich elementów jak przechowywanie danych i wysyłanie wiadomości e-mail.

Główne interfejsy to:

```python
class UserStore:
    ...

class EmailSender:
    ...
```

Rdzenia nie interesuje, w jaki sposób użytkownicy są przechowywani ani jak wysyłane są wiadomości e-mail.

Za tę część odpowiadają adaptery.

## Instalacja

Jeśli chcesz dostarczyć własne implementacje `UserStore` i `EmailSender`, zainstaluj tylko pakiet rdzenia:

```bash
pip install userharbor
```

Aby zainstalować rdzeń wraz z oficjalnymi adapterami SQLAlchemy, SMTP i FastAPI:

```bash
pip install "userharbor[sqlalchemy,smtp,fastapi]"
```

Możesz też od razu zainstalować wszystkie oficjalne integracje:

```bash
pip install "userharbor[all]"
```

## Oficjalne adaptery

Obecnie dostępnych jest kilka oficjalnych pakietów adapterów:

- `userharbor-sqlalchemy` — przechowywanie danych za pomocą SQLAlchemy
- `userharbor-smtp` — wysyłanie wiadomości e-mail przez SMTP
- `userharbor-fastapi` — integracja z FastAPI

Dzięki temu rdzeń pozostaje mały, a jednocześnie typową konfigurację można łatwo zainstalować i uruchomić.

## Szybki przykład

Oto dłuższy przykład wykorzystujący SQLAlchemy do przechowywania danych i SMTP do wysyłania wiadomości e-mail:

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

# Rejestracja użytkownika
harbor.register(
    username="jane",
    email="jane@example.com",
    password="StrongPassword123!",
)

# Weryfikacja adresu e-mail
harbor.verify_email("verification-token-from-email")

# Logowanie
session_token = harbor.login(
    username="jane",
    password="StrongPassword123!",
)

# Weryfikacja sesji
if harbor.verify_session(session_token):
    print("Użytkownik jest zalogowany")

# Pobranie bieżącego użytkownika
current_user = harbor.get_current_user(session_token)
print(current_user.username)

# Utworzenie ról i uprawnień
harbor.roles.create("admin")
harbor.permissions.create("users.delete")

harbor.roles.grant_permission("admin", "users.delete")
harbor.grant_role("jane", "admin")

# Sprawdzenie dostępu
if harbor.has_permission(session_token, "users.delete"):
    print("Użytkownik może usuwać innych użytkowników")

current_admin = harbor.require_role(session_token, "admin")
print(current_admin.username)

# Wylogowanie
harbor.logout(session_token)

# Zmiana hasła
session_token = harbor.login(
    username="jane",
    password="StrongPassword123!",
)

harbor.change_password(
    old_password="StrongPassword123!",
    new_password="EvenStrongerPassword123!",
    session_token=session_token,
)

# Wysłanie wiadomości umożliwiającej zresetowanie hasła
harbor.send_password_reset("jane@example.com")

# Reset hasła
harbor.reset_password(
    new_password="NewStrongPassword123!",
    reset_token="reset-token-from-email",
)

# Usunięcie konta
session_token = harbor.login(
    username="jane",
    password="NewStrongPassword123!",
)

harbor.delete_account(
    password="NewStrongPassword123!",
    session_token=session_token,
)
```

## Pełny przykład FastAPI z oficjalnymi integracjami

Jeśli chcesz wypróbować pełną konfigurację z FastAPI, SQLAlchemy i SMTP, zainstaluj wszystkie oficjalne integracje:

```bash
pip install "userharbor[all]"
```

Następnie utwórz aplikację FastAPI:

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

## Zasady projektowe

Projekt opiera się na kilku założeniach.

### Rdzeń powinien pozostać mały

UserHarbor nie ma stać się kompletną platformą do zarządzania tożsamością.

Rdzeń koncentruje się na podstawowych procesach związanych z zarządzaniem kontami:

- rejestracji
- logowaniu
- sesjach
- weryfikacji adresu e-mail
- resetowaniu hasła
- zmianie hasła
- usuwaniu konta
- prostej kontroli dostępu opartej na rolach

Wszystko, co jest wysoce specyficzne dla danej aplikacji, powinno pozostać poza rdzeniem.

### Adaptery powinny znajdować się poza rdzeniem

Integracje z bazami danych, ORM-ami, pocztą i frameworkami powinny być osobnymi pakietami.

Dzięki temu rdzeń pozostaje niezależny, a inni mogą łatwiej tworzyć własne integracje.

Ktoś mógłby na przykład stworzyć:

- `userharbor-redis`
- `userharbor-mongodb`
- `userharbor-sendgrid`
- `userharbor-resend`
- `userharbor-django`
- `userharbor-flask`

bez modyfikowania głównego pakietu.

### API powinno być nudne

Staram się, aby publiczne API było jawne i przewidywalne.

Bez ukrytej magii frameworka.
Bez narzuconego modelu bazy danych.
Bez zależności od jednego konkretnego sposobu budowania aplikacji w Pythonie.

## Obecny stan

Projekt jest nadal na wczesnym etapie rozwoju.

Podstawowe procesy działają, ale API nie jest jeszcze w pełni stabilne. Obecnie nie nazwałbym tej biblioteki gotową do zastosowań produkcyjnych.

W tej chwili zależy mi przede wszystkim na opiniach dotyczących:

- publicznego API
- architektury adapterów
- granicy pomiędzy rdzeniem a integracjami
- integracji z SQLAlchemy
- integracji z FastAPI
- tego, czy prosty RBAC powinien należeć do rdzenia
- tego, jak powinno wyglądać wygodne tworzenie własnych adapterów

## Linki

Dokumentacja:  
<https://userharbor.github.io/userharbor/>

Repozytorium:  
<https://github.com/userharbor/userharbor>

Integracja FastAPI:  
<https://github.com/userharbor/userharbor-fastapi>

Adapter SQLAlchemy:  
<https://github.com/userharbor/userharbor-sqlalchemy>

Adapter SMTP:  
<https://github.com/userharbor/userharbor-smtp>

## Opinie mile widziane

Będę wdzięczny za wszelkie uwagi, zwłaszcza od osób, które wielokrotnie tworzyły w Pythonie mechanizmy zarządzania użytkownikami.

Czy takie podejście oparte na adapterach ma sens?

Czy spodziewalibyście się prostych ról i uprawnień w rdzeniu, czy raczej w osobnym pakiecie?

A gdybyście integrowali UserHarbor z własnym projektem, jakiego API byście oczekiwali?

_Aktualizacja: później napisałem [bardziej szczegółowy artykuł o architekturze adapterów UserHarbor i wykonywalnym kontrakcie warstwy danych]({{< relref "building-userharbor-framework-agnostic-user-management-for-python.md" >}})._

_Artykuł pierwotnie opublikowany po angielsku na [DEV Community](https://dev.to/spaceshaman/i-built-userharbor-a-framework-agnostic-user-management-library-for-python-1mkj)._
