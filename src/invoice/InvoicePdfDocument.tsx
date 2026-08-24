import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatAmount, formatInvoiceDate, formatInvoiceHours } from "../lib/invoice";
import {
  addressLinesOf,
  LAYOUT,
  pct,
  totalsRows,
  type InvoiceDoc,
} from "./invoiceModel";

// The sample is set in Arial. Helvetica is metrically identical and built into
// every PDF reader, so using it keeps the layout while avoiding an embedded
// font file.
const BOLD = "Helvetica-Bold";
const REGULAR = "Helvetica";

const headerW = pct(LAYOUT.headerCols);
const itemW = pct(LAYOUT.itemCols);
const totalsW = pct(LAYOUT.totalsCols);

const styles = StyleSheet.create({
  page: {
    fontFamily: BOLD,
    fontSize: LAYOUT.fontSizePt,
    padding: `${LAYOUT.page.paddingIn}in`,
    color: "#000",
  },
  table: { width: "100%" },
  /** Only the item table is ruled. Top/left live on the table and right/bottom
   *  on each cell, so shared edges don't double up. */
  ruled: { borderTop: `1 solid ${LAYOUT.border}`, borderLeft: `1 solid ${LAYOUT.border}` },
  row: { flexDirection: "row" },
  cell: { padding: 4 },
  cellRuled: {
    borderRight: `1 solid ${LAYOUT.border}`,
    borderBottom: `1 solid ${LAYOUT.border}`,
  },
  right: { textAlign: "right" },
  name: { fontSize: LAYOUT.nameFontSizePt },
  regular: { fontFamily: REGULAR },
  billTo: { marginTop: LAYOUT.space.billTo, marginBottom: LAYOUT.space.billTo },
  billToLabel: { marginBottom: 2 },
  beforeTotals: { height: LAYOUT.space.beforeTotals },
});

export function InvoicePdfDocument({ doc }: { doc: InvoiceDoc }) {
  return (
    <Document title={`Invoice ${doc.number}`}>
      <Page size="LETTER" style={styles.page}>
        {/* from-block | invoice meta — borderless */}
        <View style={styles.table}>
          <View style={styles.row}>
            <View style={[styles.cell, { width: headerW[0] }]}>
              <Text style={styles.name}>{doc.from.name}</Text>
              {addressLinesOf(doc.from).map((line, i) => (
                <Text key={i} style={styles.regular}>
                  {line}
                </Text>
              ))}
              {doc.from.phone ? <Text style={styles.regular}>{doc.from.phone}</Text> : null}
            </View>
            <View style={[styles.cell, { width: headerW[1] }]}>
              <Text style={styles.right}>Invoice #: {doc.number}</Text>
              <Text style={styles.right}>
                Invoice Date: (mm-dd-yyyy) {formatInvoiceDate(doc.invoiceDate)}
              </Text>
              <Text style={styles.right}>
                Invoice Period: (mm-dd-yyyy) {formatInvoiceDate(doc.periodStart)} to{" "}
                {formatInvoiceDate(doc.periodEnd)}
              </Text>
              <Text style={styles.right}>Amount Due: ${formatAmount(doc.amountDue)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.billTo}>
          <Text style={styles.billToLabel}>Bill To:</Text>
          <Text style={styles.regular}>{doc.client.name}</Text>
          {addressLinesOf(doc.client).map((line, i) => (
            <Text key={i} style={styles.regular}>
              {line}
            </Text>
          ))}
        </View>

        {/* item table — the only ruled block; header bold, rows regular */}
        <View style={[styles.table, styles.ruled]}>
          <View style={styles.row}>
            {["Item", "Description", "Hours worked", "Hourly rate ($)", "Amount ($)"].map(
              (heading, i) => (
                <View
                  key={heading}
                  style={[
                    styles.cell,
                    styles.cellRuled,
                    { width: itemW[i], backgroundColor: LAYOUT.headerFill },
                    i >= 2 ? styles.right : {},
                  ]}
                >
                  <Text>{heading}</Text>
                </View>
              ),
            )}
          </View>
          {doc.lines.map((line, i) => (
            <View key={i} style={styles.row}>
              <View style={[styles.cell, styles.cellRuled, { width: itemW[0] }]}>
                <Text style={styles.regular}>{line.item}</Text>
              </View>
              <View style={[styles.cell, styles.cellRuled, { width: itemW[1] }]}>
                <Text style={styles.regular}>{line.description}</Text>
              </View>
              <View style={[styles.cell, styles.cellRuled, { width: itemW[2] }, styles.right]}>
                <Text style={styles.regular}>{formatInvoiceHours(line.hours)}</Text>
              </View>
              <View style={[styles.cell, styles.cellRuled, { width: itemW[3] }, styles.right]}>
                <Text style={styles.regular}>{formatAmount(line.rate)}</Text>
              </View>
              <View style={[styles.cell, styles.cellRuled, { width: itemW[4] }, styles.right]}>
                <Text style={styles.regular}>{formatAmount(line.amount)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.beforeTotals} />

        {/* totals — borderless */}
        <View style={styles.table}>
          {totalsRows(doc).map((row) => (
            <View key={row.label} style={styles.row}>
              <View style={[styles.cell, { width: totalsW[0] }]}>
                <Text> </Text>
              </View>
              <View style={[styles.cell, { width: totalsW[1] }, styles.right]}>
                <Text>{row.label}</Text>
              </View>
              <View style={[styles.cell, { width: totalsW[2] }, styles.right]}>
                <Text>${formatAmount(row.amount)}</Text>
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
