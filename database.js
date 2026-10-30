
import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";

const db = SQLite.openDatabaseSync("e_arsip_kantor.db");

async function hashPassword(password) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
}

// Catatan aktivitas lokal. Tidak menyimpan kata sandi.
async function writeActivity(action, description, userId = null) {
  try {
    await db.runAsync(
      `INSERT INTO activity_logs
       (user_id, action, description, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        userId,
        action,
        String(description || ""),
        new Date().toISOString()
      ]
    );
  } catch (error) {
    // Kegagalan pencatatan tidak boleh menghilangkan data arsip.
  }
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

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Migrasi aman untuk database versi sebelumnya.
  const columns = await db.getAllAsync(
    "PRAGMA table_info(documents)"
  );

  const names = columns.map(column => column.name);

  if (!names.includes("storage_path")) {
    await db.execAsync(
      "ALTER TABLE documents ADD COLUMN storage_path TEXT"
    );
  }

  if (!names.includes("download_url")) {
    await db.execAsync(
      "ALTER TABLE documents ADD COLUMN download_url TEXT"
    );
  }

  const count = await db.getFirstAsync(
    "SELECT COUNT(*) AS total FROM users"
  );

  // Akun demo hanya dibuat jika belum ada pengguna.
  if (!count?.total) {
    await db.runAsync(
      `INSERT INTO users
       (username, display_name, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      [
        "admin",
        "Administrator",
        await hashPassword("admin12345"),
        "admin"
      ]
    );

    await db.runAsync(
      `INSERT INTO users
       (username, display_name, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      [
        "pegawai",
        "Pegawai Demo",
        await hashPassword("pegawai12345"),
        "staff"
      ]
    );

    await writeActivity(
      "DATABASE_INIT",
      "Database dan akun demo awal dibuat."
    );
  }
}

export async function loginLocal(username, password) {
  const cleanUsername = String(username || "")
    .trim()
    .toLowerCase();

  const user = await db.getFirstAsync(
    `SELECT id, username, display_name, role, password_hash
     FROM users
     WHERE username = ?`,
    [cleanUsername]
  );

  if (
    !user ||
    user.password_hash !== await hashPassword(password)
  ) {
    await writeActivity(
      "LOGIN_FAILED",
      `Percobaan login gagal untuk pengguna: ${cleanUsername}`
    );

    throw new Error("Nama pengguna atau kata sandi salah.");
  }

  await writeActivity(
    "LOGIN_SUCCESS",
    `Pengguna ${user.username} berhasil masuk.`,
    user.id
  );

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role
  };
}

export async function changeLocalPassword(
  userId,
  currentPassword,
  newPassword
) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error(
      "Kata sandi baru minimal 8 karakter."
    );
  }

  const user = await db.getFirstAsync(
    "SELECT password_hash FROM users WHERE id = ?",
    [userId]
  );

  if (
    !user ||
    user.password_hash !== await hashPassword(currentPassword)
  ) {
    throw new Error("Kata sandi lama salah.");
  }

  await db.runAsync(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    [await hashPassword(newPassword), userId]
  );

  await writeActivity(
    "PASSWORD_CHANGED",
    "Pengguna mengganti kata sandi.",
    userId
  );
}

export async function createLocalStaff(
  username,
  displayName,
  password
) {
  const cleanUsername = String(username || "")
    .trim()
    .toLowerCase();

  const cleanName = String(displayName || "").trim();

  if (
    !cleanUsername ||
    !cleanName ||
    !password ||
    password.length < 8
  ) {
    throw new Error(
      "Isi nama pengguna, nama lengkap, dan kata sandi minimal 8 karakter."
    );
  }

  await db.runAsync(
    `INSERT INTO users
     (username, display_name, password_hash, role)
     VALUES (?, ?, ?, 'staff')`,
    [
      cleanUsername,
      cleanName,
      await hashPassword(password)
    ]
  );

  await writeActivity(
    "STAFF_CREATED",
    `Akun pegawai ${cleanUsername} dibuat.`
  );
}

export async function allDocuments() {
  return db.getAllAsync(
    "SELECT * FROM documents ORDER BY updated_at DESC"
  );
}

export async function saveDocument(document) {
  const now = new Date().toISOString();
  const title = String(document.title || "").trim();

  if (!title) {
    throw new Error("Nama/judul dokumen wajib diisi.");
  }

  if (document.id) {
    await db.runAsync(
      `UPDATE documents SET
       title = ?,
       doc_number = ?,
       category = ?,
       doc_type = ?,
       doc_date = ?,
       sender_receiver = ?,
       notes = ?,
       file_uri = ?,
       file_name = ?,
       updated_at = ?,
       synced = 0
       WHERE id = ?`,
      [
        title,
        document.doc_number || "",
        document.category || "Umum",
        document.doc_type || "Dokumen Umum",
        document.doc_date || "",
        document.sender_receiver || "",
        document.notes || "",
        document.file_uri || "",
        document.file_name || "",
        now,
        document.id
      ]
    );

    await writeActivity(
      "DOCUMENT_UPDATED",
      `Arsip "${title}" diperbarui.`
    );
  } else {
    await db.runAsync(
      `INSERT INTO documents (
        title,
        doc_number,
        category,
        doc_type,
        doc_date,
        sender_receiver,
        notes,
        file_uri,
        file_name,
        updated_at,
        synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        title,
        document.doc_number || "",
        document.category || "Umum",
        document.doc_type || "Dokumen Umum",
        document.doc_date || "",
        document.sender_receiver || "",
        document.notes || "",
        document.file_uri || "",
        document.file_name || "",
        now
      ]
    );

    await writeActivity(
      "DOCUMENT_CREATED",
      `Arsip "${title}" ditambahkan.`
    );
  }
}

export async function deleteDocument(id) {
  const document = await db.getFirstAsync(
    "SELECT title FROM documents WHERE id = ?",
    [id]
  );

  await db.runAsync(
    "DELETE FROM documents WHERE id = ?",
    [id]
  );

  await writeActivity(
    "DOCUMENT_DELETED",
    `Arsip "${document?.title || id}" dihapus.`
  );
}

// Riwayat aktivitas untuk fitur audit pada tahap berikutnya.
export async function getActivityLogs(limit = 100) {
  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  return db.getAllAsync(
    `SELECT
       activity_logs.id,
       activity_logs.user_id,
       activity_logs.action,
       activity_logs.description,
       activity_logs.created_at,
       users.username,
       users.display_name
     FROM activity_logs
     LEFT JOIN users ON users.id = activity_logs.user_id
     ORDER BY activity_logs.id DESC
     LIMIT ?`,
    [safeLimit]
  );
}
