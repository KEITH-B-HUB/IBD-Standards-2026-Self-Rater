#!/usr/bin/env python3
"""Extract IBD Standards statements from the supplied PDF into JSON."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "Knowledge" / "IBD-Standards-2026.pdf"
OUT_PATH = ROOT / "docs" / "standards.json"

SECTION_RE = re.compile(r"^Section\s+(\d+):\s+(.+)$")
STATEMENT_RE = re.compile(r"^Statement\s+(\d+\.\d+)$")

SECTION_TITLES = {
    "1": "The IBD Service",
    "2": "Pre-Diagnosis",
    "3": "Newly Diagnosed",
    "4": "Flare Management",
    "5": "Surgery",
    "6": "Inpatient Care",
    "7": "Ongoing Care and Monitoring",
}


def clean_line(line: str) -> str:
    line = re.sub(r"\s+", " ", line.strip())
    replacements = {
        "IB D": "IBD",
        "Pre -Diagnosis": "Pre-Diagnosis",
        "New ly": "Newly",
        "Sur gery": "Surgery",
        "Inp atient": "Inpatient",
        "post- operatively": "post-operatively",
    }
    for old, new in replacements.items():
        line = line.replace(old, new)
    return line


def extract_lines() -> list[str]:
    lines: list[str] = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for raw in text.splitlines():
                line = clean_line(raw)
                if not line:
                    continue
                if line in {
                    "IBD Standards Core",
                    "Statements",
                    "For more information: info@ibduk.org ibduk.org",
                }:
                    continue
                if line.isdigit():
                    continue
                lines.append(line)
    return lines


def parse_standards(lines: list[str]) -> list[dict[str, str | int]]:
    standards: list[dict[str, str | int]] = []
    current_section = ""
    current_section_title = ""
    current_number = ""
    current_text: list[str] = []

    def flush() -> None:
        nonlocal current_number, current_text
        if not current_number:
            return
        text = " ".join(current_text).strip()
        standards.append(
            {
                "section": int(current_section),
                "sectionTitle": current_section_title,
                "number": current_number,
                "statement": text,
            }
        )
        current_number = ""
        current_text = []

    for line in lines:
        section_match = SECTION_RE.match(line)
        if section_match:
            flush()
            current_section = section_match.group(1)
            current_section_title = SECTION_TITLES.get(
                current_section, section_match.group(2).strip()
            )
            continue

        statement_match = STATEMENT_RE.match(line)
        if statement_match:
            flush()
            current_number = statement_match.group(1)
            if not current_section:
                current_section = current_number.split(".")[0]
                current_section_title = SECTION_TITLES[current_section]
            continue

        if current_number:
            current_text.append(line)

    flush()
    return standards


def main() -> None:
    standards = parse_standards(extract_lines())
    if len(standards) != 60:
        raise SystemExit(f"Expected 60 standards, extracted {len(standards)}")
    OUT_PATH.write_text(json.dumps(standards, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(standards)} standards to {OUT_PATH}")


if __name__ == "__main__":
    main()
