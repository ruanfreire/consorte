/**
 * Imagens por índice da mensagem (mesmo índice do array `messages` em App.jsx).
 *
 * Fotos (public/fotos/): 18 vocês dois, 37 ela e filho, 42 ela e mãe.
 * GIFs: vários trechos para movimento (Giphy).
 */
const GIPHY = (id) => `https://media.giphy.com/media/${id}/giphy.gif`;

const STEP_GIFS = {
  2: { src: GIPHY("3o7abKhOpu0NwenH3O"), alt: "", kind: "gif" },
  7: { src: GIPHY("3o7abldj0b3rxrZUxW"), alt: "", kind: "gif" },
  11: { src: GIPHY("ICOgUNjpvO0PC"), alt: "", kind: "gif" },
  13: { src: GIPHY("26ufdipQqU2lhNA4g"), alt: "", kind: "gif" },
  20: { src: GIPHY("13CoXDiaCcCoyk"), alt: "", kind: "gif" },
  25: { src: GIPHY("YXQcUccrAwi2ONKCXO"), alt: "", kind: "gif" },
  33: { src: GIPHY("iKx1NwH9qIni3Ecfcr"), alt: "", kind: "gif" },
  40: { src: GIPHY("26BRv0ThflsHCqDrG"), alt: "", kind: "gif" },
  /** "e hoje… eu celebro você" — celebração (índice alinhado a `messages` em App.jsx) */
  48: { src: GIPHY("3o7aD2saalBwwftBIY"), alt: "", kind: "gif" },
  /** Última mensagem — "PARABÉNS E EU TE AMO…" (happy birthday / parabéns) */
  50: { src: GIPHY("ytwDCGipNV2sTbndUA"), alt: "Parabéns", kind: "gif" },
};

export function getStepImages(assetBase) {
  return {
    ...STEP_GIFS,
    18: { src: `${assetBase}fotos/eu-e-ela.png`, alt: "", kind: "photo" },
    37: { src: `${assetBase}fotos/ela-e-filho.png`, alt: "", kind: "photo" },
    42: { src: `${assetBase}fotos/ela-e-mae.png`, alt: "", kind: "photo" },
  };
}
