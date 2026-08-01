"""Expand clothing/shoe size ranges from wholesale titles/descriptions.

Examples:
  S-2XL   -> ["S", "M", "L", "XL", "2XL"]
  M-3XL   -> ["M", "L", "XL", "2XL", "3XL"]
  39-45   -> ["39", "40", ..., "45"]
  sz38-45 -> ["38", "39", ..., "45"]
"""
from __future__ import annotations

import re
from typing import List

ALPHA_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"]

_ALPHA_RANGE = re.compile(
    r"^(XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|\dXL)\s*[-–—]\s*"
    r"(XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|\dXL)$",
    re.I,
)
_NUM_RANGE = re.compile(r"^(\d{2})\s*[-–—]\s*(\d{2})$")
_SIZE_LABEL = re.compile(r"Sizes?\s*[:：]\s*([^.\n\r]+)", re.I)
_SZ_TOKEN = re.compile(r"\bsz\s*(\d{2}\s*[-–—]\s*\d{2})\b", re.I)


def _norm_alpha(token: str) -> str:
    t = (token or "").strip().upper().replace(" ", "")
    if not t:
        return ""
    if re.fullmatch(r"X{2,6}L", t):
        return f"{len(t) - 1}XL"
    if re.fullmatch(r"\dXL", t):
        return t
    if t in {"XXS", "XS", "S", "M", "L", "XL"}:
        return t
    return ""


def expand_size_token(raw: str) -> List[str]:
    """Expand a size token/range into discrete selectable values."""
    if not raw or not isinstance(raw, str):
        return []
    text = raw.strip().rstrip(".")
    if not text:
        return []

    m_sz = re.match(r"^sz\s*(\d{2}\s*[-–—]\s*\d{2})$", text, re.I)
    if m_sz:
        text = m_sz.group(1)

    if re.search(r"[,/|、，]", text):
        parts = [p.strip() for p in re.split(r"\s*[,/|、，]\s*", text) if p.strip()]
        if len(parts) >= 2:
            seen, out = set(), []
            for p in parts:
                if p not in seen:
                    seen.add(p)
                    out.append(p)
            return out

    m = _ALPHA_RANGE.match(text)
    if m:
        a, b = _norm_alpha(m.group(1)), _norm_alpha(m.group(2))
        if a in ALPHA_ORDER and b in ALPHA_ORDER:
            i, j = ALPHA_ORDER.index(a), ALPHA_ORDER.index(b)
            if j >= i:
                return ALPHA_ORDER[i : j + 1]

    m = _NUM_RANGE.match(text)
    if m:
        lo, hi = int(m.group(1)), int(m.group(2))
        if 20 <= lo <= hi <= 60 and hi - lo <= 20:
            return [str(n) for n in range(lo, hi + 1)]

    return []


def size_variants_from_text(*texts: str) -> List[dict]:
    """Build a structured Size variants list from free text (description/title)."""
    for text in texts:
        if not text:
            continue
        m = _SIZE_LABEL.search(text)
        token = m.group(1).strip() if m else ""
        if not token:
            m_sz = _SZ_TOKEN.search(text)
            if m_sz:
                token = m_sz.group(1)
        if not token:
            m2 = re.search(
                r"\b((?:XXS|XS|S|M|L|XL|XXL|\dXL)\s*[-–—]\s*(?:XXS|XS|S|M|L|XL|XXL|\dXL)"
                r"|\d{2}\s*[-–—]\s*\d{2})\b",
                text,
                re.I,
            )
            token = m2.group(1) if m2 else ""
        values = expand_size_token(token)
        if len(values) >= 2:
            return [{"name": "Size", "values": values}]
    return []
