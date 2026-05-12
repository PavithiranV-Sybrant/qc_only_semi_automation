"""Layer 0: Profile each column — null%, sample values, inferred type."""
import re
import pandas as pd
from dataclasses import dataclass, field


@dataclass
class ColumnProfile:
    header: str
    sample_values: list
    null_pct: float
    unique_count: int
    inferred_type: str  # email|url|phone|numeric|text|mixed|empty


def profile_columns(df: pd.DataFrame) -> list[ColumnProfile]:
    profiles = []
    for col in df.columns:
        series = df[col]
        samples = series.dropna().head(10).astype(str).tolist()
        null_pct = series.isna().sum() / max(len(df), 1) * 100
        profiles.append(ColumnProfile(
            header=col,
            sample_values=samples,
            null_pct=round(null_pct, 2),
            unique_count=int(series.nunique()),
            inferred_type=_infer_type(samples),
        ))
    return profiles


def _infer_type(samples: list) -> str:
    if not samples:
        return "empty"
    counts = {"email": 0, "url": 0, "phone": 0, "numeric": 0, "text": 0}
    email_p = re.compile(r"@")
    url_p   = re.compile(r"https?://|www\.", re.I)
    phone_p = re.compile(r"^[\d\-\(\)\+\s\.]{7,}$")
    num_p   = re.compile(r"^[\d\.,\-\+kKmM\s]+$")
    for s in samples:
        s = s.strip()
        if email_p.search(s):      counts["email"] += 1
        elif url_p.search(s):      counts["url"] += 1
        elif phone_p.match(s):     counts["phone"] += 1
        elif num_p.match(s):       counts["numeric"] += 1
        else:                      counts["text"] += 1
    best = max(counts, key=counts.get)
    return best if counts[best] / len(samples) >= 0.5 else "mixed"
