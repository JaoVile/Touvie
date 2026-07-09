#!/usr/bin/env python3
# Normalização analítica de loudness das texturas do soundscape.
#
# Mede o RMS + pico de cada mp3 (decodifica via gstreamer → wav → numpy, já que
# esta máquina não tem ffmpeg), calcula o ganho pra igualar todos a um alvo comum
# (com teto de pico pra não clipar) e gera lib/soundscape-loudness.ts — que o
# engine aplica por variante no playClip. NÃO altera os arquivos nem o md5.
#
# Uso:  python3 scripts/measure-loudness.py
# Rode de novo depois de trocar/adicionar qualquer take pra atualizar os ganhos.
#
# Requisitos: gst-launch-1.0 (+ plugins base/good) e python3-numpy.

import math
import os
import re
import subprocess
import tempfile
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOUNDS = os.path.join(ROOT, "public", "sounds")
OUT = os.path.join(ROOT, "lib", "soundscape-loudness.ts")

TARGET_RMS = -28.0  # dBFS alvo de loudness
PEAK_CEIL = -1.5    # dBFS: pico nunca passa disto depois do ganho (headroom)


def measure(mp3):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        wav = tf.name
    subprocess.run(
        ["gst-launch-1.0", "-q", "filesrc", f"location={mp3}", "!", "decodebin", "!",
         "audioconvert", "!", "audioresample", "!",
         "audio/x-raw,format=S16LE,channels=1,rate=44100", "!", "wavenc", "!",
         "filesink", f"location={wav}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    try:
        w = wave.open(wav)
        d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64)
        w.close()
    finally:
        os.unlink(wav)
    if d.size == 0:
        return None
    rms = math.sqrt(float(np.mean(d**2)))
    peak = float(np.max(np.abs(d)))
    rdb = 20 * math.log10(rms / 32768) if rms > 0 else -99.0
    pdb = 20 * math.log10(peak / 32768) if peak > 0 else -99.0
    return rdb, pdb


def main():
    files = sorted(f for f in os.listdir(SOUNDS) if f.endswith(".mp3"))
    rows, peaky = [], []
    for f in files:
        r = measure(os.path.join(SOUNDS, f))
        if not r:
            continue
        rdb, pdb = r
        desired = TARGET_RMS - rdb
        room = PEAK_CEIL - pdb
        gain = min(desired, max(0.0, room)) if desired >= 0 else desired  # boost nunca vira corte
        if desired > 0.5 and room < 0.5:
            peaky.append(f.replace(".mp3", ""))
        rows.append((f.replace(".mp3", ""), round(10 ** (gain / 20), 3), round(rdb, 1), round(gain, 1)))
        print(f"{f:16} RMS {rdb:6.1f}  pico {pdb:6.1f}  ganho {gain:+5.1f} dB")
    rows.sort()

    L = [
        "// GERADO por scripts/measure-loudness.py (RMS dBFS → ganho de normalização).",
        f"// Alvo {TARGET_RMS} dBFS com teto de pico {PEAK_CEIL} dBFS (não clipa). Aplicado por",
        "// VARIANTE no engine (playClip) — não altera arquivos nem md5; é o loudness vivo.",
        "// Regerar: python3 scripts/measure-loudness.py depois de trocar qualquer take.",
        "//",
        "// Pendente: takes 'peaky' (picos ~0dB, RMS baixo — ex.: crepitar da fogueira) não",
        "// sobem sem clipar; ficam perto de 1.0 até passarem por um limiter/compressor.",
        "",
        "/** Ganho linear por arquivo (<key> ou <key>-<variante>) pra igualar loudness. */",
        "export const LOUDNESS_GAIN: Record<string, number> = {",
    ]
    for fid, lin, rms, g in rows:
        L.append(f'  "{fid}": {lin}, // {rms} dBFS  {g:+} dB')
    L.append("};")
    with open(OUT, "w") as fh:
        fh.write("\n".join(L) + "\n")
    print(f"\n→ {OUT} gerado ({len(rows)} entradas).")
    if peaky:
        print("peaky (precisam limiter, ficaram ~1.0):", ", ".join(peaky))


if __name__ == "__main__":
    main()
