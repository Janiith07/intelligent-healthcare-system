import Prescription from '../models/Prescription.js';
import LabRequest    from '../models/LabRequest.js';
import Appointment   from '../models/Appointment.js';
import PDFDocument   from 'pdfkit';
import User          from '../models/User.js';

// ── Clinic details ─────────────────────────────────────────
const CLINIC = {
  name:    "People's Health Care",
  doctor:  'Dr. M.T.D Jayaweera',
  quals:   'MBBS (Sri Lanka)',
  slmc:    'SLMC Reg No- 14508',
  address: 'No. 123, Akuressa Road, Isadeen Town, Matara.',
  tel:     'Tele - 041 2221761',
};

// ── Create prescription ────────────────────────────────────
export const createPrescription = async (req, res) => {
  try {
    const {
      patientName, patientId,
      appointmentId,
      medications, clinicalNotes,
      labTests, labPriority, labNotes,
    } = req.body;

    if (!patientName)
      return res.status(400).json({ success: false, message: 'Patient name is required' });
    // Allow lab-only prescriptions (no medications required if lab tests are present)
    if (!medications?.length && !labTests?.length)
      return res.status(400).json({ success: false, message: 'At least one medication or lab test is required' });

    const prescriptionId = await Prescription.generatePrescriptionId();

    let labRequest = null;
    if (labTests?.length > 0) {
      const labRequestId = await LabRequest.generateLabRequestId();
      labRequest = await LabRequest.create({
        labRequestId,
        source: 'from_prescription',
        doctorId:     req.user._id,
        doctorName:   req.user.name,
        patientId:    patientId || null,
        patientName,
        tests:        labTests,
        priority:     labPriority || 'Routine',
        clinicalNotes: labNotes || '',
        status: 'pending',
        prescriptionRef: prescriptionId,
      });
    }

    const prescription = await Prescription.create({
      prescriptionId,
      doctorId:      req.user._id,
      doctorName:    req.user.name,
      patientId:     patientId || null,
      patientName,
      appointmentId: appointmentId || null,
      medications,
      clinicalNotes: clinicalNotes || '',
      labRequestId:  labRequest?._id         || null,
      labRequestRef: labRequest?.labRequestId || null,
    });

    if (appointmentId) {
      try {
        await Appointment.findOneAndUpdate(
          { appointmentId, status: { $in: ['Pending', 'In Progress'] } },
          { status: 'Completed' }
        );
      } catch (apptErr) {
        console.warn('Could not auto-complete appointment:', apptErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      prescription,
      labRequest: labRequest || null,
    });

  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Get prescriptions (role-filtered) ─────────────────────
export const getPrescriptions = async (req, res) => {
  try {
    const { pharmacyStatus, patientId, appointmentId, limit = 50, recent } = req.query;
    const filter = {};
    const role   = req.user.role;

    if (role === 'doctor')
      filter.doctorId = req.user._id;

    if (role === 'pharmacy' || role === 'cashier')
      filter.pharmacyStatus = pharmacyStatus || { $in: ['pending', 'in_progress', 'dispensed'] };

    // ── FIXED: patient filter uses userId string not ObjectId ──
    if (role === 'patient')
      filter.patientId = req.user.userId;
    // req.user.userId is the string "PAT-2026-0001"
    // Prescriptions store patientId as a string so this must match exactly

    if (role === 'admin' && pharmacyStatus)
      filter.pharmacyStatus = pharmacyStatus;

    if (patientId)     filter.patientId     = patientId;
    if (appointmentId) filter.appointmentId = appointmentId;

    if (recent === 'true') {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      filter.createdAt = { $gte: thirtyMinAgo };
    }

    const prescriptions = await Prescription.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({ success: true, count: prescriptions.length, prescriptions });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Get single prescription ────────────────────────────────
export const getPrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = id.startsWith('RX-')
      ? await Prescription.findOne({ prescriptionId: id })
      : await Prescription.findById(id);
    if (!prescription)
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    res.status(200).json({ success: true, prescription });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Update pending prescription ────────────────────────────
export const updatePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription)
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    if (prescription.doctorId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });
    if (prescription.pharmacyStatus !== 'pending')
      return res.status(400).json({ success: false, message: 'Can only edit pending prescriptions' });

    const { patientName, appointmentId, medications, clinicalNotes, labTests, labPriority, labNotes } = req.body;

    if (patientName)   prescription.patientName  = patientName;
    if (appointmentId !== undefined) prescription.appointmentId = appointmentId || null;
    if (medications?.length) prescription.medications = medications;
    if (clinicalNotes !== undefined) prescription.clinicalNotes = clinicalNotes;

    if (labTests !== undefined) {
      if (prescription.labRequestId) {
        if (labTests.length === 0) {
          await LabRequest.findByIdAndDelete(prescription.labRequestId);
          prescription.labRequestId  = null;
          prescription.labRequestRef = null;
        } else {
          await LabRequest.findByIdAndUpdate(prescription.labRequestId, {
            tests: labTests, priority: labPriority || 'Routine', clinicalNotes: labNotes || '',
          });
        }
      } else if (labTests.length > 0) {
        const labRequestId = await LabRequest.generateLabRequestId();
        const lr = await LabRequest.create({
          labRequestId, source: 'from_prescription',
          doctorId: req.user._id, doctorName: req.user.name,
          patientId: prescription.patientId, patientName: prescription.patientName,
          tests: labTests,
          priority: labPriority || 'Routine', clinicalNotes: labNotes || '',
          status: 'pending', prescriptionRef: prescription.prescriptionId,
        });
        prescription.labRequestId  = lr._id;
        prescription.labRequestRef = lr.labRequestId;
      }
    }

    await prescription.save();
    res.status(200).json({ success: true, message: 'Prescription updated', prescription });

  } catch (error) {
    console.error('Update prescription error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Mark in progress ───────────────────────────────────────
export const markInProgress = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription)
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    if (prescription.pharmacyStatus === 'dispensed')
      return res.status(400).json({ success: false, message: 'Already dispensed' });
    if (prescription.pharmacyStatus === 'in_progress')
      return res.status(400).json({ success: false, message: 'Already in progress' });
    prescription.pharmacyStatus = 'in_progress';
    await prescription.save();
    res.status(200).json({ success: true, message: 'Marked as in progress', prescription });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Mark dispensed ─────────────────────────────────────────
export const markDispensed = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription)
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    if (prescription.pharmacyStatus === 'dispensed')
      return res.status(400).json({ success: false, message: 'Already dispensed' });
    prescription.pharmacyStatus = 'dispensed';
    prescription.dispensedAt    = new Date();
    prescription.dispensedBy    = req.user._id;
    await prescription.save();
    res.status(200).json({ success: true, message: 'Marked as dispensed', prescription });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Cancel prescription ────────────────────────────────────
export const cancelPrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription)
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    if (prescription.doctorId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });
    if (prescription.pharmacyStatus === 'dispensed')
      return res.status(400).json({ success: false, message: 'Cannot cancel — already dispensed' });
    if (prescription.pharmacyStatus === 'in_progress')
      return res.status(400).json({ success: false, message: 'Cannot cancel — pharmacy has started preparing' });

    let labCancelled = false;
    if (req.body?.cancelLabToo && prescription.labRequestId) {
      const labRequest = await LabRequest.findById(prescription.labRequestId);
      if (labRequest?.status === 'pending') {
        await labRequest.deleteOne();
        labCancelled = true;
      }
    }

    await prescription.deleteOne();
    res.status(200).json({ success: true, message: 'Prescription deleted', labCancelled });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Generate Prescription PDF ──────────────────────────────
export const getPrescriptionPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = id.startsWith('RX-')
      ? await Prescription.findOne({ prescriptionId: id })
      : await Prescription.findById(id);

    if (!prescription)
      return res.status(404).json({ success: false, message: 'Prescription not found' });

    // Security: patient can only download their own
    if (req.user.role === 'patient' && prescription.patientId !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Access denied' });

    // Fetch patient details for blood group and age
    const patient = await User.findOne({ userId: prescription.patientId });
    let age = 'N/A';
    if (patient?.patientDetails?.birthday) {
      const today = new Date();
      const birth = new Date(patient.patientDetails.birthday);
      let years = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
      age = `${years} years`;
    }
    const bloodGroup = patient?.patientDetails?.bloodGroup || 'N/A';

    // Fetch appointment details if linked
    let appointment = null;
    if (prescription.appointmentId) {
      appointment = await Appointment.findOne({ appointmentId: prescription.appointmentId });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="prescription-${prescription.prescriptionId}.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // ── Header ─────────────────────────────────────────────
    doc.rect(0, 0, 595, 100).fill('#0D2137');
    doc.fillColor('white')
       .fontSize(20).font('Helvetica-Bold')
       .text(CLINIC.name, 50, 15);
    doc.fontSize(10).font('Helvetica')
       .text(CLINIC.doctor,  50, 40)
       .text(CLINIC.quals,   50, 54)
       .text(CLINIC.slmc,    50, 68);
    doc.fontSize(9)
       .text(CLINIC.address, 300, 40)
       .text(CLINIC.tel,     300, 54);

    // ── Title badge ────────────────────────────────────────
    doc.fillColor('#1a1a1a');
    doc.roundedRect(50, 115, 495, 45, 8).fill('#E3F2FD');
    doc.fillColor('#1565C0').fontSize(13).font('Helvetica-Bold')
       .text('💊  Medical Prescription', 50, 128, { width: 495, align: 'center' });

    // ── Prescription info ──────────────────────────────────
    doc.fillColor('#1a1a1a').fontSize(13).font('Helvetica-Bold')
       .text('Prescription Details', 50, 178);
    doc.moveTo(50, 195).lineTo(545, 195).strokeColor('#E0E0E0').stroke();

    const drawRow = (label, value, y) => {
      doc.fontSize(10).font('Helvetica').fillColor('#757575').text(label, 50, y);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a1a').text(String(value || '—'), 230, y);
    };

    let y = 208; const gap = 28;
    drawRow('Prescription ID', prescription.prescriptionId,  y); y += gap;
    drawRow('Date Issued',
      new Date(prescription.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric'
      }), y); y += gap;
    drawRow('Doctor',          prescription.doctorName,      y); y += gap;
    if (appointment) {
      drawRow('Appointment ID', prescription.appointmentId,  y); y += gap;
      drawRow('Session',        appointment.session,         y); y += gap;
      drawRow('Visit Date',     appointment.date,            y); y += gap;
    }
    drawRow('Pharmacy Status',
      prescription.pharmacyStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      y); y += gap;

    // ── Patient details ────────────────────────────────────
    y += 5;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').stroke(); y += 15;
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a1a1a')
       .text('Patient Details', 50, y); y += 18;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').stroke(); y += 15;

    drawRow('Patient ID',  prescription.patientId,   y); y += gap;
    drawRow('Full Name',   prescription.patientName, y); y += gap;
    drawRow('Age',         age,                      y); y += gap;
    drawRow('Blood Group', bloodGroup,               y); y += gap;

    // ── Medications ────────────────────────────────────────
    y += 5;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').stroke(); y += 15;
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a1a1a')
       .text('Medications', 50, y); y += 18;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').stroke(); y += 10;

    prescription.medications.forEach((med, i) => {
      // Medication box
      doc.roundedRect(50, y, 495, 60, 6).fill('#F8FAFC').stroke('#E2E8F0');

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a1a')
         .text(`${i + 1}. ${med.name}`, 65, y + 10);

      doc.fontSize(9).font('Helvetica').fillColor('#555');
      let detailY = y + 26;
      if (med.dosage) {
        doc.text(`Dosage: ${med.dosage}`, 65, detailY);
        detailY += 12;
      }
      const details = [];
      if (med.frequency) details.push(`Frequency: ${med.frequency}`);
      if (med.duration)  details.push(`Duration: ${med.duration}`);
      if (details.length > 0) doc.text(details.join('   ·   '), 65, detailY);
      if (med.instructions) {
        detailY += 12;
        doc.fillColor('#1565C0').text(`Note: ${med.instructions}`, 65, detailY);
      }

      y += 70;
    });

    // ── Clinical notes ─────────────────────────────────────
    if (prescription.clinicalNotes) {
      y += 5;
      doc.roundedRect(50, y, 495, 60, 8).fill('#FFF8E1');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#F57F17')
         .text('Doctor\'s Notes', 65, y + 10);
      doc.fontSize(9).font('Helvetica').fillColor('#5D4037')
         .text(prescription.clinicalNotes, 65, y + 25, { width: 465 });
      y += 70;
    }

    // ── Lab tests requested ────────────────────────────────
    if (prescription.labRequestRef) {
      y += 5;
      doc.roundedRect(50, y, 495, 35, 6).fill('#E8F5E9');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2E7D32')
         .text(`🧪 Lab Tests Requested — Ref: ${prescription.labRequestRef}`, 65, y + 12);
      y += 45;
    }

    // ── Footer ─────────────────────────────────────────────
    const generatedOn = new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    doc.fontSize(8).font('Helvetica').fillColor('#9E9E9E')
       .text(
         `Generated on ${generatedOn} · ${CLINIC.name} · ${CLINIC.tel}`,
         50, 760, { align: 'center', width: 495 }
       );

    doc.end();

  } catch (error) {
    console.error('getPrescriptionPDF error:', error);
    res.status(500).json({ success: false, message: 'Server error generating PDF', error: error.message });
  }
};