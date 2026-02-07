"""
processing.py — Data ingestion & cleaning utilities.
Handles CSV/Excel parsing, date detection, frequency validation.
"""

import pandas as pd
import numpy as np
from typing import Optional


def parse_datetime_series(values: pd.Series) -> pd.Series:
    """
    Robust datetime parsing for messy uploads.
    Handles wrapper chars and slash-based formats with day/month ambiguity.
    """
    raw = values.astype("string").str.strip()
    cleaned = (
        raw
        .str.replace(r"^[\[\(\{<\"']+|[\]\)\}>\"']+$", "", regex=True)
        .str.extract(r"(\d{1,4}[/-]\d{1,2}[/-]\d{1,4}|\d{4}-\d{2}-\d{2})", expand=False)
        .fillna(raw)
        .str.strip()
    )

    cleaned_non_null = cleaned.dropna()
    # For slash-separated dates, choose one consistent interpretation
    # for the full column (avoid row-wise mixed mm/dd and dd/mm parsing).
    has_slash_dates = bool(cleaned_non_null.str.contains(r"/", regex=True).any())

    parsed_default = pd.to_datetime(cleaned, errors="coerce")
    parsed_dayfirst = pd.to_datetime(cleaned, errors="coerce", dayfirst=True)

    if has_slash_dates:
        default_ok = int(parsed_default.notna().sum())
        dayfirst_ok = int(parsed_dayfirst.notna().sum())
        # Prefer day-first on tie; UK-source datasets are commonly dd/mm/yyyy.
        if dayfirst_ok >= default_ok:
            return parsed_dayfirst
        return parsed_default

    parsed_yearfirst = pd.to_datetime(cleaned, errors="coerce", yearfirst=True)
    return parsed_default.fillna(parsed_dayfirst).fillna(parsed_yearfirst)


def detect_date_column(df: pd.DataFrame) -> Optional[str]:
    """
    Heuristic to find the column most likely containing dates.
    Returns the column name or None.
    """
    # Try columns with 'date' or 'time' in the name first
    for col in df.columns:
        if any(kw in col.lower() for kw in ["date", "time", "period", "week"]):
            try:
                parsed = parse_datetime_series(df[col])
                if parsed.notna().sum() > len(df) * 0.7:
                    return col
            except (ValueError, TypeError):
                continue

    # Fallback: try parsing every object/string column
    for col in df.select_dtypes(include=["object", "datetime64"]).columns:
        try:
            parsed = parse_datetime_series(df[col])
            if parsed.notna().sum() > len(df) * 0.8:
                return col
        except (ValueError, TypeError):
            continue

    return None


def detect_numeric_columns(df: pd.DataFrame) -> list[str]:
    """
    Return columns that are numeric or strongly numeric-like.

    Many uploads store numbers as strings (commas, currency, percents),
    which pandas reads as object dtype. We include those when most values
    can be coerced to numeric.
    """
    numeric_cols: list[str] = []

    for col in df.columns:
        series = df[col]

        if pd.api.types.is_numeric_dtype(series):
            numeric_cols.append(col)
            continue

        non_null = series.notna().sum()
        if non_null == 0:
            continue

        cleaned = (
            series.astype("string")
            .str.strip()
            .str.replace(r"^\((.*)\)$", r"-\1", regex=True)  # "(123)" -> "-123"
            .str.replace(r"[£$€,_%\s]", "", regex=True)
            .replace(
                {
                    "": np.nan,
                    "-": np.nan,
                    "nan": np.nan,
                    "None": np.nan,
                    "null": np.nan,
                    "N/A": np.nan,
                }
            )
        )
        coerced = pd.to_numeric(cleaned, errors="coerce")
        parse_ratio = float(coerced.notna().sum()) / float(non_null)

        if parse_ratio >= 0.8:
            numeric_cols.append(col)

    return numeric_cols


def validate_frequency(df: pd.DataFrame, date_col: str) -> dict:
    """
    Check the time-series frequency. Returns info about gaps.
    Does NOT auto-impute — user decides.
    """
    dates = parse_datetime_series(df[date_col]).dropna().sort_values().reset_index(drop=True)
    if len(dates) < 2:
        return {
            "detected_frequency": "irregular",
            "median_gap_days": None,
            "total_rows": len(df),
            "missing_ranges": [],
            "has_gaps": False,
        }
    diffs = dates.diff().dropna()

    # Detect dominant frequency
    median_diff = diffs.median()

    if pd.Timedelta(days=5) <= median_diff <= pd.Timedelta(days=9):
        freq_label = "weekly"
    elif pd.Timedelta(days=25) <= median_diff <= pd.Timedelta(days=35):
        freq_label = "monthly"
    elif pd.Timedelta(days=0) <= median_diff <= pd.Timedelta(days=2):
        freq_label = "daily"
    else:
        freq_label = "irregular"

    # Find gaps (dates that deviate significantly from median)
    threshold = median_diff * 1.5
    gap_indices = diffs[diffs > threshold].index.tolist()
    missing_ranges = []
    for idx in gap_indices:
        start = dates.iloc[idx - 1]
        end = dates.iloc[idx]
        missing_ranges.append(
            {"from": start.isoformat(), "to": end.isoformat()}
        )

    return {
        "detected_frequency": freq_label,
        "median_gap_days": median_diff.days,
        "total_rows": len(df),
        "missing_ranges": missing_ranges,
        "has_gaps": len(missing_ranges) > 0,
    }


def get_data_health(df: pd.DataFrame) -> dict:
    """Return a summary of data quality issues."""
    health = {
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "columns": [],
    }
    for col in df.columns:
        col_info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "missing_count": int(df[col].isna().sum()),
            "missing_pct": round(float(df[col].isna().mean() * 100), 1),
            "unique_count": int(df[col].nunique()),
        }
        if pd.api.types.is_numeric_dtype(df[col]):
            col_info["min"] = float(df[col].min()) if df[col].notna().any() else None
            col_info["max"] = float(df[col].max()) if df[col].notna().any() else None
            col_info["mean"] = (
                round(float(df[col].mean()), 2) if df[col].notna().any() else None
            )
        health["columns"].append(col_info)

    return health


def load_dataframe(file_path: str) -> pd.DataFrame:
    """
    Load CSV, Excel, or delimited text file into a DataFrame.

    Automatically detects and strips metadata preambles (title blocks,
    summary sections, provenance info) that appear before the real data
    table.  Handles multi-row merged Excel headers by flattening them
    into single-level column names.  For .txt files the delimiter is
    auto-detected.
    """
    is_excel = file_path.endswith((".xlsx", ".xls"))
    is_txt = file_path.endswith(".txt")

    # ── First pass: raw load (no header) so we can inspect structure ──
    if is_excel:
        raw = pd.read_excel(file_path, header=None)
    elif is_txt:
        # Count leading blank lines so the CSV sniffer doesn't choke
        skip = _count_leading_blanks(file_path)
        raw = pd.read_csv(
            file_path, header=None, sep=r"\s+", engine="python", skiprows=skip
        )
    else:
        raw = pd.read_csv(file_path, header=None)

    # If the file already looks clean (row 0 is a good header), fast-path
    if _looks_clean(raw):
        header: int | list[int] = 0
    else:
        header = _find_best_header(raw, is_excel=is_excel)

    # ── Second pass: reload with the correct header row(s) ──
    if is_excel:
        df = pd.read_excel(file_path, header=header)
    elif is_txt:
        h = header if isinstance(header, int) else header[0]
        df = pd.read_csv(
            file_path, header=h, sep=r"\s+", engine="python", skiprows=skip
        )
    else:
        # CSV doesn't have merged cells, so always use a single int
        h = header if isinstance(header, int) else header[0]
        df = pd.read_csv(file_path, header=h)

    # ── Flatten MultiIndex columns (from multi-row Excel headers) ──
    if isinstance(df.columns, pd.MultiIndex):
        flat: list[str] = []
        for i, col_tuple in enumerate(df.columns):
            parts = [
                str(p).strip()
                for p in col_tuple
                if pd.notna(p) and not str(p).strip().startswith("Unnamed:")
            ]
            flat.append(" - ".join(parts) if parts else f"Column_{i}")
        df.columns = pd.Index(flat)

    # ── Cleanup ──
    df.columns = pd.Index([str(c).strip() for c in df.columns])

    # Drop columns still called "Unnamed: N" (merged-cell artefacts)
    named = [c for c in df.columns if not str(c).startswith("Unnamed:")]
    if named:
        df = df[named]

    # Drop completely empty rows
    df = df.dropna(how="all")

    # Drop leading summary / totals rows (e.g. "2015-16 Year to Date")
    df = _strip_summary_rows(df)

    df = df.reset_index(drop=True)
    return df


# ── Header-detection helpers ───────────────────────────────────────────────


def _count_leading_blanks(file_path: str) -> int:
    """Return the number of blank / whitespace-only lines at the top of a text file."""
    count = 0
    with open(file_path, "r", errors="replace") as f:
        for line in f:
            if line.strip():
                break
            count += 1
    return count


def _looks_clean(raw: pd.DataFrame) -> bool:
    """Return True if row 0 already looks like a valid header."""
    if len(raw) < 3:
        return True
    row0 = raw.iloc[0]
    filled = row0.notna().sum()
    # Row 0 should fill at least 60 % of columns …
    if filled < len(raw.columns) * 0.6:
        return False
    # … and the next few rows should also be dense (actual data)
    data_fill = raw.iloc[1 : min(6, len(raw))].notna().mean().mean()
    return data_fill > 0.5


def _find_best_header(raw: pd.DataFrame, *, is_excel: bool = False):
    """
    Score every candidate row as a potential header.

    The correct header row has:
      • many non-numeric string values  (column names)
      • many dense rows immediately after it  (the actual data)
      • few empty cells  (few "Unnamed:" columns)

    Metadata / preamble rows may contain strings but are followed by
    more sparse metadata — so the "dense rows after" term dominates.

    Returns ``int`` for a single-row header or ``list[int]``
    for a multi-row header (Excel only).
    """
    n_rows, n_cols = raw.shape
    limit = min(50, n_rows - 3)

    best_row = 0
    best_score = -1e9

    for r in range(limit):
        vals = raw.iloc[r]
        filled = int(vals.notna().sum())
        if filled < max(2, int(n_cols * 0.15)):
            continue

        # Count cells that look like column names (non-numeric strings)
        strings = 0
        for v in vals.dropna():
            s = str(v).strip()
            if not s:
                continue
            try:
                float(s.replace(",", "").replace("%", ""))
            except ValueError:
                strings += 1

        if strings == 0:
            continue

        # Count dense data rows that follow this candidate
        dense = 0
        gap_run = 0
        for i in range(r + 1, n_rows):
            if raw.iloc[i].notna().sum() / n_cols > 0.35:
                dense += 1
                gap_run = 0
            else:
                gap_run += 1
                if gap_run >= 3:
                    break

        score = strings * 2 + dense * 10 - (n_cols - filled) * 3

        if score > best_score:
            best_score = score
            best_row = r

    # For Excel files, check if a 2-row header covers more columns
    if is_excel:
        return _maybe_multi_row(raw, best_row)

    return best_row


def _maybe_multi_row(raw: pd.DataFrame, best: int):
    """
    Check whether pairing the best row with an adjacent row gives
    noticeably better column coverage (fewer unnamed columns).
    Handles merged-cell multi-level headers common in government data.
    """
    n_cols = len(raw.columns)
    single_fill = int(raw.iloc[best].notna().sum())

    best_option: int | list[int] = best
    best_fill = single_fill

    for pair in [(best - 1, best), (best, best + 1)]:
        if pair[0] < 0 or pair[1] >= len(raw):
            continue
        combined = sum(
            1
            for c in range(n_cols)
            if pd.notna(raw.iloc[pair[0], c]) or pd.notna(raw.iloc[pair[1], c])
        )
        if combined > best_fill + 2:          # only switch if notably better
            best_option = list(pair)
            best_fill = combined

    return best_option


def _strip_summary_rows(df: pd.DataFrame) -> pd.DataFrame:
    """
    Remove leading summary / totals rows that sit between the header
    and the real data (e.g. "2015-16 Year to Date", rows with "-" as code).
    """
    drop_count = 0
    for i in range(min(5, len(df))):
        first_vals = [
            str(v).strip().lower() for v in df.iloc[i].head(4).dropna()
        ]
        if any(
            v in ("-", "total", "all", "summary") or "year to" in v
            for v in first_vals
        ):
            drop_count = i + 1
        else:
            break
    if drop_count:
        df = df.iloc[drop_count:]
    return df


def get_preview(df: pd.DataFrame, n: int = 10) -> dict:
    """
    Return preview information about a DataFrame:
    - ``rows``: first *n* rows as list of dicts (values coerced to JSON-safe types)
    - ``dtypes``: mapping of column name → pandas dtype string
    - ``shape``: (total_rows, total_cols)
    """
    preview_df = df.head(n)

    # Convert to JSON-safe Python types (handles Timestamps, NaN, etc.)
    rows: list[dict] = []
    for _, series in preview_df.iterrows():
        record: dict = {}
        for col in preview_df.columns:
            val = series[col]
            if pd.isna(val):
                record[col] = None
            elif isinstance(val, (pd.Timestamp, np.datetime64)):
                record[col] = str(val)
            elif isinstance(val, (np.integer,)):
                record[col] = int(val)
            elif isinstance(val, (np.floating,)):
                record[col] = float(val)
            else:
                record[col] = str(val) if not isinstance(val, (int, float, bool, str)) else val
            
        rows.append(record)

    dtypes = {col: str(df[col].dtype) for col in df.columns}

    return {
        "rows": rows,
        "dtypes": dtypes,
        "shape": [len(df), len(df.columns)],
    }
