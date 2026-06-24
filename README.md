# GRAD TRACKER

A personal dashboard for tracking master's program applications, deadlines, documents, and recommenders. Built with Flask + SQLite + vanilla JS — no cloud, no subscriptions, your data stays local.

---

## Setup

```bash
pip install -r requirements.txt
python app.py
```

Open **http://localhost:5001**

That's it. The SQLite database and uploaded files are created automatically under `data/` and `uploads/` on first run.

---

## Optional: seed sample data

```bash
python seed_sample_data.py
```

Populates the tracker with 4 sample applications (Germany, Canada, South Korea, Finland) so you can see the UI in action before adding your own. Delete `data/tracker.db` to start fresh anytime.

---

## Features

| Feature | Details |
|---|---|
| **Application tracking** | Status, priority (reach/target/safety), deadlines, funding type, portal login, test requirements |
| **Deadline countdown** | Color-coded urgency: critical ≤7 days, soon ≤21, upcoming ≤45 |
| **Per-application checklist** | Default template (SOP, CV, Transcripts, Test Score, Portfolio, Application, Fee) + custom items; 3-state cycle |
| **Document versioning** | Upload multiple versions per category; auto-increments version number; download any version |
| **Recommenders** | Master list; link to as many applications as needed; track LOR status + dates |
| **Dashboard** | Live stats, next-up deadlines across all applications, status breakdown |
| **Search & filter** | Filter by status, priority, country, sort by deadline/name/completion |
| **Calendar export** | `.ics` file (importable into Google Calendar, Outlook, Apple Calendar) with 3-day reminders |
| **JSON backup** | Full data export at `/api/export/json` |

---

## Data storage

```
grad-tracker/
├── data/
│   └── tracker.db          # SQLite — all application data
└── uploads/
    └── <app_id>/           # Uploaded documents per application
        └── <uuid>.<ext>
```

Back up these two folders to keep your data safe.

---

## Stack

Python 3 · Flask 3.1 · SQLite3 · Vanilla JS · No build step
