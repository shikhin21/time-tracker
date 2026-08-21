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
const headerW = pct(LAYOUT.headerCols);
const itemW = pct(LAYOUT.itemCols);
const totalsW = pct(LAYOUT.totalsCols);

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica-Bold", // every run inside the sample's tables is bold
    fontSize: LAYOUT.fontSizePt,
    padding: `${LAYOUT.page.paddingIn}in`,
    color: "#000",
  },
  table: { width: "100%", borderTop: `1 solid ${LAYOUT.border}`, borderLeft: `1 solid ${LAYOUT.border}` },
  row: { flexDirection: "row" },
  cell: {
    borderRight: `1 solid ${LAYOUT.border}`,
    borderBottom: `1 solid ${LAYOUT.border}`,
    padding: 4,
  },
  right: { textAlign: "right" },
  name: { fontSize: LAYOUT.nameFontSizePt },
  billTo: { marginTop: 12, marginBottom: 12 },
  billToLabel: { marginBottom: 2 },
  billToLine: { fontFamily: "Helvetica" }, // client block is not bold in the sample
  spacer: { height: 12 },
});

export function InvoicePdfDocument({ doc }: { doc: InvoiceDoc }) {
  return (
    <Document title={`Invoice ${doc.number}`}>
      <Page size="LETTER" style={styles.page}>
        {/* from-block | invoice meta */}
        <View style={styles.table}>
          <View style={styles.row}>
            <View style={[styles.cell, { width: headerW[0] }]}>
              <Text style={styles.name}>{doc.from.name}</Text>
              {addressLinesOf(doc.from).map((line, i) => (
                <Text key={i}>{line}</Text>
              ))}
              {doc.from.phone ? <Text>{doc.from.phone}</Text> : null}
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
          <Text style={styles.billToLine}>{doc.client.name}</Text>
          {addressLinesOf(doc.client).map((line, i) => (
            <Text key={i} style={styles.billToLine}>
              {line}
            </Text>
          ))}
        </View>

        {/* item table */}
        <View style={styles.table}>
          <View style={styles.row}>
            {["Item", "Description", "Hours worked", "Hourly rate ($)", "Amount ($)"].map(
              (heading, i) => (
                <View
                  key={heading}
                  style={[
                    styles.cell,
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
              <View style={[styles.cell, { width: itemW[0] }]}>
                <Text>{line.item}</Text>
              </View>
              <View style={[styles.cell, { width: itemW[1] }]}>
                <Text>{line.description}</Text>
              </View>
              <View style={[styles.cell, { width: itemW[2] }, styles.right]}>
                <Text>{formatInvoiceHours(line.hours)}</Text>
              </View>
              <View style={[styles.cell, { width: itemW[3] }, styles.right]}>
                <Text>{formatAmount(line.rate)}</Text>
              </View>
              <View style={[styles.cell, { width: itemW[4] }, styles.right]}>
                <Text>{formatAmount(line.amount)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />

        {/* totals */}
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
