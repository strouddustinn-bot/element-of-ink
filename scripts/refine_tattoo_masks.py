#!/usr/bin/env python3
"""Create production tattoo confidence masks from human ROI guidance + source photos.

Human guidance answers WHERE interaction is allowed. This extractor determines
WHICH pixels inside that region behave like tattoo pigment using multiscale
local-darkness analysis. The result is quantized confidence compatible with
js/live.js connected-component thresholds (weak=46, strong=88).
"""
from __future__ import annotations

import json
import math
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
GUIDANCE_DIR = ROOT / "assets" / "mask-guidance"
OUTPUT_DIR = ROOT / "assets" / "masks"
QA_DIR = ROOT / "qa" / "tattoo-mask-batch"
INDEX = ROOT / "index.html"
TATTOOS = ("01","02","03","04","05","08","09","12","13","14","15","16","17")


def odd(value: int, floor: int = 3) -> int:
    value = max(floor, int(value))
    return value if value % 2 else value + 1


def read_source(tattoo_id: str) -> np.ndarray:
    path = ROOT / "assets" / f"tattoo-{tattoo_id}.jpg"
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise FileNotFoundError(path)
    return image


def read_roi(tattoo_id: str, width: int, height: int) -> np.ndarray:
    path = GUIDANCE_DIR / f"tattoo-{tattoo_id}.mask.png"
    roi = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if roi is None:
        raise FileNotFoundError(path)
    if roi.shape != (height, width):
        roi = cv2.resize(roi, (width, height), interpolation=cv2.INTER_NEAREST)
    return roi >= 127


def closing_darkness(gray: np.ndarray, fraction: float, divisor: float) -> np.ndarray:
    size = odd(round(min(gray.shape) * fraction), 7)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))
    closed = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
    delta = cv2.subtract(closed, gray).astype(np.float32)
    return delta / divisor


def refine(source: np.ndarray, roi: np.ndarray) -> tuple[np.ndarray, dict]:
    gray = cv2.cvtColor(source, cv2.COLOR_BGR2GRAY)
    scales = (
        closing_darkness(gray, 0.025, 10.0),
        closing_darkness(gray, 0.065, 16.0),
        closing_darkness(gray, 0.140, 24.0),
    )
    local_dark = np.maximum.reduce(scales)

    blur = cv2.GaussianBlur(gray, (0, 0), 2.0)
    fine = np.maximum(0.0, blur.astype(np.float32) - gray.astype(np.float32)) / 7.0
    score = np.maximum(local_dark, fine)

    values = gray[roi]
    if not values.size:
        raise RuntimeError("empty ROI")
    p85 = float(np.percentile(values, 85))
    broad = np.clip(
        (p85 - gray.astype(np.float32)) / max(18.0, p85 * 0.50),
        0.0,
        1.0,
    )
    score = np.maximum(score, broad * 0.52)

    confidence = np.clip(score, 0.0, 1.0)
    p62 = float(np.percentile(values, 62))
    bright_flat = (gray.astype(np.float32) > p62) & (local_dark < 0.16)
    confidence[bright_flat] *= 0.20
    confidence[~roi] = 0.0

    raw = np.rint(confidence * 255.0).astype(np.uint8)
    mask = np.zeros_like(raw)
    mask[(raw >= 46) & (raw < 88)] = 64
    mask[(raw >= 88) & (raw < 180)] = 128
    mask[raw >= 180] = 255
    mask[~roi] = 0

    active = mask >= 46
    strong = mask >= 88
    roi_pixels = int(roi.sum())
    stats = {
        "roi_pixels": roi_pixels,
        "active_pixels": int(active.sum()),
        "strong_pixels": int(strong.sum()),
        "roi_pct_of_image": round(100.0 * roi.mean(), 2),
        "active_pct_of_roi": round(100.0 * active.sum() / max(1, roi_pixels), 2),
        "strong_pct_of_roi": round(100.0 * strong.sum() / max(1, roi_pixels), 2),
        "active_pct_of_image": round(100.0 * active.mean(), 2),
    }
    return mask, stats


def save_mask(path: Path, mask: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(path), mask, [cv2.IMWRITE_PNG_COMPRESSION, 9]):
        raise RuntimeError(f"failed to write {path}")


def patch_index() -> int:
    text = INDEX.read_text(encoding="utf-8")
    replacements = 0
    for tattoo_id in TATTOOS:
        src = f"assets/tattoo-{tattoo_id}.jpg"
        mask = f"assets/masks/tattoo-{tattoo_id}.mask.png"
        pattern = re.compile(
            rf'<img\b(?=[^>]*\bsrc="{re.escape(src)}")[^>]*>',
            flags=re.IGNORECASE,
        )

        def replace(match: re.Match[str]) -> str:
            nonlocal replacements
            tag = match.group(0)
            if "data-no-ink" in tag:
                raise RuntimeError(f"{src} unexpectedly has data-no-ink")
            tag = re.sub(r'\sdata-ink-mask="[^"]*"', "", tag)
            tag = re.sub(r"\s*/\s*>$", ">", tag)
            tag = tag[:-1].rstrip() + f' data-ink-mask="{mask}" />'
            replacements += 1
            return tag

        text, count = pattern.subn(replace, text, count=1)
        if count != 1:
            raise RuntimeError(f"Could not uniquely patch {src}; matches={count}")

    amanda = re.search(
        r'<img\b(?=[^>]*\bsrc="assets/tattoo-18\.jpg")[^>]*>',
        text,
        flags=re.IGNORECASE,
    )
    if not amanda or "data-no-ink" not in amanda.group(0):
        raise RuntimeError("Amanda tattoo-18 exclusion is missing")
    if "data-ink-mask" in amanda.group(0):
        raise RuntimeError("Amanda tattoo-18 must never receive a mask")
    INDEX.write_text(text, encoding="utf-8")
    return replacements


def make_contact_sheet(records: list[tuple[str,np.ndarray,np.ndarray,np.ndarray]], stats: dict) -> None:
    QA_DIR.mkdir(parents=True, exist_ok=True)
    cols, cell_w, cell_h = 4, 240, 350
    rows = math.ceil(len(records) / cols)
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "black")
    font = ImageFont.load_default()

    for index, (tattoo_id, source_bgr, roi, mask) in enumerate(records):
        rgb = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2RGB)
        source = Image.fromarray(rgb)
        height, width = rgb.shape[:2]
        scale = min((cell_w - 8) / width, 285 / height)
        tw, th = max(1, int(width * scale)), max(1, int(height * scale))
        source = source.resize((tw, th), Image.Resampling.LANCZOS)
        source_np = np.asarray(source).copy()
        mask_small = np.asarray(Image.fromarray(mask).resize((tw, th), Image.Resampling.NEAREST))
        alpha = (mask_small.astype(np.float32) / 255.0 * 0.70)[:, :, None]
        tint = np.zeros_like(source_np)
        tint[:, :, 0] = 255
        tint[:, :, 1] = 220
        overlay = np.rint(source_np * (1.0 - alpha) + tint * alpha).astype(np.uint8)
        x = (index % cols) * cell_w + 4
        y = (index // cols) * cell_h + 4
        sheet.paste(Image.fromarray(overlay), (x, y))
        draw = ImageDraw.Draw(sheet)
        draw.text(
            (x, y + th + 2),
            f"{tattoo_id} active ROI {stats[tattoo_id]['active_pct_of_roi']}%",
            fill="white",
            font=font,
        )

    sheet.save(QA_DIR / "contact-sheet.jpg", quality=92)
    (QA_DIR / "stats.json").write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    stats = {}
    for tattoo_id in TATTOOS:
        source = read_source(tattoo_id)
        height, width = source.shape[:2]
        roi = read_roi(tattoo_id, width, height)
        mask, item_stats = refine(source, roi)
        save_mask(OUTPUT_DIR / f"tattoo-{tattoo_id}.mask.png", mask)
        if item_stats["active_pct_of_roi"] < 4.0:
            raise RuntimeError(f"tattoo-{tattoo_id}: suspiciously sparse {item_stats}")
        stats[tattoo_id] = item_stats
        records.append((tattoo_id, source, roi, mask))
        print(f"tattoo-{tattoo_id}: {json.dumps(item_stats, sort_keys=True)}")

    patched = patch_index()
    if patched != len(TATTOOS):
        raise RuntimeError(f"Expected {len(TATTOOS)} index patches, got {patched}")
    make_contact_sheet(records, stats)
    print(f"patched {patched} gallery images")
    print("Amanda tattoo-18 remains data-no-ink and has no mask")


if __name__ == "__main__":
    main()
