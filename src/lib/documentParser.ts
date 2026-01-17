/**
 * Document Parser Utilities
 *
 * Parses CSV, Excel, DOCX, and PDF files for comparison
 */

import type { DocumentMetadata, ParsedDocumentContent, ParsedSheet, ParsedPDFPage, MediaType } from '../types'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

/**
 * Detect document type from file extension
 */
export function getDocumentType(fileName: string): MediaType | null {
  const extension = fileName.toLowerCase().split('.').pop()
  switch (extension) {
    case 'csv':
      return 'csv'
    case 'xlsx':
    case 'xls':
      return 'excel'
    case 'docx':
      return 'docx'
    case 'pdf':
      return 'pdf'
    default:
      return null
  }
}

/**
 * Parse CSV file
 */
export async function parseCSV(file: File): Promise<DocumentMetadata> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as string[][]
        const headers = data.length > 0 ? data[0] : []

        const parsedContent: ParsedDocumentContent = {
          type: 'csv',
          sheets: [{
            name: 'Sheet1',
            data: data,
            headers: headers
          }]
        }

        resolve({
          rowCount: data.length,
          columnCount: headers.length,
          headers: headers,
          parsedContent
        })
      },
      error: (error) => {
        reject(new Error(`CSV parse error: ${error.message}`))
      }
    })
  })
}

/**
 * Parse Excel file
 */
export async function parseExcel(file: File): Promise<DocumentMetadata> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  const sheets: ParsedSheet[] = []
  let totalRows = 0
  let maxColumns = 0

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 })
    const headers = data.length > 0 ? data[0].map(String) : []

    sheets.push({
      name: sheetName,
      data: data.map(row => row.map(cell => cell?.toString() || '')),
      headers
    })

    totalRows += data.length
    maxColumns = Math.max(maxColumns, headers.length)
  }

  const parsedContent: ParsedDocumentContent = {
    type: 'excel',
    sheets
  }

  return {
    rowCount: totalRows,
    columnCount: maxColumns,
    sheetNames: workbook.SheetNames,
    sheetCount: workbook.SheetNames.length,
    headers: sheets[0]?.headers,
    parsedContent
  }
}

/**
 * Parse DOCX file
 */
export async function parseDOCX(file: File): Promise<DocumentMetadata> {
  const arrayBuffer = await file.arrayBuffer()

  const result = await mammoth.convertToHtml({ arrayBuffer })
  const textResult = await mammoth.extractRawText({ arrayBuffer })

  const html = result.value
  const text = textResult.value

  // Count words and paragraphs
  const words = text.trim().split(/\s+/).filter(w => w.length > 0)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0)

  const parsedContent: ParsedDocumentContent = {
    type: 'docx',
    html,
    text
  }

  return {
    wordCount: words.length,
    paragraphCount: paragraphs.length,
    parsedContent
  }
}

/**
 * Parse PDF file
 */
export async function parsePDF(file: File): Promise<DocumentMetadata> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pages: ParsedPDFPage[] = []
  let hasText = false

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)

    // Extract text
    const textContent = await page.getTextContent()
    const text = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')

    if (text.trim().length > 0) {
      hasText = true
    }

    // Render page as image
    const scale = 1.5
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    canvas.width = viewport.width
    canvas.height = viewport.height

    if (context) {
      await page.render({
        canvasContext: context,
        viewport,
        // PDF.js 4.x requires the canvas property
        canvas
      } as Parameters<typeof page.render>[0]).promise
    }

    pages.push({
      pageNumber: i,
      text,
      imageDataUrl: canvas.toDataURL('image/jpeg', 0.8)
    })
  }

  const parsedContent: ParsedDocumentContent = {
    type: 'pdf',
    pages
  }

  return {
    pageCount: pdf.numPages,
    hasText,
    parsedContent
  }
}

/**
 * Parse any document file
 */
export async function parseDocument(file: File): Promise<DocumentMetadata | null> {
  const docType = getDocumentType(file.name)

  switch (docType) {
    case 'csv':
      return parseCSV(file)
    case 'excel':
      return parseExcel(file)
    case 'docx':
      return parseDOCX(file)
    case 'pdf':
      return parsePDF(file)
    default:
      return null
  }
}

/**
 * Generate thumbnail for document
 */
export function generateDocumentThumbnail(docType: MediaType): string {
  // Create a simple colored thumbnail based on document type
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 90
  const ctx = canvas.getContext('2d')

  if (!ctx) return ''

  // Background colors for different document types
  const colors: Record<string, { bg: string; fg: string; icon: string }> = {
    csv: { bg: '#22c55e', fg: '#ffffff', icon: 'CSV' },
    excel: { bg: '#16a34a', fg: '#ffffff', icon: 'XLS' },
    docx: { bg: '#2563eb', fg: '#ffffff', icon: 'DOC' },
    pdf: { bg: '#dc2626', fg: '#ffffff', icon: 'PDF' }
  }

  const color = colors[docType] || { bg: '#6b7280', fg: '#ffffff', icon: '?' }

  // Draw background
  ctx.fillStyle = color.bg
  ctx.fillRect(0, 0, 160, 90)

  // Draw document icon/text
  ctx.fillStyle = color.fg
  ctx.font = 'bold 24px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(color.icon, 80, 45)

  return canvas.toDataURL('image/png')
}
