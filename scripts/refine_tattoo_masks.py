#!/usr/bin/env python3
from __future__ import annotations

import json
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

TATTOOS = ("01", "02", "03", "04", "05", "08", "09", "12", "13", "14", "15", "16", "17")


def clamp01(x: np.ndarray) -> np.ndarray:
    return np.clip(x, 0.0, 1.0)


def read_rgb(path: Path) -> np.ndarray:
    data = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if data is None:
        raise FileNotFoundError(path)
    return cv2.cvtColor(data, cv2.COLOR_BGR2RGB)


def read_roi(path: Path, shape: tuple[int, int]) -> np.ndarray:
    roi = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if roi is None:
        raise FileNotFoundError(path)
    h, w = shape
    if roi.shape != (h, w):
        roi = cv2.resize(roi, (w, h), interpolation=cv2.INTER_NEAREST)
    roi = (roi >= 127).astype(np.uint8)
    scale = max(1.0, min(h, w) / 720.0)
    radius = max(3, int(round(5 * scale)))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius * 2 + 1, radius * 2 + 1))
    roi = cv2.dilate(roi, k, iterations=1)
    return roi.astype(bool)


def normalize_feature(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return clamp01((x - lo) / max(1e-6, hi - lo))


def reconstruct_from_seeds(seed: np.ndarray, allowed: np.ndarray, iterations: int = 48) -> np.ndarray:
    cur = seed.astype(np.uint8)
    allowed_u8 = allowed.astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    for _ in range(iterations):
        nxt = cv2.dilate(cur, kernel, iterations=1)
        nxt = cv2.bitwise_and(nxt, allowed_u8)
        if np.array_equal(nxt, cur):
            break
        cur = nxt
    return cur.astype(bool)


def rescue_islands(raw: np.ndarray, roi: np.ndarray, support: np.ndarray) -> np.ndarray:
    candidate = ((raw >= 0.30) & roi & ~support).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
    rescued = np.zeros_like(candidate, dtype=bool)
    for lab in range(1, n):
        area = int(stats[lab, cv2.CC_STAT_AREA])
        if not (2 <= area <= 2200):
            continue
        vals = raw[labels == lab]
        if vals.size and float(vals.mean()) >= 0.34:
            rescued[labels == lab] = True
    return rescued


def refine_mask(rgb: np.ndarray, roi: np.ndarray) -> tuple[np.ndarray, dict]:
    src = rgb.astype(np.float32) / 255.0
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    blur3 = cv2.GaussianBlur(gray, (0, 0), 2.0)
    blur9 = cv2.GaussianBlur(gray, (0, 0), 7.0)
    blur25 = cv2.GaussianBlur(gray, (0, 0), 19.0)
    local_dark_small = np.maximum(0.0, blur3 - gray)
    local_dark_mid = np.maximum(0.0, blur9 - gray)
    local_dark_large = np.maximum(0.0, blur25 - gray)
    sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    gradient = np.sqrt(sobel_x * sobel_x + sobel_y * sobel_y)
    rgb_blur = cv2.GaussianBlur(src, (0, 0), 7.0)
    color_dev = np.sqrt(np.sum((src - rgb_blur) ** 2, axis=2))
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    saturation = hsv[:, :, 1] / 255.0
    darkness = clamp01((0.82 - gray) / 0.72)
    contrast_small = normalize_feature(local_dark_small, 0.006, 0.11)
    contrast_mid = normalize_feature(local_dark_mid, 0.010, 0.15)
    contrast_large = normalize_feature(local_dark_large, 0.015, 0.20)
    edge = normalize_feature(gradient, 0.025, 0.32)
    chroma = normalize_feature(color_dev, 0.020, 0.22)
    sat = normalize_feature(saturation, 0.08, 0.55)
    dark_wash = 0.50 * darkness + 0.26 * contrast_mid + 0.16 * contrast_large + 0.08 * edge
    linework = 0.18 * darkness + 0.38 * contrast_small + 0.30 * contrast_mid + 0.14 * edge
    color_ink = 0.20 * darkness + 0.23 * contrast_mid + 0.22 * edge + 0.20 * chroma + 0.15 * sat
    raw = np.maximum.reduce([dark_wash, linework, color_ink])
    bare_like = ((gray > 0.74) & (local_dark_mid < 0.018) & (gradient < 0.055) & (saturation < 0.12) & (color_dev < 0.055))
    raw[bare_like] *= 0.16
    raw *= roi.astype(np.float32)
    strong = (raw >= 0.39) & roi
    weak = (raw >= 0.16) & roi
    strong |= (gray < 0.30) & roi & (raw >= 0.24)
    support = reconstruct_from_seeds(strong, weak)
    support |= rescue_islands(raw, roi, support)
    scale = max(1.0, min(gray.shape) / 720.0)
    close_n = max(3, int(round(3 * scale)))
    if close_n % 2 == 0:
        close_n += 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_n, close_n))
    support = cv2.morphologyEx(support.astype(np.uint8), cv2.MORPH_CLOSE, kernel).astype(bool) & roi
    bridge = support & (raw < 0.16)
    support[bridge & (gray > 0.70)] = False
    confidence = np.zeros_like(gray, dtype=np.float32)
    confidence[support] = 0.21 + 0.79 * clamp01(raw[support])
    confidence[strong] = np.maximum(confidence[strong], 0.46 + 0.54 * clamp01(raw[strong]))
    conf_u8 = np.round(clamp01(confidence) * 255).astype(np.uint8)
    conf_u8[~roi] = 0
    active = conf_u8 >= 46
    strong_out = conf_u8 >= 88
    roi_pixels = int(roi.sum())
    stats = {
        "roi_pixels": roi_pixels,
        "active_pixels": int(active.sum()),
        "strong_pixels": int(strong_out.sum()),
        "active_pct_of_roi": round(100.0 * float(active.sum()) / max(1, roi_pixels), 2),
        "strong_pct_of_roi": round(100.0 * float(strong_out.sum()) / max(1, roi_pixels), 2),
        "active_pct_of_image": round(100.0 * float(active.mean()), 2),
    }
    return conf_u8, stats


def save_mask(path: Path, mask: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rgba = np.zeros((mask.shape[0], mask.shape[1], 4), dtype=np.uint8)
    rgba[:, :, 0] = mask
    rgba[:, :, 1] = mask
    rgba[:, :, 2] = mask
    rgba[:, :, 3] = 255
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)


def patch_index(mask_ids: tuple[str, ...]) -> int:
    text = INDEX.read_text(encoding="utf-8")
    replacements = 0
    for tattoo_id in mask_ids:
        src = f'assets/tattoo-{tattoo_id}.jpg'
        mask = f'assets/masks/tattoo-{tattoo_id}.mask.png'
        pattern = re.compile(rf'<img\b(?=[^>]*\bsrc="{re.escape(src)}")[^>]*>', flags=re.IGNORECASE)
        def replace(match: re.Match[str]) -> str:
            nonlocal replacements
            tag = match.group(0)
            if "data-no-ink" in tag:
                raise RuntimeError(f"{src} is unexpectedly marked data-no-ink")
            tag = re.sub(r'\sdata-ink-mask="[^"]*"', "", tag)
            tag = tag[:-1].rstrip() + f' data-ink-mask="{mask}" />' if tag.endswith("/>") else tag[:-1].rstrip() + f' data-ink-mask="{mask}">'
            replacements += 1
            return tag
        text, count = pattern.subn(replace, text, count=1)
        if count != 1:
            raise RuntimeError(f"Could not uniquely patch {src}; matches={count}")
    amanda = re.search(r'<img\b(?=[^>]*\bsrc="assets/tattoo-18\.jpg")[^>]*>', text, flags=re.IGNORECASE)
    if not amanda or "data-no-ink" not in amanda.group(0):
        raise RuntimeError("Amanda tattoo-18 exclusion is missing")
    if "data-ink-mask" in amanda.group(0):
        raise RuntimeError("Amanda tattoo-18 must never receive a mask")
    INDEX.write_text(text, encoding="utf-8")
    return replacements


def make_qa_sheet(records: list[tuple[str, np.ndarray, np.ndarray, np.ndarray]], stats: dict) -> None:
    QA_DIR.mkdir(parents=True, exist_ok=True)
    cell_w, cell_h = 240, 360
    cols = 4
    rows = (len(records) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "black")
    font = ImageFont.load_default()
    for idx, (tattoo_id, rgb, roi, mask) in enumerate(records):
        src = Image.fromarray(rgb).convert("RGB")
        h, w = rgb.shape[:2]
        scale = min((cell_w - 8) / w, 290 / h)
        tw, th = max(1, int(w * scale)), max(1, int(h * scale))
        src = src.resize((tw, th), Image.Resampling.LANCZOS)
        roi_img = Image.fromarray((roi.astype(np.uint8) * 255), "L").resize((tw, th), Image.Resampling.NEAREST)
        mask_img = Image.fromarray(mask, "L").resize((tw, th), Image.Resampling.LANCZOS)
        oa = np.array(src, dtype=np.uint8)
        mm = np.array(mask_img, dtype=np.uint8)
        alpha = (mm.astype(np.float32) / 255.0 * 0.62)[:, :, None]
        tint = np.zeros_like(oa); tint[:, :, 0] = 255; tint[:, :, 1] = 230; tint[:, :, 2] = 80
        oa = np.round(oa * (1 - alpha) + tint * alpha).astype(np.uint8)
        overlay = Image.fromarray(oa, "RGB")
        x0 = (idx % cols) * cell_w + 4; y0 = (idx // cols) * cell_h + 4
        sheet.paste(overlay, (x0, y0))
        roi_rgb = Image.merge("RGB", (roi_img, roi_img, roi_img)).resize((110, 55), Image.Resampling.NEAREST)
        mask_rgb = Image.merge("RGB", (mask_img, mask_img, mask_img)).resize((110, 55), Image.Resampling.LANCZOS)
        sheet.paste(roi_rgb, (x0, y0 + 296)); sheet.paste(mask_rgb, (x0 + 116, y0 + 296))
        d = ImageDraw.Draw(sheet); s = stats[tattoo_id]
        d.text((x0, y0 + 282), f"tattoo-{tattoo_id}  active {s['active_pct_of_roi']}% ROI", fill="white", font=font)
        d.text((x0, y0 + 352), "ROI", fill="white", font=font); d.text((x0 + 116, y0 + 352), "REFINED", fill="white", font=font)
    sheet.save(QA_DIR / "contact-sheet.jpg", quality=92)
    (QA_DIR / "stats.json").write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    records = []; all_stats: dict[str, dict] = {}
    for tattoo_id in TATTOOS:
        src_path = ROOT / "assets" / f"tattoo-{tattoo_id}.jpg"
        roi_path = GUIDANCE_DIR / f"tattoo-{tattoo_id}.mask.png"
        out_path = OUTPUT_DIR / f"tattoo-{tattoo_id}.mask.png"
        rgb = read_rgb(src_path); h, w = rgb.shape[:2]
        roi = read_roi(roi_path, (h, w)); mask, stats = refine_mask(rgb, roi); save_mask(out_path, mask)
        if stats["active_pct_of_roi"] < 4.0: raise RuntimeError(f"tattoo-{tattoo_id}: refined coverage too sparse: {stats}")
        if stats["active_pct_of_roi"] > 88.0: raise RuntimeError(f"tattoo-{tattoo_id}: refined coverage suspiciously solid: {stats}")
        all_stats[tattoo_id] = stats; records.append((tattoo_id, rgb, roi, mask))
        print(f"tattoo-{tattoo_id}: {json.dumps(stats, sort_keys=True)}")
    replacements = patch_index(TATTOOS)
    if replacements != len(TATTOOS): raise RuntimeError(f"Expected {len(TATTOOS)} index replacements, got {replacements}")
    make_qa_sheet(records, all_stats)
    print(f"patched {replacements} gallery images")
    print("Amanda tattoo-18 remains data-no-ink and has no mask")


if __name__ == "__main__":
    main()
