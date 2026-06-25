import type { DashboardRow } from '@/domain/types';
import { tierMeta } from '@/core/classification/classification';
import { formatDateTime } from '@/lib/format';
import { round } from '@/lib/math';
import { createLogger } from '@/services/logger';

const log = createLogger('export');

interface ExportRow {
  Data: string;
  Competicao: string;
  Jogo: string;
  'BTTS Sim %': number;
  'BTTS Nao %': number;
  Confianca: number;
  Classificacao: string;
}

function toExportRows(rows: DashboardRow[]): ExportRow[] {
  return rows.map((r) => ({
    Data: formatDateTime(r.fixture.date),
    Competicao: r.fixture.competition.name,
    Jogo: `${r.fixture.home.name} vs ${r.fixture.away.name}`,
    'BTTS Sim %': r.prediction ? round(r.prediction.probYes * 100, 1) : 0,
    'BTTS Nao %': r.prediction ? round(r.prediction.probNo * 100, 1) : 0,
    Confianca: r.prediction ? r.prediction.confidence : 0,
    Classificacao: r.prediction ? tierMeta(r.prediction.tier).label : 'N/D',
  }));
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportCsv(
  rows: DashboardRow[],
  filename = 'btts-previsoes.csv',
): Promise<void> {
  const { default: Papa } = await import('papaparse');
  const csv = Papa.unparse(toExportRows(rows));
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

export async function exportXlsx(
  rows: DashboardRow[],
  filename = 'btts-previsoes.xlsx',
): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(toExportRows(rows));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Previsoes');
  XLSX.writeFile(wb, filename);
}

export async function exportPdf(
  rows: DashboardRow[],
  filename = 'btts-previsoes.pdf',
): Promise<void> {
  try {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('BTTS Analytics Pro — Previsões', 14, 16);
    doc.setFontSize(9);
    doc.text(`Gerado em ${formatDateTime(new Date().toISOString())}`, 14, 22);
    const data = toExportRows(rows);
    autoTable(doc, {
      startY: 28,
      head: [Object.keys(data[0] ?? {})],
      body: data.map((r) => Object.values(r).map(String)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] },
    });
    doc.save(filename);
  } catch (err) {
    log.error('PDF export failed', err);
    throw err;
  }
}
