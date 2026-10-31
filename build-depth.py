"""Карты глубины для живого фона главной (src/zone-bg.js): assets/depth-<тема>.webp и depth-<тема>-m.webp.

Белое - близко, чёрное - далеко. Считает нейросеть Depth Anything V2 Small (Apache-2.0) на процессоре,
запускать после замены фото темы (assets/bg-<тема>.webp или bg-<тема>-m.webp):

    pip install onnxruntime numpy pillow
    python3 build-depth.py            # все темы
    python3 build-depth.py dolg merc  # только эти

Модель (~100 МБ) один раз скачивается в .cache/ (в репозиторий не попадает).
"""
import os, sys, urllib.request
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
MODEL_URL = "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx"
MODEL = os.path.join(ROOT, ".cache", "depth-anything-v2-small.onnx")
THEMES = ["merc", "dolg", "svoboda", "science", "monolith", "rassvet", "loners", "traders", "renegades", "clearsky", "bandits"]
# фото -> ширина карты: для экранов шире 760px одна карта на bg-<тема>.webp и bg-<тема>-1280.webp, для телефона - своя
VARIANTS = [("", 960), ("-m", 480)]


def session():
    import onnxruntime as ort

    if not os.path.exists(MODEL):
        os.makedirs(os.path.dirname(MODEL), exist_ok=True)
        print("скачиваю модель глубины…")
        urllib.request.urlretrieve(MODEL_URL, MODEL + ".part")
        os.replace(MODEL + ".part", MODEL)
    return ort.InferenceSession(MODEL, providers=["CPUExecutionProvider"])


def depth(s, im):
    W, H = im.size
    # вход сети - стороны кратны 14, короткая около 518
    k = 518 / min(W, H)
    w, h = max(14, round(W * k / 14) * 14), max(14, round(H * k / 14) * 14)
    x = np.asarray(im.resize((w, h), Image.BICUBIC), dtype=np.float32) / 255.0
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    d = s.run(None, {"pixel_values": x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0]
    lo, hi = np.percentile(d, 0.5), np.percentile(d, 99.5)  # без редких выбросов
    return np.clip((d - lo) / (hi - lo + 1e-6), 0, 1)


def main():
    keys = sys.argv[1:] or THEMES
    s = session()
    for key in keys:
        for suf, width in VARIANTS:
            src = os.path.join(ROOT, "assets", "bg-" + key + suf + ".webp")
            if not os.path.exists(src):
                print("нет фото", src)
                continue
            im = Image.open(src).convert("RGB")
            d = depth(s, im)
            out = Image.fromarray((d * 255).round().astype(np.uint8))
            out = out.resize((width, round(width * im.size[1] / im.size[0])), Image.BICUBIC)
            out = out.filter(ImageFilter.GaussianBlur(1.2))  # мягкие края - без рваных контуров при сдвиге
            dst = os.path.join(ROOT, "assets", "depth-" + key + suf + ".webp")
            out.convert("RGB").save(dst, "WEBP", quality=88, method=6)
            print(os.path.relpath(dst, ROOT), out.size, round(os.path.getsize(dst) / 1024), "КБ")


if __name__ == "__main__":
    main()
