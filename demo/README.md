# Demo

Runs the whole module locally against the Firebase emulators.

```bash
# once
npm install && npm --prefix demo install && npm --prefix demo/functions install

# terminal 1: emulators (Auth, Firestore, Functions) — from the repo root
npm --prefix demo/functions run build
firebase emulators:start --project demo-booking

# terminal 2: seed data, then the site
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npx tsx scripts/setup-client.ts --project demo-booking --seed demo/booking.seed.json
npm run demo          # http://localhost:5173
```

- `/` booking widget (theme and language switchers in the header)
- `/rdv/?t=…` manage page (link shown after booking; e-mails are logged in the
  functions emulator output and in the `mailLog` collection since no Resend key is set)
- `/admin/` back-office: sign in with Google → in the emulator popup, "Add new account"
  with **demo@example.com** (the seeded admin). Or ask for an e-mail link and open it from the
  emulator UI (Authentication tab)
- `/admin/?lang=en` shows the admin in English. Try **Apparence** (pick "Nuit", save, then open
  `/`), **Aide**, and **Réglages → Synchroniser avec mon agenda**
- Emulator UI: http://127.0.0.1:4000
