import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  return db
}

export function getDbPath(): string {
  return join(app.getPath('userData'), 'zhongqian.db')
}

export function initDb(): Database.Database {
  const dbPath = getDbPath()
  const isNew = !existsSync(dbPath)
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  createSchema()
  migrate()
  seedDefaults(isNew)
  return db
}

// 为已存在的数据库安全补列（存在则跳过），避免升级时丢数据
function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
}

function migrate(): void {
  // 处方：针灸费、其它费、药费合计、性别/年龄快照
  ensureColumn('prescriptions', 'acupuncture_fee', 'acupuncture_fee REAL DEFAULT 0')
  ensureColumn('prescriptions', 'other_fee', 'other_fee REAL DEFAULT 0')
  ensureColumn('prescriptions', 'herb_total', 'herb_total REAL DEFAULT 0')
  ensureColumn('prescriptions', 'patient_gender', "patient_gender TEXT DEFAULT ''")
  ensureColumn('prescriptions', 'patient_age', "patient_age TEXT DEFAULT ''")
  // 顾客：性别、年龄
  ensureColumn('patients', 'gender', "gender TEXT DEFAULT ''")
  ensureColumn('patients', 'age', "age TEXT DEFAULT ''")
}

function createSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS herbs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pinyin_code TEXT DEFAULT '',
      pinyin_full TEXT DEFAULT '',
      spec TEXT DEFAULT '',
      unit TEXT DEFAULT 'kg',
      retail_price REAL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      stock_qty REAL DEFAULT 0,
      stock_warning_line REAL DEFAULT 0,
      last_purchase_price REAL DEFAULT 0,
      is_disabled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      doctor_name TEXT DEFAULT '',
      note TEXT DEFAULT '',
      doses_count INTEGER DEFAULT 1,
      usage_method TEXT DEFAULT '',
      total_price REAL DEFAULT 0,
      status TEXT DEFAULT 'confirmed',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS prescription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER NOT NULL,
      herb_id INTEGER NOT NULL,
      dose_per_unit_g REAL DEFAULT 0,
      unit_price_snapshot REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
      FOREIGN KEY (herb_id) REFERENCES herbs(id)
    );

    CREATE TABLE IF NOT EXISTS recipe_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      usage_method TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS recipe_template_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      herb_id INTEGER NOT NULL,
      dose_per_unit_g REAL DEFAULT 0,
      FOREIGN KEY (template_id) REFERENCES recipe_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (herb_id) REFERENCES herbs(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      herb_id INTEGER NOT NULL,
      qty_kg REAL DEFAULT 0,
      purchase_price REAL DEFAULT 0,
      purchased_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (herb_id) REFERENCES herbs(id)
    );

    CREATE TABLE IF NOT EXISTS price_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      herb_id INTEGER NOT NULL,
      old_retail_price REAL DEFAULT 0,
      new_retail_price REAL DEFAULT 0,
      adjusted_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (herb_id) REFERENCES herbs(id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
}

function seedDefaults(isNew: boolean): void {
  const setIfAbsent = db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`
  )
  setIfAbsent.run('clinic_name', '仲谦')
  setIfAbsent.run('printer_mode', '58mm')
  setIfAbsent.run('backup_folder_path', '')
  setIfAbsent.run('theme', 'modern')
  setIfAbsent.run('password_hash', '')
  setIfAbsent.run('recovery_key_hash', '')

  // 首次运行填充少量示例药品，方便立即体验开方划价
  if (isNew) {
    const count = (db.prepare('SELECT COUNT(*) AS c FROM herbs').get() as { c: number }).c
    if (count === 0) {
      const insert = db.prepare(
        `INSERT INTO herbs (name, pinyin_code, pinyin_full, spec, retail_price, cost_price, stock_qty, stock_warning_line, last_purchase_price)
         VALUES (@name, @pinyin_code, @pinyin_full, @spec, @retail_price, @cost_price, @stock_qty, @stock_warning_line, @last_purchase_price)`
      )
      // 拼音码在此处先留空，由 herbs 服务在启动时补齐；这里给出常用示例
      const samples = [
        { name: '当归', code: 'dg', full: 'danggui', retail: 60, cost: 42, stock: 5 },
        { name: '黄芪', code: 'hq', full: 'huangqi', retail: 45, cost: 30, stock: 8 },
        { name: '党参', code: 'dsh', full: 'dangshen', retail: 80, cost: 55, stock: 3 },
        { name: '白术', code: 'bzh', full: 'baizhu', retail: 50, cost: 35, stock: 0.5 },
        { name: '茯苓', code: 'fl', full: 'fuling', retail: 40, cost: 26, stock: 6 },
        { name: '甘草', code: 'gc', full: 'gancao', retail: 30, cost: 18, stock: 10 },
        { name: '川芎', code: 'cx', full: 'chuanxiong', retail: 55, cost: 38, stock: 4 },
        { name: '熟地黄', code: 'sdh', full: 'shudihuang', retail: 48, cost: 33, stock: 2 },
        { name: '白芍', code: 'bsh', full: 'baishao', retail: 46, cost: 32, stock: 5 },
        { name: '陈皮', code: 'cp', full: 'chenpi', retail: 38, cost: 24, stock: 7 }
      ]
      const tx = db.transaction(() => {
        for (const s of samples) {
          insert.run({
            name: s.name,
            pinyin_code: s.code,
            pinyin_full: s.full,
            spec: '',
            retail_price: s.retail,
            cost_price: s.cost,
            stock_qty: s.stock,
            stock_warning_line: 1,
            last_purchase_price: s.cost
          })
        }
      })
      tx()
    }
  }
}
