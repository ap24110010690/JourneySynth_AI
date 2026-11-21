import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.config import DB_PATH


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_connection():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS datasets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                row_count INTEGER NOT NULL,
                customer_count INTEGER NOT NULL,
                is_cleaned INTEGER NOT NULL DEFAULT 0,
                parent_dataset_id TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS trained_models (
                id TEXT PRIMARY KEY,
                model_type TEXT NOT NULL,
                dataset_id TEXT NOT NULL,
                model_path TEXT NOT NULL,
                metadata_path TEXT NOT NULL,
                epochs INTEGER NOT NULL,
                batch_size INTEGER NOT NULL,
                random_seed INTEGER,
                status TEXT NOT NULL,
                training_duration_sec REAL NOT NULL DEFAULT 0.0,
                row_count_trained INTEGER NOT NULL DEFAULT 0,
                error_message TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS generation_history (
                id TEXT PRIMARY KEY,
                model_id TEXT NOT NULL,
                model_type TEXT NOT NULL,
                dataset_id TEXT NOT NULL,
                source_dataset_id TEXT NOT NULL,
                num_records INTEGER NOT NULL,
                random_seed INTEGER,
                customer_segment_filter TEXT,
                channel_filter TEXT,
                file_path TEXT NOT NULL,
                quality_score REAL,
                duration_sec REAL NOT NULL DEFAULT 0.0,
                created_at TEXT NOT NULL
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS validation_reports (
                id TEXT PRIMARY KEY,
                synthetic_dataset_id TEXT NOT NULL,
                reference_dataset_id TEXT NOT NULL,
                overall_score REAL NOT NULL,
                pass_status TEXT NOT NULL,
                report_json TEXT NOT NULL,
                report_path TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'Analyst',
                created_at TEXT NOT NULL,
                last_login TEXT
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS auth_tokens (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )


def set_state(key: str, value: str) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO app_state (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (key, value),
        )


def get_state(key: str, default: Optional[str] = None) -> Optional[str]:
    with get_connection() as conn:
        row = conn.execute("SELECT value FROM app_state WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default


def register_dataset(
    dataset_id: str,
    name: str,
    source_type: str,
    file_path: str,
    row_count: int,
    customer_count: int,
    is_cleaned: bool = False,
    parent_dataset_id: Optional[str] = None,
) -> Dict[str, Any]:
    created_at = utc_now_iso()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO datasets
            (id, name, source_type, file_path, row_count, customer_count, is_cleaned, parent_dataset_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                dataset_id,
                name,
                source_type,
                file_path,
                row_count,
                customer_count,
                1 if is_cleaned else 0,
                parent_dataset_id,
                created_at,
            ),
        )
    return {
        "id": dataset_id,
        "name": name,
        "source_type": source_type,
        "file_path": file_path,
        "row_count": row_count,
        "customer_count": customer_count,
        "is_cleaned": is_cleaned,
        "parent_dataset_id": parent_dataset_id,
        "created_at": created_at,
    }


def get_dataset_record(dataset_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM datasets WHERE id = ?", (dataset_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["is_cleaned"] = bool(d["is_cleaned"])
        return d


def list_datasets(source_type: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        if source_type:
            rows = conn.execute(
                "SELECT * FROM datasets WHERE source_type = ? ORDER BY created_at DESC",
                (source_type,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM datasets ORDER BY created_at DESC").fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d["is_cleaned"] = bool(d["is_cleaned"])
            result.append(d)
        return result


def save_trained_model(
    model_id: str,
    model_type: str,
    dataset_id: str,
    model_path: str,
    metadata_path: str,
    epochs: int,
    batch_size: int,
    random_seed: Optional[int],
    status: str,
    training_duration_sec: float,
    row_count_trained: int,
    error_message: Optional[str] = None,
) -> Dict[str, Any]:
    created_at = utc_now_iso()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO trained_models
            (id, model_type, dataset_id, model_path, metadata_path, epochs, batch_size,
             random_seed, status, training_duration_sec, row_count_trained, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                model_id,
                model_type,
                dataset_id,
                model_path,
                metadata_path,
                epochs,
                batch_size,
                random_seed,
                status,
                training_duration_sec,
                row_count_trained,
                error_message,
                created_at,
            ),
        )
    return {
        "id": model_id,
        "model_type": model_type,
        "dataset_id": dataset_id,
        "model_path": model_path,
        "metadata_path": metadata_path,
        "epochs": epochs,
        "batch_size": batch_size,
        "random_seed": random_seed,
        "status": status,
        "training_duration_sec": training_duration_sec,
        "row_count_trained": row_count_trained,
        "error_message": error_message,
        "created_at": created_at,
    }


def get_latest_trained_model(model_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        if model_id:
            row = conn.execute("SELECT * FROM trained_models WHERE id = ?", (model_id,)).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM trained_models ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
        return dict(row) if row else None


def list_trained_models() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM trained_models ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]


def save_generation_record(
    gen_id: str,
    model_id: str,
    model_type: str,
    dataset_id: str,
    source_dataset_id: str,
    num_records: int,
    random_seed: Optional[int],
    customer_segment_filter: Optional[str],
    channel_filter: Optional[str],
    file_path: str,
    quality_score: Optional[float],
    duration_sec: float,
) -> Dict[str, Any]:
    created_at = utc_now_iso()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO generation_history
            (id, model_id, model_type, dataset_id, source_dataset_id, num_records, random_seed,
             customer_segment_filter, channel_filter, file_path, quality_score, duration_sec, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                gen_id,
                model_id,
                model_type,
                dataset_id,
                source_dataset_id,
                num_records,
                random_seed,
                customer_segment_filter,
                channel_filter,
                file_path,
                quality_score,
                duration_sec,
                created_at,
            ),
        )
    return {
        "id": gen_id,
        "model_id": model_id,
        "model_type": model_type,
        "dataset_id": dataset_id,
        "source_dataset_id": source_dataset_id,
        "num_records": num_records,
        "random_seed": random_seed,
        "customer_segment_filter": customer_segment_filter,
        "channel_filter": channel_filter,
        "file_path": file_path,
        "quality_score": quality_score,
        "duration_sec": duration_sec,
        "created_at": created_at,
    }


def update_generation_quality(dataset_id: str, quality_score: float) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE generation_history SET quality_score = ? WHERE dataset_id = ?",
            (quality_score, dataset_id),
        )


def list_generation_history() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM generation_history ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def save_validation_report(
    report_id: str,
    synthetic_dataset_id: str,
    reference_dataset_id: str,
    overall_score: float,
    pass_status: str,
    report_dict: Dict[str, Any],
    report_path: str,
) -> Dict[str, Any]:
    created_at = utc_now_iso()
    report_json = json.dumps(report_dict)
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO validation_reports
            (id, synthetic_dataset_id, reference_dataset_id, overall_score, pass_status, report_json, report_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report_id,
                synthetic_dataset_id,
                reference_dataset_id,
                overall_score,
                pass_status,
                report_json,
                report_path,
                created_at,
            ),
        )
    return {
        "id": report_id,
        "synthetic_dataset_id": synthetic_dataset_id,
        "reference_dataset_id": reference_dataset_id,
        "overall_score": overall_score,
        "pass_status": pass_status,
        "report_path": report_path,
        "created_at": created_at,
    }


def get_latest_validation_report(synthetic_dataset_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        if synthetic_dataset_id:
            row = conn.execute(
                "SELECT * FROM validation_reports WHERE synthetic_dataset_id = ? ORDER BY created_at DESC LIMIT 1",
                (synthetic_dataset_id,),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM validation_reports ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["report"] = json.loads(d["report_json"])
        del d["report_json"]
        return d


def create_user(
    user_id: str,
    email: str,
    full_name: str,
    password_hash: str,
    salt: str,
    role: str = "Analyst",
) -> Dict[str, Any]:
    created_at = utc_now_iso()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO users (id, email, full_name, password_hash, salt, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, email.lower().strip(), full_name.strip(), password_hash, salt, role, created_at),
        )
    return {
        "id": user_id,
        "email": email.lower().strip(),
        "full_name": full_name.strip(),
        "role": role,
        "created_at": created_at,
        "last_login": None,
    }


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE lower(email) = ?",
            (email.lower().strip(),),
        ).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None


def update_user_last_login(user_id: str, last_login: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE users SET last_login = ? WHERE id = ?",
            (last_login, user_id),
        )


def create_auth_token(token: str, user_id: str, expires_at: str) -> Dict[str, Any]:
    created_at = utc_now_iso()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO auth_tokens (token, user_id, created_at, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, user_id, created_at, expires_at),
        )
    return {
        "token": token,
        "user_id": user_id,
        "created_at": created_at,
        "expires_at": expires_at,
    }


def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    now_iso = utc_now_iso()
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.email, u.full_name, u.role, u.created_at, u.last_login
            FROM auth_tokens t
            JOIN users u ON t.user_id = u.id
            WHERE t.token = ? AND t.expires_at > ?
            """,
            (token, now_iso),
        ).fetchone()
        return dict(row) if row else None


def delete_auth_token(token: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))


def delete_expired_tokens() -> None:
    now_iso = utc_now_iso()
    with get_connection() as conn:
        conn.execute("DELETE FROM auth_tokens WHERE expires_at <= ?", (now_iso,))

