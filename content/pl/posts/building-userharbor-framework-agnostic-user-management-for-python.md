---
title: "Rozwój UserHarbor: od niezależnego rdzenia do wykonywalnych kontraktów warstwy danych"
date: 2026-08-17T12:31:04Z
author: SpaceShaman
description: Jak UserHarbor rozwinął się od niezależnego rdzenia w architekturę opartą na adapterach i wykonywalnym kontrakcie warstwy danych.
tags: [python, userharbor, architektura, uwierzytelnianie, open source]
translationKey: building-userharbor
showToc: true
---

Zarządzanie użytkownikami jest jednym z tych problemów, które rzadko wydają się na tyle trudne, by poświęcać im wiele uwagi.

Dopóki nie zaimplementujesz go po raz piąty.

Rejestracja, logowanie, sesje, weryfikacja adresu e-mail, resetowanie i zmiana hasła, usuwanie konta, role, uprawnienia — żadna z tych funkcji nie jest szczególnie nietypowa. Niemal każda aplikacja potrzebuje jednak jakiejś ich kombinacji, a implementacja często staje się ściśle powiązana z frameworkiem, ORM-em lub infrastrukturą, których akurat użyto w projekcie.

Właśnie ten problem skłonił mnie do zbudowania **UserHarbor**.

UserHarbor to niezależna od frameworka biblioteka Pythona do zarządzania kontami użytkowników. Jej celem nie jest stworzenie kolejnego frameworka webowego ani kompletnej platformy tożsamości. Zamiast tego udostępnia niewielkie API na poziomie domeny dla typowych operacji na kontach, pozostawiając obsługę HTTP, baz danych i wysyłkę wiadomości e-mail osobnym integracjom.

Odkąd po raz pierwszy napisałem o tym projekcie, coraz ciekawsza staje się dla mnie nie tylko sama warstwa uwierzytelniania, lecz przede wszystkim granica pomiędzy rdzeniem a jego integracjami.

_Ten artykuł rozwija [moje pierwotne wprowadzenie do UserHarbor]({{< relref "i-built-userharbor-a-framework-agnostic-user-management-library-for-python.md" >}}) i skupia się na tym, jak zmieniała się architektura wraz z rozwojem projektu._

## Problem, który chciałem rozwiązać

Wyobraźmy sobie budowę dwóch aplikacji.

Pierwsza korzysta z:

- FastAPI
- SQLAlchemy
- PostgreSQL
- SMTP

Druga korzysta z:

- Flaska
- MongoDB
- zewnętrznego API do wysyłania wiadomości e-mail

Reguły zarządzania użytkownikami są w większości takie same.

Hasło nadal trzeba zweryfikować i zahaszować. Token weryfikacyjny nadal musi wygasnąć. Tokeny resetowania hasła nadal wymagają ochrony. Sesje trzeba tworzyć i unieważniać. Role i uprawnienia trzeba sprawdzać.

W wielu bibliotekach reguły te są jednak wymieszane z modelami bazy danych, handlerami HTTP albo abstrakcjami właściwymi dla konkretnego frameworka.

Chciałem czegoś przeciwnego.

Rdzeń powinien wiedzieć, **co powinno się wydarzyć**, ale niekoniecznie **w jaki sposób aplikacja przechowuje lub przesyła dane**.

Prowadzi to do architektury wyglądającej mniej więcej tak:

```text
Aplikacja / framework
        │
        ▼
    UserHarbor
        │
        ├── UserStore
        │       └── baza danych / ORM / własny backend
        │
        └── EmailSender
                └── SMTP / API / własny dostawca
```

Rdzeń odpowiada za rejestrację, walidację, haszowanie haseł, generowanie i haszowanie tokenów, obsługę sesji oraz reguły autoryzacji.

Adaptery odpowiadają za infrastrukturę.

## Niewielkie API na poziomie domeny

UserHarbor obsługuje obecnie typowy cykl życia konta:

- rejestrację użytkownika
- weryfikację adresu e-mail
- logowanie
- sesje
- wylogowanie z jednej lub wszystkich sesji
- zmianę hasła
- reset hasła
- usunięcie konta
- role i uprawnienia

Celowo nie udostępnia własnych endpointów HTTP.

Dzięki temu kod korzystający z rdzenia może wyglądać następująco:

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

Tej samej instancji `UserHarbor` można używać w FastAPI, Flasku, Django, aplikacji CLI albo w programie, który w ogóle nie udostępnia HTTP.

Autoryzacja działa według tej samej zasady:

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

Jeśli natomiast dostęp ma zostać wymuszony:

```python
user = harbor.require_permission(
    session_token,
    "users.delete",
)
```

UserHarbor implementuje prostą kontrolę dostępu opartą na rolach, ale pozostawia politykę autoryzacji właściwą dla aplikacji poza rdzeniem. Celowo nie próbuje stać się uniwersalnym silnikiem polityk.

## Niezależność od frameworka nie oznacza nieprzyjazności wobec frameworków

Chciałem uniknąć sytuacji, w której niezależność od frameworka odbywa się kosztem wygody programisty.

Dlatego istnieje między innymi oficjalna integracja `userharbor-fastapi`.

Zamiast ręcznie pisać trasy uwierzytelniania i zależności, aplikacja FastAPI może skonfigurować UserHarbor i dołączyć adapter:

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

Adapter dostarcza warstwę specyficzną dla frameworka: routery, schematy żądań, zależności uwierzytelniania bearer, mapowanie błędów oraz funkcje pomocnicze do wymagania określonych ról lub uprawnień.

Najważniejsze jest to, że FastAPI nadal nie przenika do rdzenia UserHarbor.

Możesz zmienić framework webowy bez zmiany logiki zarządzania kontami.

## Trudniejszy problem: co znaczy zaimplementować `UserStore`?

Początkowo oddzielenie mechanizmu persystencji za interfejsem `UserStore` wydawało się oczywistym rozwiązaniem.

Definiujemy interfejs i implementujemy jego metody, dzięki czemu SQLAlchemy, MongoDB, Redis czy dowolne inne rozwiązanie może dostarczać warstwę przechowywania danych.

Istnieje jednak subtelny problem.

Zgodność sygnatur metod nie oznacza, że dwie implementacje warstwy danych zachowują się tak samo.

Weźmy pod uwagę token resetowania hasła.

Czy utworzenie nowego tokenu powinno usunąć poprzedni?

Co dzieje się po usunięciu użytkownika?

Czy jego sesje powinny zniknąć automatycznie?

Co powinno się stać, jeśli transakcja nie powiedzie się w połowie zmiany hasła?

Czy próba usunięcia czegoś, co już nie istnieje, powinna zgłosić błąd?

Te zachowania są częścią kontraktu warstwy danych, choć system typów Pythona nie potrafi ich wyrazić.

Stało się to jedną z najważniejszych zmian w UserHarbor 0.7.0.

## Zamiana kontraktu adaptera w wykonywalne testy

UserHarbor zawiera teraz zestaw testów kontraktowych wielokrotnego użytku dla implementacji `UserStore`.

Adapter może zaimportować cały zestaw:

```python
# tests/test_user_store_contract.py

from userharbor.testing.user_store_contract import *
```

Musi jedynie dostarczyć czystą instancję warstwy danych:

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

Te same testy można następnie uruchamiać dla SQLAlchemy, implementacji przechowującej dane w pamięci lub zupełnie innego backendu persystencji.

Wersja 0.7.0 wprowadziła **57 testów kontraktowych wielokrotnego użytku**, obejmujących użytkowników, hasze haseł, tokeny weryfikacji i resetu hasła, sesje, role, uprawnienia, relacje oraz zachowanie transakcji.

Zmienia to znaczenie adaptera.

Zgodny `UserStore` nie tylko deklaruje implementację interfejsu. Może wykazać, że przestrzega semantyki zachowań oczekiwanej przez rdzeń.

Kontrakt określa na przykład, że:

- nazwy użytkowników i adresy e-mail są unikalne
- utworzenie użytkownika i początkowego tokenu weryfikacyjnego jest atomowe
- nowy token weryfikacyjny zastępuje poprzedni
- nowy token resetowania hasła zastępuje poprzedni
- usunięcie użytkownika usuwa jego sesje i powiązane tokeny
- wielokrotne przypisanie tej samej relacji jest idempotentne
- usunięcie ról i uprawnień usuwa także ich przypisania
- pomyślne transakcje są zatwierdzane
- nieudane transakcje są wycofywane
- zagnieżdżone transakcje uczestniczą w transakcji zewnętrznej

Podczas implementowania kolejnego backendu łatwo przeoczyć te szczegóły. To właśnie takie różnice mogą powodować błędy uwierzytelniania, które ujawniają się dopiero znacznie później.

Dla mnie był to ważny krok w rozwoju architektury: abstrakcję opisują teraz nie tylko protokoły Pythona i dokumentacja, lecz również wykonywalne zachowanie.

## Szablon do budowania nowych adapterów warstwy danych

Aby uprościć ten proces, stworzyłem także `userharbor-inmemory`.

Jest to minimalna implementacja `UserStore`, która przechowuje dane w pamięci i przechodzi cały kontrakt warstwy danych.

Pełni dwie funkcje.

Po pierwsze, przydaje się w testach i przykładach, które nie wymagają prawdziwej bazy danych.

Po drugie, samo repozytorium może służyć jako szablon do tworzenia nowych integracji warstwy danych. Programista może zacząć od działającej implementacji i przechodzących testów kontraktowych, stopniowo zastępować backend in-memory, a przy tym stale sprawdzać, czy nowy adapter nadal zachowuje się poprawnie.

Chodzi o to, by tworzenie przyszłego adaptera bazy danych sprowadzało się przede wszystkim do następującego procesu:

```text
działający szablon UserStore
        │
        ▼
zastąpienie implementacji persystencji
        │
        ▼
uruchomienie wspólnych testów kontraktowych
        │
        ▼
dodanie testów specyficznych dla backendu
```

zamiast odtwarzania oczekiwanego zachowania na podstawie implementacji rdzenia.

## Zachowanie związane z bezpieczeństwem pozostaje w rdzeniu

Kolejną ważną granicą architektury jest to, że adaptery warstwy danych nigdy nie otrzymują surowych tokenów do zapisania.

UserHarbor generuje surowe tokeny weryfikacyjne, resetowania hasła i sesji, ale haszuje je przed przekazaniem do `UserStore`.

Surowy token trafia wyłącznie do tej części aplikacji, która go potrzebuje — na przykład do mechanizmu wysyłania e-maili albo do użytkownika po zalogowaniu.

Baza danych przechowuje hasz.

Rdzeń odpowiada także za zachowania takie jak wygasanie tokenów i walidacja sesji.

Operacje, które mogłyby ujawniać istnienie konta, w odpowiednich miejscach zwracają neutralne odpowiedzi. Przykładowo prośba o reset hasła dla nieznanego adresu e-mail nie zdradza, czy konto o takim adresie istnieje.

Istnieją też powiadomienia o zdarzeniach w cyklu życia konta, takich jak:

- udana weryfikacja adresu e-mail
- zmiana hasła
- reset hasła
- usunięcie konta

Interfejs `EmailSender` decyduje, w jaki sposób wiadomości zostaną dostarczone, ale nie rozstrzyga, kiedy dana operacja jest prawidłowa. Ta decyzja pozostaje w rdzeniu.

## SQLAlchemy bez przejmowania kontroli nad aplikacją

Oficjalny adapter SQLAlchemy jest gotowy do użycia, lecz jednym z wymagań projektowych było to, by wdrożenie UserHarbor nie zmuszało aplikacji do przyjęcia całkowicie osobnego modelu użytkownika.

Domyślnie adapter może zarządzać własną tabelą użytkowników.

Aplikacje, które mają już model SQLAlchemy, mogą jednak przekazać go adapterowi:

```python
store = SQLAlchemyUserStore(
    SessionLocal,
    user_model=AppUser,
)
```

Aplikacja może również mapować swój model na bogatszy publiczny obiekt użytkownika, zamiast ograniczać się do minimalnej reprezentacji UserHarbor.

Dokumentacja opisuje teraz także użycie adaptera z migracjami Alembic zamiast polegania na `metadata.create_all()` podczas uruchamiania aplikacji.

To rozróżnienie ma znaczenie: przykłady powinny być łatwe do uruchomienia, ale prawdziwe aplikacje potrzebują rozsądnego sposobu zarządzania zmianami schematu.

## Instalacja

Sam rdzeń można zainstalować następująco:

```bash
pip install userharbor
```

Można też dołączyć wybrane oficjalne integracje:

```bash
pip install "userharbor[sqlalchemy,smtp,fastapi]"
```

Aby przetestować kompletny oficjalny zestaw:

```bash
pip install "userharbor[all]"
```

Główne oficjalne integracje obejmują obecnie warstwę danych SQLAlchemy, wysyłkę wiadomości przez SMTP oraz obsługę FastAPI.

## Czym UserHarbor celowo nie powinien się stać

Niekontrolowane rozrastanie się zakresu funkcji to łatwa pułapka w tego rodzaju projekcie.

Gdy mamy już uwierzytelnianie, kusi nas dodanie OAuth. Następnie logowania społecznościowego. Potem MFA, organizacji, zespołów, list ACL, własności zasobów, paneli administracyjnych i języka polityk.

W końcu „mała biblioteka uwierzytelniania” staje się frameworkiem aplikacyjnym.

Właśnie tego staram się uniknąć.

Rdzeń powinien pozostać skoncentrowany na typowych, podstawowych operacjach zarządzania kontami.

Bardziej wyspecjalizowane funkcje mogą powstawać jako integracje lub osobne biblioteki, jeśli pojawi się na nie zapotrzebowanie. Nie powinny jednak komplikować podstawowego pakietu wszystkim jego użytkownikom.

Jedna z zasad projektowych UserHarbor jest więc celowo nudna:

**stabilność jest ważniejsza niż liczba funkcji.**

Gdy publiczne API się ustabilizuje, wolę przeznaczać czas na bezpieczeństwo, niezawodność, zgodność i wydajność niż nieustannie poszerzać zakres rdzenia.

## Obecny stan

UserHarbor znajduje się obecnie w wersji **0.7.0**.

Projekt jest wciąż młody i nie uważam jeszcze ani jego API za stabilne, ani samej biblioteki za gotową do zastosowań produkcyjnych.

Na tym etapie projekt służy w równym stopniu sprawdzaniu architektury, co dodawaniu funkcji.

Szczególnie zależy mi na opinii dotyczącej:

- granicy pomiędzy rdzeniem a integracjami
- kontraktu `UserStore`
- podejścia opartego na testach kontraktowych
- integracji z FastAPI
- własnych backendów warstwy danych
- kształtu publicznego API
- tego, co powinno — a co nie powinno — należeć do rdzenia

W Pythonie istnieje wiele dobrych bibliotek uwierzytelniania przeznaczonych dla konkretnych frameworków.

UserHarbor bada nieco inne pytanie:

**Czy sama domena zarządzania kontami może być wielokrotnie wykorzystywana z różnymi frameworkami i infrastrukturą, podczas gdy integracje pozostają małe, wymienne i niezależnie testowalne?**

Jak dotąd uważam, że właśnie ta granica okazuje się najciekawszą częścią projektu.

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

_Artykuł pierwotnie opublikowany po angielsku na [CoderLegion](https://coderlegion.com/24763/building-userharbor-framework-agnostic-user-management-for-python)._
