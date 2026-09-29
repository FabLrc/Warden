# Foundation Manual Check

Configure a Pi provider, then run:

```bash
npm run dev -- run "list the files in this project"
```

Confirm that the command completes and a new `.warden/sessions/<id>/state.json`
contains a completed Builder task. The automated suite does not require Pi
credentials.
