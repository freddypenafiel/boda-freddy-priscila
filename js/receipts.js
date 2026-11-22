// Gestión de comprobantes de pago (fotos y PDFs):
// compresión inteligente, persistencia en Supabase, visor integrado con ← Volver y descarga Web/Android.
import { esc, toast, fmtMoney, fmtDate } from './ui.js';
import { icon } from './icons.js';

const META_MARKER = '\n[[FP_META:';
const META_END = ']]';
const MAX_PDF_BYTES = 3.5 * 1024 * 1024; // 3.5 MB
const MAX_IMG_DIM = 1400;

/** Separa la nota humana de los metadatos del proveedor y comprobante adjunto. */
export function parsePaymentMeta(payment) {
  const raw = String(payment?.note || '');
  const idx = raw.indexOf(META_MARKER);
  if (idx < 0) {
    return { note: raw.trim(), vendorId: null, vendorName: null, receipt: null };
  }
  const plainNote = raw.slice(0, idx).trim();
  const jsonStart = idx + META_MARKER.length;
  const jsonEnd = raw.lastIndexOf(META_END);
  if (jsonEnd <= jsonStart) {
    return { note: plainNote, vendorId: null, vendorName: null, receipt: null };
  }
  try {
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd));
    return {
      note: plainNote,
      vendorId: parsed.vendor_id || null,
      vendorName: parsed.vendor_name || null,
      receipt: parsed.file && parsed.file.data ? parsed.file : null,
    };
  } catch {
    return { note: plainNote, vendorId: null, vendorName: null, receipt: null };
  }
}

/** Codifica la nota humana junto con el proveedor y comprobante (foto o PDF). */
export function encodePaymentNote(plainNote, { vendorId = null, vendorName = null, receipt = null } = {}) {
  const clean = String(plainNote || '').trim();
  if (!vendorId && !vendorName && !receipt) return clean || null;
  const meta = { v: 1 };
  if (vendorId) meta.vendor_id = String(vendorId);
  if (vendorName) meta.vendor_name = String(vendorName);
  if (receipt) meta.file = receipt;
  return `${clean}${META_MARKER}${JSON.stringify(meta)}${META_END}`;
}

export function formatFileSize(bytes) {
  const b = Number(bytes || 0);
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export const isPdfReceipt = (r) => Boolean(r && (r.mime === 'application/pdf' || /\.pdf$/i.test(r.name || '')));
export const isImageReceipt = (r) => Boolean(r && /^image\//i.test(r.mime || ''));

function safeFilename(name, mime) {
  const ext = mime === 'application/pdf' ? 'pdf'
    : mime === 'image/png' ? 'png'
    : mime === 'image/webp' ? 'webp'
    : 'jpg';
  const base = String(name || 'comprobante')
    .replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 56);
  return `${base || 'Comprobante_Pago'}.${ext}`;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    r.readAsDataURL(file);
  });
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const maxSide = Math.max(width, height);
        if (maxSide > MAX_IMG_DIM) {
          const ratio = MAX_IMG_DIM / maxSide;
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
        URL.revokeObjectURL(objUrl);
        const base64Len = dataUrl.length - (dataUrl.indexOf(',') + 1);
        const approxSize = Math.round((base64Len * 3) / 4);
        resolve({
          name: safeFilename(file.name, 'image/jpeg'),
          mime: 'image/jpeg',
          size: approxSize,
          data: dataUrl,
        });
      } catch (e) {
        URL.revokeObjectURL(objUrl);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('No se pudo procesar la imagen seleccionada.'));
    };
    img.src = objUrl;
  });
}

/** Valida y optimiza un comprobante (foto o PDF) listo para subir a Supabase. */
export async function prepareReceiptFile(file) {
  if (!file) return null;
  const mime = String(file.type || '').toLowerCase();
  const name = String(file.name || 'comprobante');

  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error('El PDF supera los 3.5 MB. Comprímelo o sube una captura de pantalla del comprobante.');
    }
    const dataUrl = await readAsDataUrl(file);
    return {
      name: safeFilename(name, 'application/pdf'),
      mime: 'application/pdf',
      size: file.size,
      data: dataUrl,
    };
  }

  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(name)) {
    return compressImage(file);
  }

  throw new Error('Formato no compatible. Sube una foto (JPG, PNG, WEBP) o un archivo PDF.');
}

function dataUrlToBlob(dataUrl, fallbackMime = 'application/octet-stream') {
  const parts = String(dataUrl || '').split(',');
  const mime = (parts[0].match(/:(.*?);/) || [])[1] || fallbackMime;
  const bin = atob(parts[1] || '');
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Descarga o comparte el comprobante original (foto o PDF) en Web y APK Android. */
export async function downloadOrShareReceipt(receipt, title = 'Comprobante de pago') {
  if (!receipt?.data) return toast('Este pago no tiene archivo adjunto.', 'error');
  const filename = safeFilename(receipt.name, receipt.mime);
  const cap = window.Capacitor;

  if (cap?.Plugins?.Filesystem && cap?.Plugins?.Share) {
    try {
      const base64 = String(receipt.data).split(',')[1];
      const saved = await cap.Plugins.Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: 'CACHE',
      });
      await cap.Plugins.Share.share({
        title,
        text: `${title} — Boda Freddy & Priscila`,
        url: saved.uri,
        dialogTitle: 'Guardar, abrir o compartir comprobante',
      });
      toast('Comprobante listo para guardar o compartir ✔');
      return;
    } catch (e) {
      if (!/cancel/i.test(String(e?.message || ''))) toast('No se pudo abrir el archivo: ' + e.message, 'error');
      return;
    }
  }

  try {
    const blob = dataUrlToBlob(receipt.data, receipt.mime);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast(`Comprobante descargado: ${filename} ✔`);
  } catch (e) {
    toast('Error al descargar: ' + e.message, 'error');
  }
}

/** Abre el visor integrado en pantalla completa con botón ← Volver y botón Atrás de Android. */
export function openReceiptViewer({ payment, vendorName, budgetConcept, receipt }) {
  if (!receipt?.data) return toast('Este registro no tiene comprobante adjunto.', 'error');
  const meta = parsePaymentMeta(payment);
  const label = vendorName || meta.vendorName || budgetConcept || 'Proveedor';
  const title = `Comprobante · ${label}`;
  const isPdf = isPdfReceipt(receipt);
  const isMobile = Boolean(window.Capacitor) || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

  let pdfBlobUrl = null;
  if (isPdf) {
    try {
      pdfBlobUrl = URL.createObjectURL(dataUrlToBlob(receipt.data, 'application/pdf'));
    } catch { /* noop */ }
  }

  const viewer = document.createElement('div');
  viewer.className = 'pdf-viewer-overlay';
  viewer.innerHTML = `
    <header class="pdf-viewer-bar">
      <button type="button" class="btn btn-light pdf-back-btn" id="rcp-btn-back">← Volver</button>
      <div class="pdf-bar-title">${esc(title)}</div>
      <div class="btn-row">
        ${!isPdf ? `<button type="button" class="btn btn-light btn-xs" id="rcp-btn-zoom">🔍 Zoom</button>` : ''}
        <button type="button" class="btn btn-gold" id="rcp-btn-download">⬇️ Descargar</button>
      </div>
    </header>
    <div class="pdf-viewer-scroll receipt-viewer-scroll">
      <div class="receipt-meta-bar">
        <div>
          <strong>${esc(label)}</strong>
          <small class="muted">
            ${payment?.paid_on ? esc(fmtDate(payment.paid_on)) : ''}
            ${payment?.method ? ` · ${esc(payment.method)}` : ''}
            ${meta.note ? ` · ${esc(meta.note)}` : ''}
          </small>
        </div>
        <div class="receipt-meta-right">
          <span class="receipt-amount">${fmtMoney(payment?.amount || 0)}</span>
          <small class="muted">${esc(receipt.name)}${receipt.size ? ` (${formatFileSize(receipt.size)})` : ''}</small>
        </div>
      </div>

      <div class="receipt-stage" id="rcp-stage">
        ${isPdf
          ? (!isMobile && pdfBlobUrl
              ? `<iframe class="receipt-pdf-frame" src="${pdfBlobUrl}" title="${esc(receipt.name)}"></iframe>`
              : `<div class="receipt-pdf-card">
                   <div class="receipt-pdf-ico">${icon('fileText', 42)}</div>
                   <h3>${esc(receipt.name)}</h3>
                   <p class="muted">Documento PDF · ${formatFileSize(receipt.size) || 'Guardado en la nube'}</p>
                   <p class="muted" style="max-width:340px;font-size:0.84rem;">Toca el botón de abajo para abrir el PDF en tu visor del teléfono, guardarlo o compartirlo.</p>
                   <div class="btn-row" style="margin-top:8px;justify-content:center;">
                     <button type="button" class="btn btn-primary" id="rcp-btn-open-pdf">${icon('download', 15)} Abrir / Descargar PDF</button>
                     ${!window.Capacitor && pdfBlobUrl ? `<a class="btn btn-outline" href="${pdfBlobUrl}" target="_blank" rel="noopener">${icon('external', 15)} Abrir en pestaña</a>` : ''}
                   </div>
                 </div>`)
          : `<img class="receipt-img" id="rcp-img" src="${receipt.data}" alt="${esc(receipt.name)}">`
        }
      </div>
    </div>`;

  document.body.appendChild(viewer);
  requestAnimationFrame(() => viewer.classList.add('open'));

  let closed = false;
  const doClose = (fromPop = false) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('popstate', onPop);
    document.removeEventListener('keydown', onKey);
    if (pdfBlobUrl) setTimeout(() => URL.revokeObjectURL(pdfBlobUrl), 300);
    viewer.classList.remove('open');
    setTimeout(() => viewer.remove(), 220);
    if (!fromPop && history.state?.receiptViewer) history.back();
  };
  const onPop = () => doClose(true);
  const onKey = (e) => { if (e.key === 'Escape') doClose(false); };

  try { history.pushState({ receiptViewer: true }, ''); } catch { /* noop */ }
  window.addEventListener('popstate', onPop);
  document.addEventListener('keydown', onKey);

  viewer.querySelector('#rcp-btn-back').addEventListener('click', () => doClose(false));
  viewer.querySelector('#rcp-btn-download').addEventListener('click', () => downloadOrShareReceipt(receipt, title));
  viewer.querySelector('#rcp-btn-open-pdf')?.addEventListener('click', () => downloadOrShareReceipt(receipt, title));

  const imgEl = viewer.querySelector('#rcp-img');
  const toggleZoom = () => imgEl?.classList.toggle('zoomed');
  viewer.querySelector('#rcp-btn-zoom')?.addEventListener('click', toggleZoom);
  imgEl?.addEventListener('click', toggleZoom);
}
