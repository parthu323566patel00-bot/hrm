import os
import urllib.parse
import asyncio
import asyncpg
from dotenv import load_dotenv
load_dotenv()
url = os.getenv('DATABASE_URL')
if not url:
    raise SystemExit('DATABASE_URL missing')
p = urllib.parse.urlparse(url)
async def main():
    conn = await asyncpg.connect(host=p.hostname, port=p.port or 5432, user=p.username, password=p.password, database=p.path.lstrip('/'))
    rows = await conn.fetch("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name")
    for r in rows:
        print(f"{r['table_schema']}.{r['table_name']}")
    await conn.close()
asyncio.run(main())
