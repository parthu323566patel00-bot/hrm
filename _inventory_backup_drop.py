import os
import urllib.parse
import asyncio
import asyncpg
from dotenv import load_dotenv
from pathlib import Path
import csv
import json

load_dotenv()
url = os.getenv('DATABASE_URL')
if not url:
    raise SystemExit('DATABASE_URL missing')
p = urllib.parse.urlparse(url)
backup_dir = Path('inventory_backup')
backup_dir.mkdir(exist_ok=True)

inventory_tables = [
    ('public', 'inventory_audit'),
    ('public', 'inventory_batches'),
    ('public', 'inventory_goods_receipt_items'),
    ('public', 'inventory_goods_receipts'),
    ('public', 'inventory_ledger'),
    ('public', 'inventory_locations'),
    ('public', 'inventory_products'),
    ('public', 'inventory_purchase_order_items'),
    ('public', 'inventory_purchase_orders'),
    ('public', 'inventory_suppliers'),
]

async def main():
    conn = await asyncpg.connect(
        host=p.hostname,
        port=p.port or 5432,
        user=p.username,
        password=p.password,
        database=p.path.lstrip('/'),
    )
    manifest = []
    for schema, table in inventory_tables:
        qualified = f'"{schema}"."{table}"'
        print(f'Backing up {qualified}')
        try:
            cols = await conn.fetch(
                '''
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema=$1 AND table_name=$2
                ORDER BY ordinal_position
                ''',
                schema,
                table,
            )
            col_meta = [dict(r) for r in cols]
            with open(backup_dir / f'{table}_columns.json', 'w', encoding='utf-8') as f:
                json.dump(col_meta, f, indent=2)
            rows = await conn.fetch(f'SELECT * FROM {qualified}')
            csv_path = backup_dir / f'{table}.csv'
            if rows:
                fieldnames = rows[0].keys()
                with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow(fieldnames)
                    for row in rows:
                        writer.writerow([row[f] for f in fieldnames])
            else:
                with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow([])
            count = await conn.fetchval(f'SELECT COUNT(*) FROM {qualified}')
            manifest.append({'table': table, 'schema': schema, 'rows': count, 'csv': str(csv_path)})
        except asyncpg.UndefinedTableError:
            print(f'Table {qualified} does not exist, skipping backup.')
            manifest.append({'table': table, 'schema': schema, 'rows': 0, 'csv': None})
        except Exception as exc:
            print(f'Warning: failed to back up {qualified}: {exc}')
            manifest.append({'table': table, 'schema': schema, 'rows': None, 'csv': None})
    with open(backup_dir / 'manifest.json', 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print('Backup complete')
    print('Dropping inventory tables now...')
    async with conn.transaction():
        for schema, table in inventory_tables:
            qualified = f'"{schema}"."{table}"'
            print(f'Dropping {qualified}')
            await conn.execute(f'DROP TABLE IF EXISTS {qualified} CASCADE')
    await conn.close()

asyncio.run(main())
