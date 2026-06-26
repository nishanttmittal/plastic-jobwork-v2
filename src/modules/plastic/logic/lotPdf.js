/**
 * Lot reconciliation PDF — a one-page "raw material sent vs received" report
 * for one lot, shareable on WhatsApp. Mirrors the Hisab PDF style.
 */
import { fmtDate, fmtNum } from '../../../core/utils/format'
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
      ['Nuts', `${fmtNum(r.sent.nutsSent)} pcs  @ Rs ${fmtNum(r.sent.nutRate)}`],
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
      ['Good pieces', `${fmtNum(r.received.goodPieces)} pcs`],
      ['Reject pieces', `${fmtNum(r.received.rejectPieces)} pcs`],
      ['Runner returned', `${fmtNum(r.received.runnerKg)} kg`],
      ['Rejects returned', `${fmtNum(r.received.rejectsKg)} kg`],
      ['Burnt / purge loss', `${fmtNum(r.received.burntKg)} kg`],
      ['Loose nuts returned', `${fmtNum(r.returned.nuts)} pcs`],
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
      ['Nut balance', `${fmtNum(r.nutBalance)} pcs`],
    ],
    styles: { fontSize: 9 }, headStyles: { fillColor: r.flag ? [185, 28, 28] : teal },
  })

  // COST PER PIECE — two ways
  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || 40) + 4,
    head: [['COST PER PIECE', 'Compound', 'Nut', 'Job work', 'Total']],
    body: [
      ['A) Scrap = full loss', `Rs ${fmtNum(r.rates.compoundFullLoss)}`, `Rs ${fmtNum(r.rates.nutPerPiece)}`,
        `Rs ${fmtNum(r.rates.jobWorkPerPiece)}`, `Rs ${fmtNum(r.rates.fullLoss)}`],
      ['B) Regrind reused', `Rs ${fmtNum(r.rates.compoundNet)}`, `Rs ${fmtNum(r.rates.nutPerPiece)}`,
        `Rs ${fmtNum(r.rates.jobWorkPerPiece)}`, `Rs ${fmtNum(r.rates.regrind)}`],
    ],
    styles: { fontSize: 9 }, headStyles: { fillColor: teal },
    columnStyles: { 4: { fontStyle: 'bold' } },
  })

  doc.setFontSize(8); doc.setTextColor(120)
  doc.text('A charges all compound to good pieces (worst case). B credits back regrind you re-use (best case). Real cost is between the two.',
    14, (doc.lastAutoTable?.finalY || 40) + 7, { maxWidth: W - 28 })

  return doc
}
