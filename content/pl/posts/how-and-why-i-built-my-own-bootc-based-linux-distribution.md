---
title: Jak i dlaczego zbudowałem własną dystrybucję Linuxa opartą o bootc
date: 2026-09-20T16:00:00Z
author: SpaceShaman
description: Jak zbudowałem SpaceOS na bazie Fedory i bootc oraz zainstalowałem go obok Debiana na zaszyfrowanym dysku.
tags: [linux, bootc, fedora, spaceos, displaylink]
translationKey: spaceos-bootc-distribution
showToc: true
---

Cóż to była za przygoda 🤠

Wszystko zaczęło się od mojej kolejnej próby skonfigurowania NixOS-a, który miał zastąpić Debiana, z którego korzystam na co dzień.

Bardzo podoba mi się idea stojąca za NixOS-em: deklaratywna konfiguracja całego systemu i możliwość odtworzenia środowiska brzmią świetnie. Niestety w praktyce okazało się to dużo trudniejsze, niż myślałem. Sam język Nix jest w mojej ocenie zupełnie nieintuicyjny, do tego dochodzi dokumentacja, która momentami woła o pomstę do nieba, i sprzeczne informacje o dobrych praktykach rozrzucone po całym internecie. A może to ja jestem za głupi, żeby sobie z tym poradzić? Ciężko stwierdzić XD. W każdym razie podczas bodajże trzeciego podejścia do konfiguracji NixOS-a i kolejnej porażki zacząłem szukać alternatywy. Wtedy trafiłem na bootc.

Jak tylko zacząłem czytać [dokumentację bootc](https://bootc.dev/bootc/), nie mogłem wyjść z zachwytu. Cały system operacyjny opisany w `Containerfile` i budowany jak zwykły obraz kontenera, a do tego aktualizacje i powroty do poprzedniej wersji z użyciem OSTree. Coś pięknego. Oczywiście to nie jest NixOS z inną składnią i nie obiecuje dokładnie tego samego. Ale dawało mi to rzecz, na której najbardziej mi zależało: mogłem trzymać przepis na swój system w repozytorium i budować z niego kolejne wersje bez ręcznego odtwarzania wszystkiego po każdej instalacji.

Szybko przystąpiłem do konfigurowania mojego wymarzonego distro. Jestem z natury minimalistą, dlatego gotowe, mocno wyposażone obrazy przygotowane przez [Universal Blue](https://universal-blue.org/) nie wchodziły w grę. Chciałem sam decydować, co trafia do systemu. Wybór padł na oficjalny obraz `quay.io/fedora/fedora-bootc`, który daje mi bazę Fedory przygotowaną do uruchamiania przez bootc: jądro, podstawowe narzędzia systemowe i mechanizm aktualizacji obrazu. Nie jest to gotowy pulpit z całym zestawem aplikacji, więc resztę mogłem dołożyć sam. Bazę utrzymuje Fedora, a przy kolejnych przebudowach mogę brać jej aktualną wersję zamiast ręcznie składać system od zera.

Oczywiście nie jestem na tyle szalony, żeby od razu przesiąść się na nowy system, zanim będzie gotowy do mojej codziennej pracy.

Na początkowym etapie postanowiłem budować i uruchamiać SpaceOS w maszynie wirtualnej. Obraz tworzyłem Podmanem, z pomocą `bootc-image-builder` zamieniałem go na dysk `qcow2`, a potem uruchamiałem w QEMU. Pozwoliło mi to przygotować podstawową konfigurację i sprawdzić, czy system w ogóle startuje. Szybko jednak okazało się, że budowanie nowego dysku VM po każdej zmianie albo praca wewnątrz maszyny i wykonywanie tam `bootc switch` są dość powolne i frustrujące. Do tego VM nie powie mi wszystkiego o moim komputerze: nie sprawdzę w niej w prosty sposób własnego Wi-Fi, stacji dokującej czy monitorów podłączonych przez DisplayLink.

Postanowiłem więc zainstalować nowy system obok Debiana na fizycznym dysku.

I tutaj zaczęły się małe schody. Jestem trochę paranoikiem i lubię mieć dane zaszyfrowane LUKS-em. Początkowo próbowałem instalować system przez Anacondę, ale przy moim układzie partycji robiło się coraz mniej zabawnie. Miałem też pomysł, żeby Debian i SpaceOS korzystały ze wspólnego GRUB-a. Sam start udało mi się uruchomić, tylko że po przebudowaniu obrazu SpaceOS wpis w GRUB-ie Debiana nie nadążał za nowymi wdrożeniami OSTree. Rollback, który miał być jedną z największych zalet całej zabawy, stawał się przez to niewygodny.

Ostatecznie oba systemy umieściłem w osobnych woluminach logicznych LVM wewnątrz tego samego kontenera LUKS. Każdy dostał własne partycje `/boot` i `/boot/efi` poza szyfrowaniem oraz własny wpis rozruchowy UEFI. Dzięki temu bootc może zarządzać swoim GRUB-em i wpisami kolejnych wersji systemu, a przy starcie komputera wybieram w UEFI Debiana albo SpaceOS. Wspólne jest szyfrowanie danych, nie mechanizm rozruchu.

## Jak to zainstalowałem

Jeśli interesuje cię głównie historia projektu, możesz śmiało przeskoczyć tę sekcję. Poniżej opisuję układ, który zastosowałem u siebie, a nie uniwersalną receptę na każdy dysk.

Operacje na partycjach należą do gatunku niebezpiecznych, więc przed ich wykonaniem polecam zrobić backup. Chyba że lubisz adrenalinę i nie boisz się utraty plików 😉

Na moim dysku układ wygląda tak:

```text
p1  Debian /boot/efi       FAT32
p2  Debian /boot           ext4
p3  wspólny LUKS
    └── grupa LVM
        ├── Debian /        ext4
        ├── swap
        └── SpaceOS /       ext4
p4  SpaceOS /boot          ext4
p5  SpaceOS /boot/efi      FAT32
```

Najpierw zrobiłem miejsce na końcu dysku. Uruchomiłem komputer z pendrive'a z SystemRescue, żeby nie zmniejszać systemu plików, z którego właśnie działa Debian. Po odblokowaniu LUKS-a i aktywowaniu LVM sprawdziłem niezamontowany system plików Debiana i zmniejszyłem go, a dopiero potem dopasowałem rozmiary LVM i partycji LUKS. Tę część trzeba dopasować do własnego układu: kolejność ma znaczenie i nie warto przepisywać cudzych sektorów z internetu, nawet jeśli należą do bardzo sympatycznego autora bloga. Przed zmianami sprawdziłem `lsblk`, `pvs`, `vgs`, `lvs` i tablicę GPT, a po każdej operacji upewniałem się, że Debian nadal uruchamia się poprawnie.

Z wydzielonego miejsca utworzyłem dwie małe partycje poza LUKS-em: około 1 GiB na `/boot` i około 1 GiB na EFI SpaceOS-a. Pozostałą przestrzeń dołączyłem z powrotem do partycji LUKS, powiększyłem znajdujący się w niej fizyczny wolumin LVM przez `pvresize` i stworzyłem nowy wolumin logiczny `spaceos`. Wyszło około 58 GiB na system. Ten wolumin oraz `/boot` sformatowałem jako `ext4`, a partycję EFI jako FAT32. W ten sposób katalog główny SpaceOS-a jest zaszyfrowany razem z Debianem, za to oba systemy mają niezależne pliki rozruchowe.

Po powiększeniu partycji LUKS i odblokowaniu jej, część wewnątrz LVM wyglądała u mnie mniej więcej tak:

```bash
sudo pvresize /dev/mapper/nvme0n1p3_crypt
sudo lvcreate -L 58G -n spaceos ton618-vg
sudo mkfs.ext4 -L SPACEOS_ROOT /dev/ton618-vg/spaceos
sudo mkfs.ext4 -L SPACEOS_BOOT /dev/nvme0n1p4
sudo mkfs.fat -F32 -n SPACEOS_EFI /dev/nvme0n1p5
```

To są nazwy urządzeń z mojego komputera. Szczególnie trzy polecenia formatujące usuną zawartość wskazanych systemów plików, więc przed ich użyciem trzeba sprawdzić, czy numeracja partycji na pewno się zgadza.

Następnie zamontowałem przyszły katalog główny pod `/mnt/spaceos`, partycję rozruchową pod `/mnt/spaceos/boot`, a EFI pod `/mnt/spaceos/boot/efi`. Warto w tym momencie użyć `findmnt` dla wszystkich trzech ścieżek. Jeśli którakolwiek wskazuje na niewłaściwy system plików, to naprawdę nie jest dobry moment na uruchamianie instalatora.

```bash
sudo mkdir -p /mnt/spaceos
sudo mount /dev/ton618-vg/spaceos /mnt/spaceos
sudo mkdir -p /mnt/spaceos/boot
sudo mount /dev/nvme0n1p4 /mnt/spaceos/boot
sudo mkdir -p /mnt/spaceos/boot/efi
sudo mount /dev/nvme0n1p5 /mnt/spaceos/boot/efi
findmnt /mnt/spaceos
findmnt /mnt/spaceos/boot
findmnt /mnt/spaceos/boot/efi
```

Sam obraz buduję lokalnie przez `podman build`. Nie publikuję go jeszcze w żadnym rejestrze, dlatego instalację wykonałem z lokalnego obrazu `localhost/spaceos:latest`, uruchamiając z niego `bootc install to-filesystem`. Ta metoda zakłada, że systemy plików są już przygotowane i zamontowane; bootc nie ma zgadywać, jak chciałem podzielić dysk. Wskazałem mu identyfikatory UUID dla `/` i `/boot`, a w argumentach jądra podałem UUID kontenera LUKS oraz nazwę woluminu LVM. Bez tych ostatnich system nie wiedziałby, co odblokować podczas startu. Mój skrypt wygląda tak, tylko zamiast moich identyfikatorów zostawiam miejsca na twoje:

```bash
#!/usr/bin/env bash
set -euo pipefail

# UUID systemów plików sprawdzisz przez blkid, a UUID kontenera LUKS
# przez cryptsetup luksUUID. W LVM_LV wpisz nazwę grupy i woluminu.
ROOT_UUID="WPISZ_UUID_SYSTEMU_PLIKOW_ROOT"
BOOT_UUID="WPISZ_UUID_PARTYCJI_BOOT"
LUKS_UUID="WPISZ_UUID_KONTENERA_LUKS"
LVM_LV="WPISZ_NAZWE_GRUPY/NAZWE_WOLUMINU"

for value in "$ROOT_UUID" "$BOOT_UUID" "$LUKS_UUID" "$LVM_LV"; do
  if [[ "$value" == WPISZ_* ]]; then
    echo "Najpierw uzupełnij UUID-y i nazwę woluminu LVM." >&2
    exit 1
  fi
done

sudo podman run --rm --privileged \
  --pid=host \
  --ipc=host \
  --security-opt label=type:unconfined_t \
  -v /dev:/dev \
  -v /var/lib/containers:/var/lib/containers \
  -v /mnt/spaceos:/target \
  localhost/spaceos:latest \
  bootc install to-filesystem \
    --bootloader=grub \
    --root-mount-spec="UUID=${ROOT_UUID}" \
    --boot-mount-spec="UUID=${BOOT_UUID}" \
    --karg="rd.luks.uuid=${LUKS_UUID}" \
    --karg="rd.lvm.lv=${LVM_LV}" \
    /target
```

Przed uruchomieniem podmień przykładowe wartości, sprawdź, czy systemy plików są zamontowane pod `/mnt/spaceos`, i czy obraz jest dostępny dla Podmana uruchamianego przez `sudo`.

Był jeszcze jeden haczyk, tym razem bug bootc. Przy dwóch partycjach EFI na tym samym dysku `bootc install to-filesystem` potrafił wybrać pierwszą z nich, czyli tę od Debiana, mimo że pod katalogiem docelowym zamontowałem EFI SpaceOS-a. [Problem opisano też w repozytorium bootc](https://github.com/bootc-dev/bootc/issues/1929). Na czas instalacji odmontowałem więc EFI Debiana i tymczasowo zmieniłem **typ GPT** jego partycji z „EFI System” na zwykłą partycję linuksową. Nie formatowałem jej ani nie usuwałem plików. Po instalacji przywróciłem właściwy typ i ponownie ją zamontowałem. To obejście konkretnego problemu z wyborem partycji, a zarazem krok, przy którym szczególnie łatwo narobić sobie kłopotów, jeśli pomylisz numery partycji.

Na koniec sprawdziłem przez `efibootmgr -v`, czy wpis SpaceOS-a rzeczywiście wskazuje na jego własną partycję EFI. Dopiero wtedy uznałem, że mogę odetchnąć. Po wcześniejszych przygodach z GRUB-em wolałem mieć dowód, a nie tylko dobre przeczucie.

## Rozwijanie systemu od środka

No i teraz zaczęła się przyjemna część całej operacji. Mając poprawnie zainstalowany SpaceOS obok głównego systemu, mogłem rozwijać go już z jego wnętrza. Zmieniam `Containerfile`, buduję nowy obraz lokalnie i przełączam system na niego poleceniem `bootc switch --transport containers-storage localhost/spaceos:latest`. Po restarcie uruchamia się nowe wdrożenie, a gdy coś zepsuję, mogę wrócić do poprzedniego. Właśnie dla takiego przepływu pracy zainteresowałem się bootc.

Instalowanie programów i przygotowywanie konfiguracji przypomina tu budowanie zwykłego kontenera. Aktualnie bazuję na Fedorze 44, używam Swaya, `greetd` z `tuigreet`, Fisha, Alacritty i kilku narzędzi, bez których trudno mi pracować. W repozytorium są też skrypty do zbudowania obrazu VM i instalacyjnego ISO. Projekt nadal się zmienia, więc ta lista nie jest żadną świętą deklaracją pakietów na wieki.

Wpadłem też na pomysł, żeby podczas budowania skopiować repozytorium do `/etc/spaceos` i zrobić z plików konfiguracyjnych dowiązania symboliczne. Dzięki temu mogę edytować konfigurację w jednym miejscu i od razu widzieć zmiany w programach, które czytają ją na bieżąco. Co więcej, niezacommitowane lokalne zmiany w `/etc` nie znikają po samym przełączeniu systemu na nowy obraz. To jednak nie znaczy, że bootc przenosi moje pliki do obrazu: podczas budowania Podman bierze aktualną zawartość katalogu projektu, a podczas wdrożenia OSTree osobno przenosi lokalne zmiany w `/etc` na nową wersję. Jeśli edytuję coś na działającym systemie, muszę pamiętać, czy chcę zachować to tylko lokalnie, czy także w repozytorium.

To rozróżnienie jest ważne. `/usr` i większość systemu pochodzą z obrazu i przy zmianie wersji są zastępowane nową zawartością. `/etc` domyślnie pozostaje zapisywalne i przechodzi przez aktualizacje z uwzględnieniem lokalnych zmian. Dlatego dowiązania do `/etc/spaceos` mają sens w moim eksperymencie, choć wymagają uwagi: jeśli lokalnie zmienię plik, nowa wersja tego samego pliku z obrazu może nie nadpisać mojej edycji. Z kolei `/var` trzyma dane, które mają przetrwać przełączenie i rollback systemu. [Dokumentacja bootc](https://bootc.dev/bootc/filesystem.html) opisuje te zasady znacznie dokładniej.

## DisplayLink, czyli oczywiście nie mogło być za łatwo

Jednym z większych problemów okazały się sterowniki DisplayLink do mojej stacji dokującej. Samo dołożenie pakietu RPM do obrazu wyglądało niewinnie. Potem trzeba jeszcze zbudować moduł EVDI dokładnie dla jądra znajdującego się w obrazie, uruchomić część działającą w przestrzeni użytkownika i sprawić, żeby Sway dogadał się z dodatkowymi ekranami. Już po pierwszych próbach dostałem klasyczny objaw „prawie działa”: obraz się budował, ale po zalogowaniu Sway wywalał mnie z powrotem do `greetd`.

Najpierw próbowałem instalować nieoficjalny pakiet DisplayLink RPM i budować EVDI przez DKMS podczas składania obrazu. Sam proces budowania modułu potrafił zakończyć się sukcesem, co niestety nie oznaczało jeszcze, że sesja graficzna ruszy na fizycznej maszynie. Do tego `bootc container lint` zwracał ostrzeżenia o plikach pozostawionych przez DKMS i inne etapy instalacji. Zacząłem więc oddzielać problem budowania modułu od problemu działania DisplayLink na sprzęcie.

Finalnie podpatrzyłem sposób używania `akmods` w [Universal Blue](https://github.com/ublue-os/akmods) i przeniosłem sam pomysł do własnego `Containerfile`, bez przechodzenia na ich gotowy obraz. W osobnym etapie budowania instaluję narzędzia kompilacyjne i `kernel-devel` pasujący do jądra z `fedora-bootc`, buduję EVDI, sprawdzam, czy moduł faktycznie powstał, a do końcowego obrazu kopiuję wynikowy pakiet wraz z częścią DisplayLink działającą poza jądrem. Dzięki temu kompilatory i cały warsztat nie muszą zostawać w docelowym systemie.

Pakiety biorę z repozytorium [Fedora Multimedia prowadzonego przez Negativo17](https://negativo17.org/), czyli Simone Caronniego. Jeśli używasz Fedory i kiedykolwiek potrzebowałeś czegoś spoza jej podstawowych repozytoriów, mogłeś już trafić na jego pracę. W moim przypadku udostępniane tam pakiety `displaylink`, `libevdi` i `akmod-evdi` oszczędziły mi jeszcze większej ilości ręcznej dłubaniny. Mały ukłon w jego stronę, bo bez takich ludzi nasze „to tylko jeden sterownik” bywałoby znacznie mniej zabawne.

Obecny `Containerfile` buduje EVDI w osobnym etapie i instaluje go w obrazie SpaceOS-a. Musiałem jeszcze zmienić polecenie uruchamiające Swaya w `greetd`, dodając flagę `--unsupported-gpu`. Przetestowałem ten obraz na fizycznym komputerze i tym razem DisplayLink działa ze stacją dokującą, a Sway nie wyrzuca mnie z powrotem do `greetd`. W końcu 😄

## Aktualizacje zarządzane przez CI/CD

Kiedy system zaczął już nadawać się do codziennego używania, lokalne budowanie obrazów przestało mi wystarczać. Jest wygodne podczas pracy nad konfiguracją, ale trudno nazwać je sensownym sposobem publikowania kolejnych wersji systemu. Nie chciałem też pamiętać o ręcznym przebudowywaniu SpaceOS-a za każdym razem, gdy Fedora zaktualizuje obraz bazowy. Przyszedł więc czas na GitHub Actions i GHCR.

Oficjalne wydanie zaczyna się teraz od utworzenia tagu zgodnego ze schematem `v0.1.3`. Workflow sprawdza jego format, buduje obraz SpaceOS-a, generuje dla niego `/etc/os-release` z właściwym numerem wersji i publikuje całość w GitHub Container Registry. Niezmienny tag wersji zostaje w rejestrze na stałe, a znaczniki `stable`, `latest` i `auto` są przesuwane na właśnie wydany obraz. Dzięki temu ktoś śledzący kanał `auto` dostaje nie tylko poprawki z Fedory, ale również nowe wydanie SpaceOS-a.

Ten sam tag uruchamia budowanie instalacyjnego ISO z Anacondą. Gotowy obraz wraz z sumą SHA-256 trafia do nowego GitHub Release. System zainstalowany z tego ISO od początku śledzi tag `auto`, więc po instalacji nie trzeba ręcznie przełączać go na kanał aktualizacji. ISO powstaje wyłącznie dla właściwych wydań. Nie ma sensu produkować kolejnego instalatora tylko dlatego, że w bazowym obrazie Fedory zmieniło się kilka pakietów.

Drugi workflow zajmuje się właśnie takimi zmianami. Raz w tygodniu sprawdza digest obrazu `fedora-bootc:44` i porównuje go z bazą ostatnio opublikowanego SpaceOS-a. Jeżeli Fedora niczego nie zmieniła, akcja kończy pracę bez budowania czegokolwiek. Jeśli digest jest nowy, workflow pobiera kod najnowszego wydania, przebudowuje obraz i publikuje go pod tagiem zawierającym wersję SpaceOS-a, datę oraz fragment digestu bazy, na przykład `auto-v0.1.3-20260920-abcdef123456`. Tag `auto` zostaje przesunięty na ten obraz, a w rejestrze zachowuję pięć najnowszych automatycznych przebudowań. Obrazy oznaczone tagami wydań nie podlegają temu sprzątaniu.

Pozostało pytanie, co zrobić po stronie działającego systemu. Domyślny mechanizm automatycznych aktualizacji bootc nie pasował do mojego sposobu pracy, ponieważ nie chcę, żeby komputer sam postanowił uruchomić się ponownie w najmniej odpowiednim momencie. Zamiast niego dodałem własny timer systemd. Co godzinę sprawdza on kanał aktualizacji, a jeżeli połączenie nie jest taryfowe, poziom baterii nie jest zbyt niski i komputer nie jest mocno obciążony, pobiera oraz przygotowuje nowe wdrożenie w tle. Nie wykonuje restartu. Waybar informuje mnie, że aktualizacja czeka, a nowa wersja zostaje uruchomiona dopiero przy następnym restarcie wykonanym przeze mnie.

## Podsumowanie

SpaceOS zaczął się od frustracji związanej z kolejnym podejściem do NixOS-a, a skończył jako system, którego cały przepis mogę trzymać w Gitcie, testować jak obraz kontenera i aktualizować bez ręcznego odtwarzania środowiska. Po drodze musiałem się zmierzyć z wieloma problemami, ale finalnie udało się.
. Ostatecznie właśnie dzięki tym problemom znacznie lepiej zrozumiałem bootc, OSTree,proces budowania własnego systemu i wiele innych zagadnień związanych z Linuksem.

Kod projektu znajduje się w repozytorium [SpaceOS na GitHubie](https://github.com/SpaceShaman/spaceos). W jego README dokładniej opisałem sam system, instalację, publikowane tagi, sposób aktualizowania, dołączone programy oraz skróty klawiszowe.

Muszę przy tym zaznaczyć, że SpaceOS jest systemem przygotowanym specjalnie pode mnie, mój sprzęt i mój sposób pracy. Raczej nie polecam instalowania go bezpośrednio jako własnego systemu. Zachęcam za to do sforkowania repozytorium i potraktowania go jako punktu startowego do zbudowania swojej własnej, niepowtarzalnej dystrybucji. W końcu największą zaletą takiego podejścia jest właśnie to, że system może być naprawdę twój.
