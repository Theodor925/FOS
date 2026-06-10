import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildQrBillPayload, type QrBillParams } from "@/lib/swissqr";

// Zeigt den Swiss QR Code mit Schweizer Kreuz in der Mitte (SIX-Spezifikation)
export function QrBill(params: QrBillParams) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const payload = buildQrBillPayload(params);
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
    // params ist ein neues Objekt pro Render; Serialisierung als Dep-Key
  }, [JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dataUrl) return null;

  return (
    <div className="relative inline-block">
      <img src={dataUrl} alt="Swiss QR Code" width={220} height={220} />
      <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-black">
        <svg viewBox="0 0 32 32" className="h-6 w-6">
          <rect width="32" height="32" fill="black" />
          <rect x="13" y="6" width="6" height="20" fill="white" />
          <rect x="6" y="13" width="20" height="6" fill="white" />
        </svg>
      </div>
    </div>
  );
}
