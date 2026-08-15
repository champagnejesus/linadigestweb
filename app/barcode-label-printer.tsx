"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { jsPDF } from "jspdf";

const LABEL_WIDTH_MM = 62;
const PRINT_WIDTH_MM = 60.96; // 2.4 in: medida exacta informada por el controlador Brother.

const LABEL_SIZES = [
  { id: "standard", label: "62 × 29 mm", description: "Estándar", heightMm: 29, barcodeHeight: 66 },
  { id: "compact", label: "62 × 17,8 mm", description: "Compacta", heightMm: 17.8, barcodeHeight: 44 },
] as const;

type LabelSizeId = (typeof LABEL_SIZES)[number]["id"];

export default function BarcodeLabelPrinter({
  value,
  productName = "LinaDigest",
}: {
  value: string;
  productName?: string;
}) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const printingRef = useRef(false);
  const [labelSizeId, setLabelSizeId] = useState<LabelSizeId>("standard");
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const normalizedValue = value.trim();
  const labelSize = LABEL_SIZES.find((size) => size.id === labelSizeId) ?? LABEL_SIZES[0];

  useEffect(() => {
    if (!barcodeRef.current || !normalizedValue) return;

    JsBarcode(barcodeRef.current, normalizedValue, {
      format: "CODE128",
      width: 2.35,
      height: labelSize.barcodeHeight,
      margin: 0,
      displayValue: false,
      background: "#ffffff",
      lineColor: "#000000",
    });
  }, [labelSize.barcodeHeight, normalizedValue]);

  function printLabel() {
    if (!normalizedValue || printingRef.current) return;
    printingRef.current = true;
    setPrinting(true);
    setPrintError("");

    try {
      const compact = labelSize.id === "compact";
      const printHeightMm = compact ? 17.78 : 28.96;
      const barcodeCanvas = document.createElement("canvas");
      JsBarcode(barcodeCanvas, normalizedValue, {
        format: "CODE128",
        width: compact ? 2.2 : 2.6,
        height: compact ? 58 : 78,
        margin: 0,
        displayValue: false,
        background: "#ffffff",
        lineColor: "#000000",
      });

      const labelPdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [printHeightMm, PRINT_WIDTH_MM],
        compress: true,
      });
      const barcodeWidthMm = compact ? 47 : 50;
      const barcodeHeightMm = compact ? 7.2 : 12;
      const barcodeX = (PRINT_WIDTH_MM - barcodeWidthMm) / 2;
      const nameY = compact ? 3.5 : 5;
      const barcodeY = compact ? 5.1 : 7.2;

      labelPdf.setProperties({ title: `Etiqueta ${productName}` });
      labelPdf.setFont("helvetica", "bold");
      labelPdf.setFontSize(compact ? 8.5 : 11);
      labelPdf.text(productName, PRINT_WIDTH_MM / 2, nameY, { align: "center", baseline: "middle" });
      labelPdf.addImage(
        barcodeCanvas.toDataURL("image/png"),
        "PNG",
        barcodeX,
        barcodeY,
        barcodeWidthMm,
        barcodeHeightMm,
        undefined,
        "FAST",
      );
      labelPdf.setFontSize(compact ? 5.5 : 7);
      labelPdf.text(
        `Código: ${normalizedValue}`,
        PRINT_WIDTH_MM / 2,
        compact ? 16.1 : 26.6,
        { align: "center", baseline: "bottom" },
      );
      labelPdf.autoPrint();

      const pdfUrl = labelPdf.output("bloburl");
      const printWindow = window.open(pdfUrl.toString(), "_blank");
      if (!printWindow) {
        URL.revokeObjectURL(pdfUrl.toString());
        throw new Error("Permite las ventanas emergentes para abrir la etiqueta");
      }
      printWindow.opener = null;
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl.toString()), 300000);
      printingRef.current = false;
      setPrinting(false);
    } catch (error) {
      printingRef.current = false;
      setPrinting(false);
      setPrintError(error instanceof Error ? error.message : "No fue posible imprimir");
    }
  }

  return (
    <article className="panel label-printer-card">
      <div className="label-printer-heading">
        <div>
          <span>ETIQUETA CONFIGURADA</span>
          <strong>Brother QL-800</strong>
        </div>
        <small>{labelSize.label}</small>
      </div>

      <fieldset className="label-size-control">
        <legend>Tamaño de etiqueta</legend>
        <div className="label-size-options">
          {LABEL_SIZES.map((size) => (
            <button
              key={size.id}
              className={labelSizeId === size.id ? "active" : ""}
              type="button"
              aria-pressed={labelSizeId === size.id}
              onClick={() => setLabelSizeId(size.id)}
            >
              <strong>{size.label}</strong>
              <span>{size.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="barcode-label-preview-frame" aria-label="Vista previa de la etiqueta LinaDigest">
        <div
          className={`barcode-label-sheet ${labelSize.id === "compact" ? "compact" : "standard"}`}
          style={{ aspectRatio: `${LABEL_WIDTH_MM} / ${labelSize.heightMm}` }}
        >
          <strong>{productName}</strong>
          <svg ref={barcodeRef} role="img" aria-label={`Código de barras ${normalizedValue}`} />
          <span className="barcode-label-code">Código: {normalizedValue}</span>
        </div>
      </div>

      <p className="label-printer-help">Código universal {normalizedValue} · {labelSize.label}</p>

      <button
        className="button primary label-print-button"
        type="button"
        onClick={printLabel}
        disabled={!normalizedValue || printing}
      >
        <span aria-hidden="true">▣</span>
        {printing ? "Preparando impresión…" : "Imprimir etiqueta"}
      </button>
      {printError && <p className="form-error label-print-error">{printError}</p>}
      <p className="label-single-print-note">PDF exacto · 1 página = 1 etiqueta</p>
    </article>
  );
}
