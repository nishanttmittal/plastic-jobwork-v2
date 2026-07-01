/**
 * Lot reconciliation PDF — a one-page "raw material sent vs received" report
 * for one lot, shareable on WhatsApp. Mirrors the Hisab PDF style.
 */
import { fmtDate, fmtNum, fmtPcsKg } from '../../../core/utils/format'

// Per-piece costs need paise (fmtNum rounds to whole rupees → ₹1.50 became ₹2).
const rupee2 = (n) => (Number(n) || 0).toFixed(2)
import { lotReconciliation } from './lot'

// Heavy PDF libs load on demand (only when exporting) to keep the initial bundle small.
export async function buildLotPdf(lotNo, masters, data) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const r = lotReconciliation(lotNo, masters, data)
  const doc = new jsPDF()
  const W = doc.internal.pageSize.getWidth()

  doc.setFontSize(16); doc.setFont(undefined, 'bold')
  doc.text('UNICO Metal Products — Plastic Job Work', W / 2, 16, { align: 'center' })
  doc.setFontSize(13)
  doc.text(`Lot reconciliation: ${lotNo}`, W / 2, 24, { align: 'center' })
  doc.setFontSize(9); doc.setFont(undefined, 'normal')
  doc.text(`Molder: ${r.molder?.name || '—'}   ·   Generated ${fmtDate(new Date().toISOString().slice(0, 10))}`,
    W / 2, 30, { align: 'center' })

  const teal = [15, 118, 110]

  // SENT
  autoTable(doc, {
    startY: 36,
    head: [['Raw material SENT', 'Qty']],
    body: [
      ['Compound (PP)', `${fmtNum(r.sent.compoundKg)} kg  @ Rs ${fmtNum(r.sent.cmpRate)}/kg`],
      ...(r.sent.nutsSent > 0 ? [['Nuts', `${fmtPcsKg(r.sent.nutsSent, r.nutWeightG)}  @ Rs ${rupee2(r.sent.nutRate)}`]] : []),
      ...(r.sent.mbKg > 0 ? [['Masterbatch', `${fmtNum(r.sent.mbKg)} kg`]] : []),
    ],
    styles: { fontSize: 9 }, headStyles: { fillColor: teal },
  })

  // RECEIVED
  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || 40) + 4,
    head: [['RECEIVED back', 'Qty']],
    body: [
      ...(r.received.machineShots > 0 ? [['Machine shots → pieces', `${fmtNum(r.received.machineShots)} shots = ${fmtNum(r.received.machinePieces)} pcs`]] : []),
      ['Good pieces', fmtPcsKg(r.received.goodPieces, r.pieceG)],
      ['Reject pieces', fmtPcsKg(r.received.rejectPieces, r.pieceG)],
      ['Runner returned', `${fmtNum(r.received.runnerKg)} kg`],
      ['Rejects returned', `${fmtNum(r.received.rejectsKg)} kg`],
      ['Burnt / purge loss', `${fmtNum(r.received.burntKg)} kg`],
      ['Loose nuts returned', fmtPcsKg(r.returned.nuts, r.nutWeightG)],
      ['Finished weight (weighed)', `${fmtNum(r.received.finishedKg)} kg`],
    ],
    styles: { fontSize: 9 }, headStyles: { fillColor: teal },
  })

  // BALANCE
  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || 40) + 4,
    head: [['MATERIAL BALANCE', 'Value']],
    body: [
      ['Compound sent', `${fmtNum(r.sent.compoundKg)} kg`],
      ['Accounted (pieces + scrap + returned)', `${fmtNum(r.accountedKg)} kg`],
      ['Unaccounted / still with molder', `${fmtNum(r.balanceKg)} kg`],
      ['Material loss', `${fmtNum(r.lossPct)} %`],
      ['Recoverable regrind', `${fmtNum(r.regrindKg)} kg`],
      ['Nut balance', fmtPcsKg(r.nutBalance, r.nutWeightG)],
    ],
    styles: { fontSize: 9 }, headStyles: { fillColor: r.flag ? [185, 28, 28] : teal },
  })

  // COST PER PIECE — two ways
  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || 40) + 4,
    head: [['COST PER PIECE', 'Compound', 'Nut', 'Job work', 'Total']],
    body: [
      ['A) Scrap = full loss', `Rs ${rupee2(r.rates.compoundFullLoss)}`, `Rs ${rupee2(r.rates.nutPerPiece)}`,
        `Rs ${rupee2(r.rates.jobWorkPerPiece)}`, `Rs ${rupee2(r.rates.fullLoss)}`],
      ['B) Regrind reused', `Rs ${rupee2(r.rates.compoundNet)}`, `Rs ${rupee2(r.rates.nutPerPiece)}`,
        `Rs ${rupee2(r.rates.jobWorkPerPiece)}`, `Rs ${rupee2(r.rates.regrind)}`],
    ],
    styles: { fontSize: 9 }, headStyles: { fillColor: teal },
    columnStyles: { 4: { fontStyle: 'bold' } },
  })

  doc.setFontSize(8); doc.setTextColor(120)
  doc.text('A charges all compound to good pieces (worst case). B credits back regrind you re-use (best case). Real cost is between the two.',
    14, (doc.lastAutoTable?.finalY || 40) + 7, { maxWidth: W - 28 })

  return doc
}
