// GERADO por scripts/measure-loudness (RMS dBFS → ganho de normalização).
// Alvo -28 dBFS com teto de pico -1.5 dBFS (não clipa). Aplicado por VARIANTE
// no engine (playClip) — não altera arquivos nem md5, é o ajuste de loudness vivo.
// Regerar: rode a medição e este gerador de novo depois de trocar qualquer take.
//
// Pendente: 5 takes de fogueira são 'peaky' (picos ~0dB, RMS baixo) — não dá pra
// subir sem clipar; ficam em 1.0 até passarem por um limiter/compressor.

/** Ganho linear por arquivo (<key> ou <key>-<variante>) pra igualar loudness. */
export const LOUDNESS_GAIN: Record<string, number> = {
  "chuva-1": 1.865, // -33.4 dBFS  +5.4 dB
  "chuva-2": 2.531, // -40.1 dBFS  +8.1 dB
  "chuva-3": 0.974, // -27.8 dBFS  -0.2 dB
  "chuva-4": 3.63, // -47.8 dBFS  +11.2 dB
  "chuva-5": 1.788, // -36.2 dBFS  +5.0 dB
  "chuva-6": 1.887, // -39.1 dBFS  +5.5 dB
  "chuva-7": 2.322, // -35.3 dBFS  +7.3 dB
  "chuva-8": 1.905, // -39.0 dBFS  +5.6 dB
  "floresta-1": 7.641, // -45.7 dBFS  +17.7 dB
  "floresta-10": 5.582, // -42.9 dBFS  +14.9 dB
  "floresta-2": 1.908, // -33.6 dBFS  +5.6 dB
  "floresta-3": 4.159, // -40.4 dBFS  +12.4 dB
  "floresta-4": 5.354, // -42.6 dBFS  +14.6 dB
  "floresta-5": 8.004, // -46.1 dBFS  +18.1 dB
  "floresta-6": 6.602, // -44.4 dBFS  +16.4 dB
  "floresta-7": 6.764, // -44.6 dBFS  +16.6 dB
  "floresta-8": 8.035, // -46.1 dBFS  +18.1 dB
  "floresta-9": 1.273, // -30.1 dBFS  +2.1 dB
  "fogueira-1": 1.0, // -39.5 dBFS  +0.0 dB
  "fogueira-2": 1.0, // -42.7 dBFS  +0.0 dB
  "fogueira-3": 1.0, // -28.5 dBFS  +0.0 dB
  "fogueira-4": 1.0, // -34.7 dBFS  +0.0 dB
  "fogueira-5": 1.0, // -47.8 dBFS  +0.0 dB
  "fogueira-6": 1.0, // -30.4 dBFS  +0.0 dB
  "fogueira-7": 1.022, // -28.4 dBFS  +0.2 dB
  "mar-1": 3.105, // -37.8 dBFS  +9.8 dB
  "mar-2": 1.097, // -28.8 dBFS  +0.8 dB
  "mar-3": 0.752, // -25.5 dBFS  -2.5 dB
  "mar-4": 1.66, // -33.1 dBFS  +4.4 dB
  "mar-5": 2.144, // -34.6 dBFS  +6.6 dB
  "mar-6": 0.685, // -24.7 dBFS  -3.3 dB
  "mar-7": 1.413, // -31.0 dBFS  +3.0 dB
  "mar-8": 1.547, // -31.8 dBFS  +3.8 dB
  "mar-9": 0.218, // -14.8 dBFS  -13.2 dB
  "piano-1": 2.354, // -35.4 dBFS  +7.4 dB
  "piano-10": 3.385, // -38.6 dBFS  +10.6 dB
  "piano-2": 1.515, // -31.6 dBFS  +3.6 dB
  "piano-3": 0.27, // -16.6 dBFS  -11.4 dB
  "piano-4": 1.373, // -30.8 dBFS  +2.8 dB
  "piano-5": 0.458, // -21.2 dBFS  -6.8 dB
  "piano-6": 0.298, // -17.5 dBFS  -10.5 dB
  "piano-7": 2.747, // -36.8 dBFS  +8.8 dB
  "piano-8": 0.244, // -15.7 dBFS  -12.3 dB
  "piano-9": 0.228, // -15.1 dBFS  -12.9 dB
  "ruido-marrom": 0.422, // -20.5 dBFS  -7.5 dB
  "ruido-rosa": 0.179, // -13.0 dBFS  -15.0 dB
  "vento-1": 2.169, // -34.7 dBFS  +6.7 dB
  "vento-2": 1.875, // -42.1 dBFS  +5.5 dB
  "vento-3": 0.423, // -20.5 dBFS  -7.5 dB
  "vento-4": 8.292, // -46.4 dBFS  +18.4 dB
  "vento-5": 15.302, // -51.7 dBFS  +23.7 dB
  "violao-1": 1.014, // -28.1 dBFS  +0.1 dB
  "violao-10": 0.473, // -21.5 dBFS  -6.5 dB
  "violao-11": 1.778, // -33.0 dBFS  +5.0 dB
  "violao-12": 0.317, // -18.0 dBFS  -10.0 dB
  "violao-13": 0.395, // -19.9 dBFS  -8.1 dB
  "violao-14": 0.553, // -22.9 dBFS  -5.1 dB
  "violao-2": 0.367, // -19.3 dBFS  -8.7 dB
  "violao-3": 0.543, // -22.7 dBFS  -5.3 dB
  "violao-4": 0.609, // -23.7 dBFS  -4.3 dB
  "violao-5": 0.453, // -21.1 dBFS  -6.9 dB
  "violao-6": 0.486, // -21.7 dBFS  -6.3 dB
  "violao-7": 0.513, // -22.2 dBFS  -5.8 dB
  "violao-8": 0.661, // -24.4 dBFS  -3.6 dB
  "violao-9": 0.485, // -21.7 dBFS  -6.3 dB
  "violinos-1": 0.479, // -21.6 dBFS  -6.4 dB
  "violinos-10": 0.769, // -25.7 dBFS  -2.3 dB
  "violinos-2": 0.538, // -22.6 dBFS  -5.4 dB
  "violinos-3": 1.463, // -31.3 dBFS  +3.3 dB
  "violinos-4": 0.482, // -21.7 dBFS  -6.3 dB
  "violinos-5": 1.984, // -33.9 dBFS  +5.9 dB
  "violinos-6": 1.104, // -28.9 dBFS  +0.9 dB
  "violinos-7": 1.298, // -30.3 dBFS  +2.3 dB
  "violinos-8": 0.294, // -17.4 dBFS  -10.6 dB
  "violinos-9": 0.588, // -23.4 dBFS  -4.6 dB
};
