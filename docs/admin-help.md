# Admin help — HelpPanel content for every admin/coach page

Each section below is a ready-to-use payload for `<HelpPanel why what result />`. Strings live in `messages/{locale}/help.json` under `pages.<key>`.

---

## `/coach/dashboard`

**Why**
Tutaj widzisz to, co dzieje się w klubie tu i teraz: nadchodzące treningi, świeże rezerwacje, aktywne turnieje, średnią ocenę.

**What you can do**
- Przejść do najbliższego treningu w jednym kliknięciu.
- Zaakceptować nowe rezerwacje (jeśli włączone ręczne potwierdzenie).
- Zobaczyć, ile osób się dziś zalogowało po raz pierwszy.

**What happens next**
- Akcja "Potwierdź rezerwację" wyśle graczowi e-mail; w karcie rezerwacji jest też przycisk "Napisz na WhatsApp" do bezpośredniego kontaktu.
- Tworzenie nowego turnieju otworzy 5-krokowego kreatora.

---

## `/coach/players`

**Why**
Lista Twoich graczy. Stąd zapraszasz nowych i zarządzasz klubem.

**What you can do**
- Wysłać zaproszenie na e-mail (jeden gracz lub CSV).
- Zaimportować listę graczy z pliku CSV (kolumny: email, first_name, last_name).
- Zobaczyć profil gracza, jego Elo i historię rezerwacji.

**What happens next**
- Zaproszenie tworzy jednorazowy link ważny 14 dni i wysyła e-mail przez Resend.
- Gracz akceptuje link → automatycznie trafia na quiz startowego Elo, a potem do Twojego klubu.

---

## `/coach/venues`

**Why**
Miejsca, w których prowadzisz treningi. Najpierw lokalizacja (np. "Hala Wola"), potem korty wewnątrz niej.

**What you can do**
- Dodać lokalizację (adres, mapka, udogodnienia, zdjęcia).
- W ramach lokalizacji utworzyć dowolną liczbę kortów (numer, nawierzchnia, status).
- Zaznaczyć kort jako "konserwacja" — zniknie z dostępnych slotów.

**What happens next**
- Dopiero po utworzeniu choć jednego kortu można dodawać sloty.
- Lokalizacje są publiczne — gracze widzą je na liście miejsc.

---

## `/coach/schedule`

**Why**
Sloty treningowe — to, co gracze rezerwują w swoim panelu.

**What you can do**
- Stworzyć pojedynczy slot (data, godzina, kort).
- Stworzyć szablon powtarzający się (np. "wt/cz 18:00 przez 8 tygodni").
- Zablokować datę (urlop, choroba, deszcz).
- Po treningu zaznaczyć status płatności: opłacone / nieopłacone / gratis.

**What happens next**
- Sloty pojawiają się u graczy natychmiast.
- 24h i 2h przed treningiem gracz dostanie przypomnienie e-mail (i Telegram, jeśli włączył tę opcję).
- Anulowanie po terminie zostanie zapisane w dzienniku odwołań.

---

## `/coach/tournaments`

**Why**
Twoje turnieje: lokalne ligi, otwarte turnieje, sparingi grupowe.

**What you can do**
- Utworzyć turniej w 5 krokach (kreator z paskiem postępu).
- Wybrać format (Single Elimination, Round Robin, Group + Playoff, Swiss, Double Elimination, Compass).
- Ustawić zasady meczu (best-of-3/5, single set, pro-set 8/10, super-tiebreak, mecz na czas, do X gemów).
- Wybrać sposób losowania (po rankingu, losowo, ręcznie, hybryda).
- Zarejestrować graczy lub otworzyć rejestrację publiczną.

**What happens next**
- Po wygenerowaniu drabinki gracze widzą siatkę i swoje pierwsze mecze.
- Każdy zatwierdzony wynik aktualizuje Elo wszystkich uczestników.

---

## `/coach/finance`

**Why**
Lekka kontrola płatności — bez integracji bramek (na razie).

**What you can do**
- Oznaczyć rezerwację jako opłacona / nieopłacona / gratis.
- Wyfiltrować po okresie i wyeksportować do CSV.

**What happens next**
- Zmiana statusu trafia do dziennika audytu.
- Statystyka "przychód za miesiąc" w dashboardzie aktualizuje się automatycznie.

---

## `/coach/reviews`

**Why**
Co o Tobie piszą — i jak na to odpowiedzieć.

**What you can do**
- Przeczytać każdą opinię, odpowiedzieć publicznie.
- Zgłosić nieuczciwą opinię — trafi do moderacji administratora.

**What happens next**
- Średnia ocen wyświetla się na Twoim profilu publicznym.
- Po zgłoszeniu opinia zostaje ukryta do decyzji administratora.

---

## `/coach/settings`

**Why**
Ustawienia klubu i preferencje powiadomień.

**What you can do**
- Zmienić nazwę klubu, logo, opis, slug (URL).
- Ustawić politykę odwołań (ile godzin wcześniej można odwołać bezpłatnie).
- Wybrać kanały powiadomień, które do Ciebie docierają.

**What happens next**
- Zmiana sluga wpłynie na publiczny URL Twojego klubu.
- Polityka odwołań blokuje akcje gracza po terminie.

---

## `/admin/onboarding-quiz`

**Why**
Edytor quizu, który widzą nowi gracze. Każde zapisanie tworzy nową wersję — istniejące odpowiedzi są przypisane do swojej wersji.

**What you can do**
- Dodawać/usuwać/zmieniać kolejność pytań.
- Wybrać typ pytania: jedna odpowiedź / wiele / skala 1–10 / liczba.
- Ustawić wagę każdej odpowiedzi w punktach Elo.
- Zobaczyć podgląd quizu tak, jak go widzi gracz.
- Opublikować nową wersję (poprzednia zostaje archiwum).

**What happens next**
- Nowi gracze przechodzą najnowszą aktywną wersję.
- Stare odpowiedzi nie zmienią się — historia jest zachowana.

---

## `/admin/algorithm`

**Why**
Konfiguracja algorytmu rankingowego: startowe Elo, K-faktory, mnożniki.

**What you can do**
- Ustawić bazowe Elo (np. 1000) i zakres clamp (np. 800–2200).
- Dostosować K-faktor dla nowicjuszy/średniaków/weteranów.
- Zmienić mnożniki: sparing ×0.5, turniej ×1.0, finał ×1.25.
- Włączyć opcjonalnie "margin of victory" (różnica w gemach wpływa na Elo).
- Skonfigurować punktację sezonowej rasy (Race).

**What happens next**
- Zmiany dotyczą **przyszłych** meczów. Historia nie jest przeliczana wstecz.
- Tworzona jest nowa wersja konfiguracji — można wrócić do poprzedniej w jednym kliknięciu.

---

## `/admin/seasons`

**Why**
Sezony Race — okresy zbierania punktów, które kończą się nagrodami.

**What you can do**
- Utworzyć nowy sezon (start/koniec/punktacja/top-N).
- Zobaczyć aktualne stojaki bieżącego sezonu.
- Zamknąć sezon ręcznie i ogłosić zwycięzców.

**What happens next**
- Po zamknięciu sezonu zwycięzcy dostają e-mail (i opcjonalnie Telegram), a ich profile zyskują odznakę.

---

## `/admin/templates`

**Why**
Szablony e-maili (główny kanał) na trzech językach. Opcjonalnie — szablony Telegram, jeśli bot jest włączony. WhatsApp Business API zostanie podpięte w fazie 2.

**What you can do**
- Edytować temat i treść szablonu (zmienne w `{{nawiasach}}`).
- Wysłać testowy podgląd na własny adres.

**What happens next**
- Zmiany od razu trafiają do kolejki wysyłek.

---

## `/admin/moderation`

**Why**
Wszystko, co wymaga rąk moderatora: zgłoszone opinie, sporne wyniki, prośby o usunięcie konta.

**What you can do**
- Ukryć/usunąć opinię.
- Anulować spornie zatwierdzony mecz (Elo zostanie cofnięte).
- Usunąć konto gracza zgodnie z RODO.

**What happens next**
- Każda akcja trafia do `audit_log` z autorem i diff-em.

---

## `/admin/users`

**Why**
Globalne wyszukiwanie i nadawanie ról.

**What you can do**
- Znaleźć użytkownika po e-mailu/imieniu/Elo/dystrykcie.
- Nadać rolę `coach` lub `admin`.
- Zablokować konto.

**What happens next**
- Nadanie roli `coach` aktywuje sekcję trenerską w nawigacji użytkownika.
- Blokada wylogowuje sesje natychmiast.
