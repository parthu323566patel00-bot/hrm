import asyncio
from pathlib import Path
from sqlalchemy import text
from app.core.database import engine


async def run_sql_file(path: Path):
    sql = path.read_text()
    # Split into individual statements, taking care of dollar-quoted blocks (e.g. DO $$ ... $$;)
    statements = []
    current = []
    in_dollar = False
    for line in sql.splitlines():
        current.append(line)
        if '$$' in line:
            # toggle dollar quote state
            in_dollar = not in_dollar
            continue
        if not in_dollar and line.strip().endswith(';'):
            statements.append('\n'.join(current))
            current = []
    # any trailing statement
    if current:
        statements.append('\n'.join(current))

    async with engine.begin() as conn:
        for stmt in statements:
            s = stmt.strip()
            if not s:
                continue
            # Use exec_driver_sql to avoid asyncpg prepared-statement limitations
            await conn.exec_driver_sql(s)


async def main():
    migrations_dir = Path(__file__).resolve().parents[1] / "db" / "migrations"
    files = sorted(migrations_dir.glob("*.sql"))
    for f in files:
        print("Applying", f.name)
        await run_sql_file(f)


if __name__ == "__main__":
    asyncio.run(main())
