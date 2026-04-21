# User flows — sequence diagrams

## 1. Player onboarding (invitation → quiz → start Elo)

```mermaid
sequenceDiagram
    actor Coach
    actor Player
    participant Web as Next.js
    participant Resend
    participant Auth as Supabase Auth
    participant DB as Postgres

    Coach->>Web: POST /coach/players/invite (email)
    Web->>DB: insert invitations (token_hash)
    Web->>Resend: send email with /invite/<token>
    Resend->>Player: email
    Player->>Web: GET /invite/<token>
    Web->>DB: validate token, mark visited
    Web->>Auth: magic-link or Google OAuth
    Auth->>DB: trigger handle_new_user → profiles row
    Auth-->>Web: session
    Web->>DB: invitations.update accepted_by, accepted_at
    Web->>Player: redirect /onboarding/quiz
    Player->>Web: submit quiz answers
    Web->>DB: read active quiz_version + algorithm config
    Web->>Web: lib/rating/start-elo computes Elo
    Web->>DB: insert quiz_answers, update profiles.current_elo, elo_status='provisional'
    Web->>DB: insert rating_history (reason='onboarding')
    Web->>Player: redirect /me/rating with welcome
```

## 2. Find a Player → friendly match → Elo update

```mermaid
sequenceDiagram
    actor P1 as Player A
    actor P2 as Player B
    participant Web as Next.js
    participant DB as Postgres
    participant Notif as Outbox+Cron

    P1->>Web: /me/find with filters (district, Elo±100, evening)
    Web->>DB: select profiles where district matches AND elo in range AND availability matches
    DB-->>Web: list
    P1->>Web: "Propose Match" to P2
    Web->>DB: insert matches (status='proposed', tournament_id=null)
    Web->>DB: insert notifications_outbox (P2, "match_proposed")
    Notif->>P2: email + Telegram
    P2->>Web: accept proposal
    Web->>DB: matches.update status='scheduled'
    Note over P1,P2: They play offline
    P1->>Web: enter score
    Web->>DB: matches.update sets, confirmed_by_p1=true
    Web->>DB: insert outbox (P2, "score_to_confirm")
    P2->>Web: confirm
    Web->>DB: matches.update confirmed_by_p2=true, outcome='completed'
    Web->>DB: call recalc_match_elo(match_id)
    DB->>DB: read both elos, K-factor (provisional?), multiplier (friendly=0.5)
    DB->>DB: update both profiles.current_elo, insert rating_history twice
    Web->>DB: insert outbox (both, "elo_changed")
```

## 3. Coach creates tournament with bracket

```mermaid
sequenceDiagram
    actor Coach
    participant Web
    participant DB

    Coach->>Web: /coach/tournaments/new
    Note over Web: Wizard step 1 — basic info
    Coach->>Web: name, dates, surface, privacy
    Note over Web: Step 2 — format
    Coach->>Web: choose Single Elimination
    Note over Web: Step 3 — match rules
    Coach->>Web: best_of_3, tiebreak_to=7, super_tb_replaces_3rd=true
    Note over Web: Step 4 — participants
    Coach->>Web: pick 8 players from his club
    Note over Web: Step 5 — confirm
    Web->>DB: insert tournaments + tournament_participants
    Coach->>Web: "Generate draw (rating snake)"
    Web->>Web: lib/tournament/draw.ts → bracket positions
    Web->>DB: insert matches (round 1: 4 matches)
    Web->>Coach: show bracket
    loop Each match completed
        Coach->>Web: enter score
        Web->>DB: matches.update + recalc_match_elo
        Web->>DB: insert next-round match if both halves filled
    end
```

## 4. Coach review (anti-fraud)

```mermaid
sequenceDiagram
    actor Player
    participant Web
    participant DB

    Player->>Web: visit /coaches/<slug>
    Web->>DB: check eligibility (booking or match in last 90d)
    alt Eligible
        Web->>Player: show "Write review" form
        Player->>Web: stars=4, categories, text
        Web->>DB: insert coach_reviews (UNIQUE on source)
        Web->>DB: trigger updates target.coach_avg_rating, coach_reviews_count
    else Not eligible
        Web->>Player: show "Train with this coach to leave a review"
    end
```

## 5. Season race close

```mermaid
sequenceDiagram
    participant Cron as Vercel Cron
    participant Web
    participant DB
    participant Notif

    Cron->>Web: POST /api/cron/seasons (daily)
    Web->>DB: select seasons where status='active' and ends_on < today
    loop For each closing season
        Web->>DB: aggregate scoring across rating_history in [starts_on, ends_on]
        Web->>DB: seasons.update status='closed', winners=[top N]
        Web->>Notif: outbox(top N, "season_winner")
        Web->>Notif: outbox(all participants, "season_results")
    end
```
