import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";

const db = SQLite.openDatabaseSync("e_arsip_kantor.db");

async function hashPassword(password) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
}

export async function initDb() {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      doc_number TEXT,
      category TEXT,
      doc_type TEXT,
      doc_date TEXT,
      sender_receiver TEXT,
      notes TEXT,
      file_uri TEXT,
      file_name TEXT,
      storage_path TEXT,
      download_url TEXT,
      updated_at TEXT,
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','staff'))
    );
  `);
  const columns = await db.getAllAsync("PRAGMA table_info(documents)");
  const names = columns.map(c => c.name);
  if (!names.includes("storage_path")) await db.execAsync("ALTER TABLE documents ADD COLUMN storage_path TEXT");
  if (!names.includes("download_url")) await db.execAsync("ALTER TABLE documents ADD COLUMN download_url TEXT");

  // Akun demo awal hanya untuk uji coba offline. Ganti kata sandi setelah login.
  const count = await db.getFirstAsync("SELECT COUNT(*) AS total FROM users");
  if (!count?.total) {
    await db.runAsync(
      "INSERT INTO users (username,display_name,password_hash,role) VALUES (?,?,?,?)",
      ["admin", "Administrator", await hashPassword("admin12345"), "admin"]
    );
    await db.runAsync(
      "INSERT INTO users (username,display_name,password_hash,role) VALUES (?,?,?,?)",
      ["pegawai", "Pegawai Demo", await hashPassword("pegawai12345"), "staff"]
    );
  }
}

export async function loginLocal(username, password) {
  const user = await db.getFirstAsync(
    "SELECT id,username,display_name,role,password_hash FROM users WHERE username=?",
    [username.trim().toLowerCase()]
  );
  if (!user || user.password_hash !== await hashPassword(password)) {
    throw new Error("Nama pengguna atau kata sandi salah.");
  }
  return { id:user.id, username:user.username, displayName:user.display_name, role:user.role };
}

export async function changeLocalPassword(userId, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 8) throw new Error("Kata sandi baru minimal 8 karakter.");
  const user = await db.getFirstAsync("SELECT password_hash FROM users WHERE id=?", [userId]);
  if (!user || user.password_hash !== await hashPassword(currentPassword)) throw new Error("Kata sandi lama salah.");
  await db.runAsync("UPDATE users SET password_hash=? WHERE id=?", [await hashPassword(newPassword),userId]);
}

export async function createLocalStaff(username, displayName, password) {
  if (!username.trim() || !displayName.trim() || password.length < 8) throw new Error("Isi nama pengguna, nama lengkap, dan kata sandi minimal 8 karakter.");
  await db.runAsync(
    "INSERT INTO users (username,display_name,password_hash,role) VALUES (?,?,?,'staff')",
    [username.trim().toLowerCase(),displayName.trim(),await hashPassword(password)]
  );
}

export async function allDocuments() {
  return db.getAllAsync("SELECT * FROM documents ORDER BY updated_at DESC");
}
export async function saveDocument(d) {
  const now = new Date().toISOString();
  if (d.id) {
    await db.runAsync(
      `UPDATE documents SET title=?, doc_number=?, category=?, doc_type=?, doc_date=?,
       sender_receiver=?, notes=?, file_uri=?, file_name=?, updated_at=?, synced=0 WHERE id=?`,
      [d.title, d.doc_number, d.category, d.doc_type, d.doc_date, d.sender_receiver,
       d.notes, d.file_uri, d.file_name, now, d.id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO documents (title,doc_number,category,doc_type,doc_date,sender_receiver,notes,file_uri,file_name,updated_at,synced)
       VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
      [d.title, d.doc_number, d.category, d.doc_type, d.doc_date, d.sender_receiver,
       d.notes, d.file_uri, d.file_name, now]
    );
  }
}
export async function deleteDocument(id) {
  await db.runAsync("DELETE FROM documents WHERE id=?", [id]);
}
