import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'

export interface ReceiptSection {
  title: string
  invoiceId: number
  partnerName: string
  date: string
  rows: { label: string; value: string }[]
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })

const safeFilename = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')

export async function generateAndShareReceipt(filename: string, sections: ReceiptSection[]) {
  if (!sections.length) throw new Error('No hay información para generar el comprobante.')
  if (sections.some((section) => !Number.isInteger(section.invoiceId) || section.invoiceId <= 0)) {
    throw new Error('El servidor no devolvió un número de factura válido.')
  }

  const content = sections
    .map(
      (section) => `
        <section>
          <header>
            <h1>Ahorro Luxury</h1>
            <h2>${escapeHtml(section.title)}</h2>
          </header>
          <div class="meta">
            <p><strong>Factura:</strong> #${section.invoiceId}</p>
            <p><strong>Socio:</strong> ${escapeHtml(section.partnerName)}</p>
            <p><strong>Fecha:</strong> ${escapeHtml(section.date)}</p>
          </div>
          <table>
            <tbody>
              ${section.rows
                .map(
                  (row) => `
                    <tr>
                      <th>${escapeHtml(row.label)}</th>
                      <td>${escapeHtml(row.value)}</td>
                    </tr>
                  `,
                )
                .join('')}
          </tbody>
          </table>
        </section>
      `,
    )
    .join('')

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #1c2940; margin: 28px; }
          section { page-break-after: always; }
          section:last-child { page-break-after: auto; }
          header { border-bottom: 2px solid #c6a66b; margin-bottom: 18px; padding-bottom: 10px; }
          h1 { color: #1c2940; font-size: 22px; margin: 0 0 6px; }
          h2 { color: #68758a; font-size: 16px; margin: 0; }
          .meta { margin-bottom: 20px; }
          .meta p { margin: 6px 0; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border-bottom: 1px solid #dce1e8; padding: 10px 6px; text-align: left; }
          th { color: #68758a; font-weight: 600; width: 45%; }
          td { font-weight: 700; }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `

  if (Platform.OS === 'web') {
    await Print.printAsync({ html })
    return
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(
      'La opción para compartir no está disponible. Si es una instalación Android/iOS, actualiza o recompila la aplicación móvil.',
    )
  }

  const { uri } = await Print.printToFileAsync({ html })
  const cacheDirectory = FileSystem.cacheDirectory
  if (!cacheDirectory) throw new Error('No se encontró la carpeta temporal para guardar el PDF.')

  const baseFilename = safeFilename(filename)
  if (!baseFilename) throw new Error('No se pudo crear un nombre válido para el PDF.')

  const namedUri = `${cacheDirectory}${baseFilename}.pdf`
  await FileSystem.deleteAsync(namedUri, { idempotent: true })
  await FileSystem.moveAsync({ from: uri, to: namedUri })
  const fileInfo = await FileSystem.getInfoAsync(namedUri)
  if (!fileInfo.exists || fileInfo.isDirectory || !fileInfo.size) {
    throw new Error('No se pudo guardar correctamente el archivo PDF.')
  }

  await Sharing.shareAsync(namedUri, {
    dialogTitle: 'Compartir comprobante PDF',
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  })
}
