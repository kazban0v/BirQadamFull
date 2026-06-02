import sqlite3
conn = sqlite3.connect(r'C:\Users\User\Desktop\BirQadamFull-feature-updates\BirQadamDjango\db.sqlite3')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print([t[0] for t in cur.fetchall()])

# Also find the table for Project
cur.execute("SELECT id, title, creator_id FROM api_project ORDER BY id DESC LIMIT 5")
print("Projects:", cur.fetchall())
