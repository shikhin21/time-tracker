import { pdf, type DocumentProps } from "@react-pdf/renderer";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { createElement, type ReactElement } from "react";
import { InvoicePdfDocument } from "./InvoicePdfDocument";
import { invoiceFilename, type InvoiceDoc } from "./invoiceModel";

/** Renders to bytes and writes them to the path the user picks.
 *
 *  Deliberately never creates a blob: URL — the app's CSP is `default-src
 *  'self'`, and going straight from bytes to Tauri's writeFile means export
 *  doesn't need that relaxed.
 *
 *  Returns the chosen path, or null when the user cancels the save dialog —
 *  the caller must not commit the invoice snapshot in that case. */
export async function exportInvoicePdf(doc: InvoiceDoc): Promise<string | null> {
  const path = await save({
    defaultPath: invoiceFilename(doc),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return null;

  // pdf() is typed as taking a <Document> element; our component renders one,
  // but its own props type can't say so — hence the cast.
  const element = createElement(InvoicePdfDocument, { doc }) as unknown as ReactElement<
    DocumentProps
  >;
  const blob = await pdf(element).toBlob();
  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  return path;
}
