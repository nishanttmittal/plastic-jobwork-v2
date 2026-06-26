/**
 * Hisab (money) logic + PDF — per-molder account.
 *
 *   Dues     = Σ job-work for the molder's production entries (shifts × rate +GST)
 *   Paid     = Σ payments + advances given to the molder
 *   Balance  = Dues − Paid   (positive = we still owe the molder)
 */
import { byId, jobWorkTotal, round2, shiftEquivalents } from './costing'
import { fmtDate, fmtNum } from '../../../core/utils/format'

const active = (rows) => (rows || []).filter(r => !r.voided)

/**
 * data = { production, payments }, masters = { molders }
 */
export function molderHisab(molderId, masters, data) {
  const molder = byId(masters.molders, molderId)
  const entries = active(data.production).filter(p => p.molderId === molderId)
  const pays = active(data.payments).filter(p => p.molderId === molderId)

  const dues = round2(entries.reduce((s, e) => s + jobWorkTotal(e, molder), 0))
  const advances = round2(pays.filter(p => p.kind === 'advance').reduce((s, p) => s + (Number(p.amount) || 0), 0))
  const payments = round2(pays.filter(p => p.kind !== 'advance').reduce((s, p) => s + (Number(p.amount) || 0), 0))
  const paid = round2(advances + payments)

  return {
    molder, dues, advances, payments, paid,
    balance: round2(dues - paid),
    entryCount: entries.length,
    shifts: round2(entries.reduce((s, e) => s + shiftEquivalents(e), 0)),
  }
}

/** Build a shareable Hisab PDF (returns the jsPDF doc). */
// Heavy PDF libs are loaded on demand (only when an export is triggered) so they
// stay out of the initial bundle — keeps first load fast.
export async function buildHisabPdf(molderId, masters, data, opts = {}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const h = molderHisab(molderId, masters, data)
  const molder = h.molder || { name: '(molder)' }
  const doc = new jsPDF()
  const W = doc.internal.pageSize.getWidth()

  doc.setFontSize(16); doc.setFont(undefined, 'bold')
  doc.text('UNICO Metal Products — Plastic Job Work', W / 2, 16, { align: 'center' })
  doc.setFontSize(13)
  doc.text(`Hisab: ${molder.name}`, W / 2, 24, { align: 'center' })
  doc.setFontSize(9); doc.setFont(undefined, 'normal')
  doc.text(`Generated ${fmtDate(new Date().toISOString().slice(0, 10))}${opts.range ? '  ·  ' + opts.range : ''}`, W / 2, 30, { align: 'center' })

  // Production rows.
  const entries = active(data.production).filter(p => p.molderId === molderId)
  const rows = entries.map(e => {
    const pcs = (e.items || []).reduce((s, it) => s + (Number(it.pieces) || 0), 0)
    return [e.entryNo, fmtDate(e.date), String(round2(shiftEquivalents(e))), String(pcs), `Rs ${fmtNum(jobWorkTotal(e, molder))}`]
  })
  autoTable(doc, {
    startY: 36,
    head: [['Entry', 'Date', 'Shifts', 'Pieces', 'Job work']],
    body: rows.length ? rows : [['—', '—', '—', '—', 'Rs 0']],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 118, 110] },
  })

  let y = (doc.lastAutoTable?.finalY || 40) + 8
  const line = (label, val, bold) => {
    doc.setFont(undefined, bold ? 'bold' : 'normal')
    doc.text(label, 14, y); doc.text(`Rs ${fmtNum(val)}`, W - 14, y, { align: 'right' }); y += 7
  }
  doc.setFontSize(11)
  line('Total dues (job work)', h.dues)
  line('Advances given', h.advances)
  line('Payments made', h.payments)
  doc.setDrawColor(200); doc.line(14, y - 3, W - 14, y - 3)
  line(h.balance >= 0 ? 'Balance payable to molder' : 'Molder owes us', Math.abs(h.balance), true)

  return doc
}
