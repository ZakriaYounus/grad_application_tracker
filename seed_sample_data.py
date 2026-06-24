"""
Optional: seed the tracker with sample applications based on Zak's real research countries.
Run once: python seed_sample_data.py
Delete this file or the data/tracker.db to start fresh.
"""
import sqlite3, os, datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "tracker.db")

if not os.path.exists(DB_PATH):
    print("Run the app first (python app.py) to create the database, then re-run this script.")
    exit(1)

db = sqlite3.connect(DB_PATH)
db.row_factory = sqlite3.Row

def add_app(university, program, degree_type, country, city, funding_type,
            app_deadline, schol_deadline, status, priority,
            test_required="", url="", notes=""):
    now = datetime.datetime.now().isoformat(timespec="seconds")
    cur = db.execute("""
        INSERT INTO applications
          (university, program, degree_type, country, city, funding_type,
           application_deadline, scholarship_deadline, status, priority,
           test_required, application_url, notes, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (university, program, degree_type, country, city, funding_type,
          app_deadline, schol_deadline, status, priority,
          test_required, url, notes, now, now))
    app_id = cur.lastrowid

    DEFAULT_CHECKLIST = [
        ("Statement of Purpose",          "SOP"),
        ("CV / Resume",                   "CV"),
        ("Official Transcripts",          "Transcript"),
        ("English Test (IELTS / TOEFL)",  "Test Score"),
        ("Portfolio / Writing Sample",    "Portfolio"),
        ("Online Application Form",       "Application"),
        ("Application Fee Payment",       "Fee"),
    ]
    for i, (title, category) in enumerate(DEFAULT_CHECKLIST):
        db.execute("""
            INSERT INTO checklist_items (application_id, title, category, status, sort_order, created_at)
            VALUES (?,?,?,?,?,?)
        """, (app_id, title, category, "not_started", i, now))
    db.commit()
    return app_id

# ── Sample applications from Zak's research countries ──────────────────────────

# Germany
id1 = add_app(
    "TU Munich", "MSc Games Engineering", "MSc",
    "Germany", "Munich", "DAAD Scholarship",
    "2026-12-15", "2026-11-01",
    "in_progress", "target",
    test_required="IELTS 6.5",
    url="https://www.tum.de",
    notes="Strong HCI + real-time rendering labs. Prof. Westermann's group relevant to FRACTURE.",
)

# Mark SOP and CV as done on the first one to demo the ring
db.execute("UPDATE checklist_items SET status='done' WHERE application_id=? AND category IN ('SOP','CV')", (id1,))
db.commit()

# Canada
id2 = add_app(
    "University of Alberta", "MSc Computing Science – Game Dev Track", "MSc",
    "Canada", "Edmonton", "Self-funded / TA",
    "2027-01-15", None,
    "researching", "reach",
    test_required="IELTS 6.5",
    url="https://www.ualberta.ca",
    notes="Strong graphics & game group. Check funding opportunities closer to deadline.",
)

# South Korea
id3 = add_app(
    "KAIST", "MS Culture Technology", "MS",
    "South Korea", "Daejeon", "GKS Government Scholarship",
    "2026-09-30", "2026-08-15",
    "researching", "target",
    test_required="TOEFL 88 / IELTS 6.5",
    url="https://ct.kaist.ac.kr",
    notes="GKS scholarship covers full tuition + stipend. GKS app deadline is earlier than admission deadline.",
)

# Finland
id4 = add_app(
    "Aalto University", "MSc Computer Science – Creative Technology", "MSc",
    "Finland", "Espoo", "Aalto Excellence Scholarship",
    "2027-01-12", "2027-01-12",
    "researching", "safety",
    test_required="IELTS 6.5",
    url="https://www.aalto.fi",
    notes="No application fee. Scholarship for high-GPA non-EU applicants.",
)

print(f"Seeded {db.execute('SELECT COUNT(*) FROM applications').fetchone()[0]} applications.")
print("Open http://localhost:5001 to see them.")
