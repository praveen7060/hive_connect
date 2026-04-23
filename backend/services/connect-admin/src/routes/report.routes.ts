import { Router } from 'express'
import PDFDocument from 'pdfkit'


const router = Router()


router.get('/device/:id/pdf', (req, res) => {
const doc = new PDFDocument()
res.setHeader('Content-Type', 'application/pdf')
doc.pipe(res)


doc.fontSize(18).text('CCMS Device Report')
doc.text(`Device ID: ${req.params.id}`)
doc.end()
})


export default router