const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit');
const { ArabicShaper } = require('arabic-persian-reshaper');
const https = require('https');

// Initialize Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://hdbewuhbpkfbhowaduun.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkYmV3dWhicGtmYmhvd2FkdXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDI5MzQsImV4cCI6MjA5NzIxODkzNH0.RhaY4nmyvedimY4RhZcjWtm0SopnTWleW4zYUl0NYHc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Using ArabicShaper directly

// Helper to format Arabic text for LTR PDFKit engine
function shapeArabic(text) {
  if (!text) return '';
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  if (!hasArabic) return text;

  // Split text by space to process word by word
  const words = text.split(' ');
  const processedWords = words.map(word => {
    // If the word contains Arabic letters, shape and reverse it
    if (/[\u0600-\u06FF]/.test(word)) {
      const reshaped = ArabicShaper.convertArabic(word);
      return reshaped.split('').reverse().join('');
    }
    return word;
  });

  // Reverse the word order for RTL text direction
  return processedWords.reverse().join(' ');
}

// Caching the font buffer in memory
let cachedFontBuffer = null;
function getFontBuffer() {
  if (cachedFontBuffer) return Promise.resolve(cachedFontBuffer);
  const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf';
  return new Promise((resolve, reject) => {
    https.get(fontUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download font: status ${res.statusCode}`));
        return;
      }
      const data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        cachedFontBuffer = Buffer.concat(data);
        resolve(cachedFontBuffer);
      });
    }).on('error', (err) => reject(err));
  });
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { restaurant_id, year, month, force_auto } = req.method === 'POST' ? req.body : req.query;

  if (!restaurant_id || !year || !month) {
    return res.status(400).json({ error: 'Missing restaurant_id, year, or month' });
  }

  const rId = restaurant_id;
  const yr = parseInt(year);
  const mth = parseInt(month);

  try {
    // 1. Check if already archived
    const { data: existingArchive, error: archiveCheckError } = await supabase
      .from('monthly_totals')
      .select('*')
      .eq('restaurant_id', rId)
      .eq('year', yr)
      .eq('month', mth)
      .single();

    if (existingArchive && existingArchive.pdf_url) {
      return res.status(200).json({
        message: 'Month already archived',
        pdfUrl: existingArchive.pdf_url,
        alreadyArchived: true
      });
    }

    // 2. Fetch Restaurant Data
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', rId)
      .single();

    if (restError || !restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // 3. Fetch Daily Sales Summary for the given month
    const startDate = `${yr}-${String(mth).padStart(2, '0')}-01`;
    // End date calculation
    const lastDay = new Date(yr, mth, 0).getDate();
    const endDate = `${yr}-${String(mth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data: dailySales, error: salesError } = await supabase
      .from('daily_sales_summary')
      .select('*')
      .eq('restaurant_id', rId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (salesError) {
      return res.status(500).json({ error: 'Failed to fetch sales summary: ' + salesError.message });
    }

    // Even if no sales, we still allow generation of an empty report
    const salesList = dailySales || [];
    const totalOrders = salesList.reduce((sum, item) => sum + (item.total_orders || 0), 0);
    const totalRevenue = salesList.reduce((sum, item) => sum + (parseFloat(item.total_revenue) || 0), 0);

    // 4. Generate PDF buffer using PDFKit
    const fontBuffer = await getFontBuffer();
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    
    // Promise wrapper for PDF completion
    const pdfBufferPromise = new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // Register Font for Arabic support
    doc.registerFont('Amiri', fontBuffer);
    doc.font('Amiri');

    // Header Design (Bilingual)
    doc.fontSize(22).fillColor('#333333');
    doc.text('تقرير المبيعات الشهري', { align: 'right' });
    doc.moveUp();
    doc.fontSize(18).text('Rapport Mensuel des Ventes', { align: 'left' });
    doc.moveDown(0.5);

    // Horizontal Line
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(1.5);

    // Restaurant details & Meta Info
    doc.fontSize(12).fillColor('#555555');
    // Row 1
    doc.text(shapeArabic(`المطعم: ${restaurant.name}`), { align: 'right' });
    doc.moveUp();
    doc.text(`Restaurant: ${restaurant.name}`, { align: 'left' });
    doc.moveDown(0.5);

    // Row 2
    const monthNamesAr = ["", "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const monthNamesFr = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    
    doc.text(shapeArabic(`الفترة: ${monthNamesAr[mth]} ${yr}`), { align: 'right' });
    doc.moveUp();
    doc.text(`Période: ${monthNamesFr[mth]} ${yr}`, { align: 'left' });
    doc.moveDown(0.5);

    // Note for mid-month creation
    const createdDate = new Date(restaurant.created_at);
    const createdMonth = createdDate.getMonth() + 1;
    const createdYear = createdDate.getFullYear();
    if (createdMonth === mth && createdYear === yr) {
      doc.fontSize(10).fillColor('#e02424');
      doc.text(shapeArabic('* ملاحظة: هذا التقرير يغطي الأيام الفعلية منذ إنشاء المطعم في النظام.'), { align: 'right' });
      doc.moveUp();
      doc.text('* Note: Ce rapport couvre uniquement les jours effectifs depuis la création.', { align: 'left' });
      doc.fontSize(12).fillColor('#555555');
      doc.moveDown(0.5);
    }

    doc.moveDown(1.5);

    // Table Header
    const tableTop = doc.y;
    doc.rect(50, tableTop - 5, 495, 25).fill('#f2f2f2');
    doc.fillColor('#333333');
    
    // Arabic headers (right side)
    doc.text(shapeArabic('التاريخ'), 450, tableTop, { width: 90, align: 'right' });
    doc.text(shapeArabic('الطلبات'), 320, tableTop, { width: 80, align: 'right' });
    doc.text(shapeArabic('الإجمالي (د.ج)'), 180, tableTop, { width: 120, align: 'right' });

    // French headers (left side)
    doc.text('Date', 55, tableTop, { width: 90, align: 'left' });
    doc.text('Commandes', 150, tableTop, { width: 80, align: 'left' });
    doc.text('Total (DA)', 280, tableTop, { width: 120, align: 'left' });

    doc.moveDown(1.5);

    // Table Body
    let currentY = tableTop + 25;
    doc.fillColor('#555555');
    
    salesList.forEach((row, i) => {
      // Check if page overflow
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }
      
      const formattedDate = row.date;
      const ordersCount = String(row.total_orders);
      const revenue = `${parseFloat(row.total_revenue).toFixed(2)}`;

      // Draw Row lines
      doc.moveTo(50, currentY + 12).lineTo(545, currentY + 12).strokeColor('#f0f0f0').stroke();

      // Print left (French/numeric)
      doc.text(formattedDate, 55, currentY, { align: 'left' });
      doc.text(ordersCount, 150, currentY, { align: 'left' });
      doc.text(revenue, 280, currentY, { align: 'left' });

      // Print right (Arabic - reversed Arabic string)
      doc.text(formattedDate, 450, currentY, { align: 'right' });
      doc.text(ordersCount, 320, currentY, { align: 'right' });
      doc.text(revenue, 180, currentY, { align: 'right' });

      currentY += 20;
    });

    // Summary Box at the Bottom
    currentY += 15;
    if (currentY > 650) {
      doc.addPage();
      currentY = 50;
    }

    doc.rect(50, currentY, 495, 60).fill('#eef2ff');
    doc.fillColor('#4f46e5');
    doc.fontSize(14);
    
    // Arabic Summary
    doc.text(shapeArabic(`إجمالي الطلبات: ${totalOrders}`), 300, currentY + 10, { width: 230, align: 'right' });
    doc.text(shapeArabic(`إجمالي الإيرادات: ${totalRevenue.toFixed(2)} د.ج`), 300, currentY + 30, { width: 230, align: 'right' });

    // French Summary
    doc.text(`Total Commandes: ${totalOrders}`, 65, currentY + 10, { width: 230, align: 'left' });
    doc.text(`Total Revenus: ${totalRevenue.toFixed(2)} DA`, 65, currentY + 30, { width: 230, align: 'left' });

    // End and save the PDF
    doc.end();

    const pdfBuffer = await pdfBufferPromise;

    // 5. Upload PDF to Supabase Storage
    const fileName = `${rId}/${yr}_${String(mth).padStart(2, '0')}_report.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reports')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      return res.status(500).json({ error: 'Failed to upload PDF: ' + uploadError.message });
    }

    // Get public URL of the uploaded report
    const { data: { publicUrl } } = supabase.storage
      .from('reports')
      .getPublicUrl(fileName);

    // 6. Call postgres transaction function to archive data
    const { error: archiveError } = await supabase.rpc('archive_restaurant_month', {
      p_restaurant_id: rId,
      p_year: yr,
      p_month: mth,
      p_pdf_url: publicUrl,
      p_total_orders: totalOrders,
      p_total_revenue: totalRevenue
    });

    if (archiveError) {
      // Clean up uploaded file if DB archiving fails
      await supabase.storage.from('reports').remove([fileName]);
      return res.status(500).json({ error: 'Database archiving failed: ' + archiveError.message });
    }

    // Success response
    return res.status(200).json({
      message: 'Monthly report archived successfully',
      pdfUrl: publicUrl,
      alreadyArchived: false
    });

  } catch (error) {
    console.error('Exception in archive route:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
};
