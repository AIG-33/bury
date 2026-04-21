# Copy deck — PL / EN / RU

Tone: warm, sporty, with light tennis humor. References: Federer (one-handed backhand), Bury's career (Gstaad 2015 doubles title with Istomin, height 203 cm).

## Brand line

| Locale | Hero line |
|---|---|
| pl | Twój ranking tenisowy. Bez kompromisów. Z odrobiną stylu Federera. |
| en | Your tennis ranking. No compromises. With a touch of Federer's style. |
| ru | Твой теннисный рейтинг. Без компромиссов. Со стилем, как у Федерера. |

## CTAs

| key | pl | en | ru |
|---|---|---|---|
| `cta.start` | Zaczynamy! | Let's go! | Поехали! |
| `cta.find_match` | Znajdź rywala | Find an opponent | Найти соперника |
| `cta.book_slot` | Zarezerwuj kort | Book a court | Забронировать |
| `cta.cancel_booking` | Wycofuję się | I'm out | Сошёл с дистанции |
| `cta.confirm_score` | Potwierdź wynik | Confirm score | Подтвердить счёт |
| `cta.dispute_score` | Oprotestuj wynik (challenge!) | Challenge it! | Оспорить (челлендж!) |

## Toast / status

| key | pl | en | ru |
|---|---|---|---|
| `toast.saved` | Zapisane. Czysto jak as. | Saved. Clean as an ace. | Сохранено. Чисто как эйс. |
| `toast.error` | Net cord. Spróbuj jeszcze raz. | Net cord. Try again. | Сетка. Попробуй ещё раз. |
| `toast.elo_up` | +{n} Elo. Federer kiwa głową z aprobatą. | +{n} Elo. Federer nods in approval. | +{n} к Elo. Федерер одобрительно кивает. |
| `toast.elo_down` | −{n} Elo. Trzeba popracować nad bekhendem. | −{n} Elo. Time to work on that backhand. | −{n} Elo. Поработаем над бэкхендом. |

## Empty states

| where | pl | en | ru |
|---|---|---|---|
| `empty.no_matches` | Cisza na korcie. Zagraj pierwszy mecz! | Silence on court. Go play your first match! | Тишина на корте. Сыграй первый матч! |
| `empty.no_tournaments` | Tu jeszcze nie było żadnego turnieju. Czas to zmienić. | No tournaments here yet. Time to change that. | Турниров ещё не было. Время это изменить. |
| `empty.no_partners` | Nikogo w pobliżu z Twoim poziomem. Rozszerz filtry — albo zaproś znajomego. | Nobody around at your level. Widen filters — or invite a friend. | Никого подходящего рядом. Расширь фильтры — или позови знакомого. |
| `empty.no_reviews` | Trener bez opinii — to jak deblowy mecz w pojedynkę. | A coach without reviews is like singles played in pairs. | Тренер без отзывов — как одиночный матч в паре. |

## Glossary (snippets)

```json
{
  "k_factor": {
    "title": "K-фактор",
    "body": "Коэффициент чувствительности рейтинга. Чем выше — тем сильнее меняется Elo после одного матча. Новички начинают с K=60 (быстрая корректировка), потом K=20."
  },
  "snake_seeding": {
    "title": "Snake seeding",
    "body": "Способ расстановки сеяных в группах: 1-я группа получает №1, 2-я №2 ... затем змейкой назад. Так силы распределяются равномерно."
  },
  "super_tiebreak": {
    "title": "Super-tiebreak",
    "body": "Тай-брейк до 10 очков (с разрывом в 2). Часто играется вместо третьего сета — экономит 30+ минут."
  },
  "no_ad": {
    "title": "No-ad",
    "body": "При счёте 40:40 разыгрывается решающее очко (без преимущества). Принимающий выбирает сторону. Любительская классика для скорости."
  },
  "comped": {
    "title": "Comped",
    "body": "Тренировка отдана бесплатно (промо, компенсация, дружеская). В отличие от 'unpaid' — это намеренная скидка, не долг."
  }
}
```

## Telegram bot replies

| event | pl | en | ru |
|---|---|---|---|
| `tg.start` | Cześć! Wpisz token z aplikacji, aby połączyć konto. | Hi! Send the token from the app to link your account. | Привет! Отправь токен из приложения, чтобы привязать аккаунт. |
| `tg.linked` | Połączone! Będę pisać Ci o meczach i rezerwacjach. | Linked! I'll ping you about matches and bookings. | Привязано! Буду писать о матчах и бронях. |
| `tg.match_proposed` | {name} chce zagrać z Tobą {when}. Co Ty na to? | {name} wants to play {when}. Game on? | {name} зовёт играть {when}. Принимаешь вызов? |

## Onboarding quiz wrap-up

| key | pl | en | ru |
|---|---|---|---|
| `quiz.done.title` | Twój start: **{elo} Elo** | Your start: **{elo} Elo** | Твой старт: **{elo} Elo** |
| `quiz.done.body` | Pierwsze 10 meczów liczy się z większą wagą — system szybko skoryguje Twój prawdziwy poziom. | The first 10 matches count with extra weight — the system will quickly find your true level. | Первые 10 матчей идут с повышенным весом — система быстро найдёт твой реальный уровень. |
