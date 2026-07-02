import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  Printer, 
  Download, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Plus, 
  Trash2, 
  FileText, 
  ChevronRight,
  User as UserIcon,
  Stethoscope,
  Utensils,
  BookOpen,
  X,
  History,
  Sun,
  Moon,
  Coffee,
  Check,
  Activity
} from 'lucide-react';
import { generateMedicationSchedule, MedicationSchedule, ScheduleItem } from '../services/geminiService';
import { 
  db, 
  User, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp 
} from '../firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';

const getTimesPerDay = (item: any): number => {
  if (item.timesPerDay !== undefined && item.timesPerDay > 0) return item.timesPerDay;
  let count = 0;
  if (item.morning) count++;
  if (item.afternoon) count++;
  if (item.evening) count++;
  if (item.night) count++;
  return count || 1;
};

const getExactTimes = (item: any): string[] => {
  if (item.exactTimes && item.exactTimes.length > 0) return item.exactTimes;
  const times: string[] = [];
  if (item.morning) times.push("08:00 AM");
  if (item.afternoon) times.push("01:00 PM");
  if (item.evening) times.push("05:00 PM");
  if (item.night) times.push("09:00 PM");
  return times.length > 0 ? times : ["As required"];
};

interface PrescriptionScheduleScreenProps {
  user: User;
  onNavigate: (view: 'home' | 'scan' | 'history' | 'schedule') => void;
  initialPrescription?: {
    doctorName?: string;
    patientName?: string;
    patientAge?: string;
    prescriptionDate?: string;
    medicines: any[];
  } | null;
  onClearInitialPrescription?: () => void;
}

interface SavedScheduleItem extends MedicationSchedule {
  id: string;
  createdAt: any;
}

export default function PrescriptionScheduleScreen({ 
  user, 
  onNavigate,
  initialPrescription,
  onClearInitialPrescription
}: PrescriptionScheduleScreenProps) {
  // Form items
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState('');
  
  // Custom manual medicine additions
  const [manualMedicines, setManualMedicines] = useState<{
    name: string;
    dosage: string;
    duration: string;
    frequency: string;
  }[]>([]);
  const [tempMed, setTempMed] = useState({ name: '', dosage: '1 Tablet', duration: '5 Days', frequency: 'Daily' });

  // Active selected Excel Cell state for the formula bar
  const [activeCell, setActiveCell] = useState<{ ref: string; formula: string; value: string }>({
    ref: 'A1',
    formula: '=UPPER("Patient Intake Schedule")',
    value: 'Patient Intake Schedule'
  });

  const selectCell = (ref: string, formula: string, value: string) => {
    setActiveCell({ ref, formula, value });
  };

  // States
  const [isGenerating, setIsGenerating] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<MedicationSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savedSchedules, setSavedSchedules] = useState<SavedScheduleItem[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'table' | 'timeline'>('table');

  // Load prescription scans history to offer quick selection inside the page
  const [scannedHistory, setScannedHistory] = useState<any[]>([]);
  
  useEffect(() => {
    if (!user) return;
    
    // Sync schedules
    const schedulesPath = `users/${user.uid}/schedules`;
    const qSchedules = query(collection(db, schedulesPath), orderBy('createdAt', 'desc'));
    const unsubscribeSchedules = onSnapshot(qSchedules, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedScheduleItem[];
      setSavedSchedules(records);
      setIsLoadingSchedules(false);
    }, (err) => {
      console.error(err);
      setIsLoadingSchedules(false);
    });

    // Sync scanned prescriptions history for the quick select dropdown
    const prescPath = `users/${user.uid}/prescriptions`;
    const qPresc = query(collection(db, prescPath), orderBy('scannedAt', 'desc'));
    const unsubscribePresc = onSnapshot(qPresc, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setScannedHistory(records);
    }, (err) => {
      console.error(err);
    });

    return () => {
      unsubscribeSchedules();
      unsubscribePresc();
    };
  }, [user]);

  // Handle triggered initial prescription state (e.g. passed from scan details page)
  useEffect(() => {
    if (initialPrescription) {
      setPatientName(initialPrescription.patientName || '');
      setPatientAge(initialPrescription.patientAge || '');
      setDoctorName(initialPrescription.doctorName || '');
      setPrescriptionDate(initialPrescription.prescriptionDate || '');
      
      const mapped = initialPrescription.medicines.map(m => ({
        name: m.originalName || m.name || '',
        dosage: m.dosage || '1 Tablet',
        duration: m.duration || '5 Days',
        frequency: m.frequency || 'Daily'
      }));
      setManualMedicines(mapped);
      
      // Auto-trigger analysis for seamless direct UX
      triggerGeneration(
        initialPrescription.doctorName,
        initialPrescription.patientName,
        initialPrescription.patientAge,
        initialPrescription.prescriptionDate,
        mapped
      );

      // Consume initial state so it doesn't infinite loop re-run
      if (onClearInitialPrescription) {
        onClearInitialPrescription();
      }
    }
  }, [initialPrescription]);

  const addManualMed = () => {
    if (!tempMed.name.trim()) return;
    setManualMedicines([...manualMedicines, { ...tempMed }]);
    setTempMed({ name: '', dosage: '1 Tablet', duration: '5 Days', frequency: 'Daily' });
  };

  const removeManualMed = (idx: number) => {
    setManualMedicines(manualMedicines.filter((_, i) => i !== idx));
  };

  // Run Gemini schedule builder
  const triggerGeneration = async (
    docN = doctorName,
    patN = patientName,
    patA = patientAge,
    pDate = prescriptionDate,
    meds = manualMedicines
  ) => {
    if (meds.length === 0) {
      setError('Please add at least one medication or select a prescription first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    setScheduleResult(null);

    try {
      const result = await generateMedicationSchedule(
        docN.trim() || undefined,
        patN.trim() || undefined,
        patA.trim() || undefined,
        pDate.trim() || undefined,
        meds
      );

      if (result) {
        setScheduleResult(result);
        
        // Set first cell as default active cell
        if (result.schedule && result.schedule.length > 0) {
          setActiveCell({
            ref: 'A1',
            formula: `=UPPER("${result.schedule[0].medicineName}")`,
            value: result.schedule[0].medicineName
          });
        }
        
        // Save to Firestore for durable portability
        const path = `users/${user.uid}/schedules`;
        await addDoc(collection(db, path), {
          doctorName: result.doctorName || '',
          patientName: result.patientName || '',
          patientAge: result.patientAge || '',
          prescriptionDate: result.prescriptionDate || '',
          summary: result.summary || '',
          schedule: result.schedule,
          createdAt: Timestamp.now()
        });

        setSuccess('Intake schedule computed and logged to Firebase Cloud securely!');
        
        // Reset forms
        setPatientName('');
        setPatientAge('');
        setDoctorName('');
        setPrescriptionDate('');
        setManualMedicines([]);
      } else {
        setError('Failed to construct schedule chart. Please check variables.');
      }
    } catch (err: any) {
      console.error(err);
      setError('An error occurred while compiling your intake matrix. Please retry.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Trigger quick load from historical scan
  const handleLoadFromScan = (record: any) => {
    setPatientName(record.patientName || '');
    setPatientAge(record.patientAge || '');
    setDoctorName(record.doctorName || '');
    setPrescriptionDate(record.prescriptionDate || '');
    
    const mapped = record.medicines.map((m: any) => ({
      name: m.originalName || m.name || '',
      dosage: m.dosage || '1 Tablet',
      duration: m.duration || '5 Days',
      frequency: m.frequency || 'Daily'
    }));
    
    setManualMedicines(mapped);
    setError(null);
    setSuccess(`Loaded ${mapped.length} medicines from scanned prescription.`);
  };

  // Delete saved schedule
  const handleDeleteSchedule = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const path = `users/${user.uid}/schedules/${id}`;
      await deleteDoc(doc(db, `users/${user.uid}/schedules`, id));
      if (selectedScheduleId === id) {
        setSelectedScheduleId(null);
      }
    } catch (err) {
      console.error("Failed to delete schedule record", err);
    }
  };

  // Clean PDF Download Trigger using jsPDF
  const handleDownloadPDF = (scheduleObj: MedicationSchedule) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [15, 23, 42]; // Slate-900 (#0f172a)
    const accentColor = [14, 165, 233]; // Sky-500 (#0ea5e9)
    const lightBg = [248, 250, 252]; // Slate-50 (#f8fafc)
    const textColor = [51, 65, 85]; // Slate-700 (#334155)
    const mutedText = [148, 163, 184]; // Slate-400 (#94a3b8)

    let y = 15;

    // Header Logo Box
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(15, y, 12, 12, 2, 2, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('M', 18.5, y + 8.5);

    // Brand Name
    doc.setFontSize(8);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('MEDIREC CLINICAL SYSTEM', 31, y + 4);

    // Document Title
    doc.setFontSize(16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('Helvetica', 'bold');
    doc.text('Daily Medication Planner', 31, y + 11);

    // Date
    doc.setFontSize(8);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 155, y + 11);

    y += 18;

    // Horizontal Divider Line
    doc.setDrawColor(226, 232, 240); // border-slate-200
    doc.setLineWidth(0.3);
    doc.line(15, y, 195, y);

    y += 6;

    // Patient / Doctor Metadata Banner
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(15, y, 180, 22, 3, 3, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.roundedRect(15, y, 180, 22, 3, 3, 'S');

    // Metadata Texts
    doc.setFontSize(8);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.setFont('Helvetica', 'bold');
    doc.text('PATIENT NAME', 20, y + 6);
    doc.text('AGE', 75, y + 6);
    doc.text('PRESCRIBING DOCTOR', 105, y + 6);
    doc.text('PRESCRIPTION DATE', 155, y + 6);

    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('Helvetica', 'bold');
    doc.text(scheduleObj.patientName || 'Not Specified', 20, y + 14, { maxWidth: 50 });
    doc.text(scheduleObj.patientAge || 'N/A', 75, y + 14);
    doc.text(scheduleObj.doctorName || 'Not Specified', 105, y + 14, { maxWidth: 45 });
    doc.text(scheduleObj.prescriptionDate || 'N/A', 155, y + 14);

    y += 28;

    // Table header
    doc.setFillColor(15, 23, 42); // dark slate header background
    doc.rect(15, y, 180, 8, 'F');
    
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.text('Medicine & Timing', 18, y + 5.5);
    doc.text('Dosage', 78, y + 5.5);
    doc.text('Times / Day', 95, y + 5.5);
    doc.text('Exact Time(s)', 118, y + 5.5);
    doc.text('Meal Guideline', 150, y + 5.5);
    doc.text('Duration', 178, y + 5.5);

    y += 8;

    // Table Body Rows
    scheduleObj.schedule.forEach((item, idx) => {
      // Check page overflow
      if (y > 240) {
        doc.addPage();
        y = 15;
        
        // Reprint header on new page
        doc.setFillColor(15, 23, 42);
        doc.rect(15, y, 180, 8, 'F');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.text('Medicine & Timing', 18, y + 5.5);
        doc.text('Dosage', 78, y + 5.5);
        doc.text('Times / Day', 95, y + 5.5);
        doc.text('Exact Time(s)', 118, y + 5.5);
        doc.text('Meal Guideline', 150, y + 5.5);
        doc.text('Duration', 178, y + 5.5);
        y += 8;
      }

      // Zebra striping
      if (idx % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      }
      doc.rect(15, y, 180, 16, 'F');
      
      // Bottom border for the row
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y + 16, 195, y + 16);

      // Medicine Name
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('Helvetica', 'bold');
      doc.text(item.medicineName, 18, y + 6, { maxWidth: 55 });

      // Daily Slots subtext
      const routines: string[] = [];
      if (item.morning) routines.push('Morning');
      if (item.afternoon) routines.push('Afternoon');
      if (item.evening) routines.push('Evening');
      if (item.night) routines.push('Night');
      doc.setFontSize(7);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(`Slot: ${routines.join(' - ')}`, 18, y + 11);

      // Dosage
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'bold');
      doc.text(item.dosage, 78, y + 8);

      // Times/Day
      const timesPerDay = getTimesPerDay(item);
      doc.text(`${timesPerDay} times`, 95, y + 8);

      // Exact Times
      const exactTimes = getExactTimes(item);
      doc.setFontSize(7.5);
      doc.setFont('Helvetica', 'normal');
      doc.text(exactTimes.join(', '), 118, y + 8, { maxWidth: 30 });

      // Meal Guideline
      doc.setFontSize(8.5);
      doc.setFont('Helvetica', 'bold');
      if (item.beforeMeal) {
        doc.setTextColor(217, 119, 6); // Amber
        doc.text('Before Food', 150, y + 8);
      } else {
        doc.setTextColor(22, 163, 74); // Emerald
        doc.text('After Food', 150, y + 8);
      }

      // Duration
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(item.duration, 178, y + 8);

      y += 16;
    });

    y += 6;

    // Summary Advice Card
    if (scheduleObj.summary) {
      if (y > 230) {
        doc.addPage();
        y = 15;
      }
      doc.setFillColor(239, 246, 255); // Blue-50
      doc.roundedRect(15, y, 180, 24, 3, 3, 'F');
      doc.setDrawColor(219, 234, 254); // Blue-100
      doc.roundedRect(15, y, 180, 24, 3, 3, 'S');

      doc.setFontSize(8);
      doc.setTextColor(29, 78, 216); // Blue-700
      doc.setFont('Helvetica', 'bold');
      doc.text('CLINICAL SAFETY DISCLOSURE', 20, y + 6);

      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.setFont('Helvetica', 'normal');
      doc.text(scheduleObj.summary, 20, y + 11, { maxWidth: 170 });

      y += 30;
    }

    // Signatures
    if (y > 250) {
      doc.addPage();
      y = 15;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, 195, y);

    y += 10;

    doc.setFontSize(8);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.setFont('Helvetica', 'bold');
    doc.text('PATIENT UNDERTAKING', 15, y);
    doc.text('MEDICAL STAMP / SEAL', 135, y);

    doc.setFontSize(8);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont('Helvetica', 'normal');
    doc.text('I agree to adhere strictly to the schedule above.', 15, y + 5, { maxWidth: 70 });
    doc.text('Authorized autonomously under MediRec.', 135, y + 5, { maxWidth: 60 });

    doc.line(15, y + 18, 75, y + 18);
    doc.line(135, y + 18, 195, y + 18);

    doc.setFontSize(7.5);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('Patient / Guardian Signature', 15, y + 22);
    doc.text('Practitioner Stamp & Signature', 135, y + 22);

    // Save File
    doc.save(`Medication_Schedule_${scheduleObj.patientName || 'Patient'}.pdf`);
  };

  // Clean Native Print Trigger 
  const handlePrint = (scheduleObj: MedicationSchedule) => {
    // Generate static high-fidelity printed HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Medication Intake Schedule - ${scheduleObj.patientName || 'Patient'}</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #0f172a; background-color: white; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
            .print-border { border: 1px solid #cbd5e1 !important; }
          }
          .custom-table th {
            background-color: #f8fafc;
            color: #475569;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.05em;
          }
          .pill-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 3px 10px;
            font-size: 10px;
            font-weight: 700;
            border-radius: 9999px;
            text-transform: uppercase;
            letter-spacing: 0.025em;
          }
        </style>
      </head>
      <body>
        <div class="max-w-4xl mx-auto p-6 border border-gray-100 rounded-[2rem] space-y-6 print:border-0 print:p-0">
          <!-- Top clinic branding header -->
          <div class="flex justify-between items-center border-b border-slate-100 pb-6">
            <div class="flex items-center gap-3">
              <div style="background-color: #0f172a; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center;" class="text-white font-extrabold text-xl">
                <span style="font-family: Georgia, serif; line-height: 44px; width: 100%; text-align: center; display: block;" class="text-white text-lg">M</span>
              </div>
              <div class="space-y-0.5">
                <p class="text-[10px] font-extrabold tracking-widest text-[#0ea5e9]">MEDIREC CLINICAL SYSTEM</p>
                <h1 class="text-2xl font-black text-slate-900 tracking-tight">Daily Medication Planner</h1>
              </div>
            </div>
            
            <div class="text-right">
              <span class="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full px-3 py-1 text-[10px] font-extrabold tracking-wider uppercase inline-block">Active Treatment Plan</span>
              <p class="text-[10px] text-slate-400 font-bold mt-1">Generated: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <!-- Patient & Practitioner Info Banner -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs">
            <div>
              <span class="text-[9px] font-black uppercase text-slate-400 block tracking-widest mb-1">Patient Name</span>
              <span class="font-extrabold text-slate-900 text-sm">${scheduleObj.patientName || 'Not Specified'}</span>
            </div>
            <div>
              <span class="text-[9px] font-black uppercase text-slate-400 block tracking-widest mb-1">Patient Age</span>
              <span class="font-extrabold text-slate-900 text-sm">${scheduleObj.patientAge || 'N/A'}</span>
            </div>
            <div>
              <span class="text-[9px] font-black uppercase text-slate-400 block tracking-widest mb-1">Prescribing Doctor</span>
              <span class="font-extrabold text-slate-900 text-sm">${scheduleObj.doctorName || 'Not Specified'}</span>
            </div>
            <div>
              <span class="text-[9px] font-black uppercase text-slate-400 block tracking-widest mb-1">Prescription Date</span>
              <span class="font-extrabold text-slate-900 text-sm">${scheduleObj.prescriptionDate || 'N/A'}</span>
            </div>
          </div>

          <!-- Structured Medication Schedule Table -->
          <div class="overflow-x-auto rounded-[1.5rem] border border-slate-200/60 bg-white">
            <table class="w-full text-left border-collapse custom-table">
              <thead>
                <tr class="border-b border-slate-200 text-[10px]">
                  <th class="p-4 w-1/4">Medicine Name & Instructions</th>
                  <th class="p-4 text-center">Dosage</th>
                  <th class="p-4 text-center">Times / Day</th>
                  <th class="p-4 text-center">Exact Times</th>
                  <th class="p-4 text-center w-[180px]">Time of Intake</th>
                  <th class="p-4 text-center">Meal Guideline</th>
                  <th class="p-4 text-center">Duration</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs text-slate-700">
                ${scheduleObj.schedule.map(item => {
                  const itemsTimes = [
                    { label: 'Morning', active: item.morning, icon: '☀️' },
                    { label: 'Afternoon', active: item.afternoon, icon: '🌤️' },
                    { label: 'Evening', active: item.evening, icon: '🌆' },
                    { label: 'Night', active: item.night, icon: '🌙' }
                  ];
                  const timesPerDay = getTimesPerDay(item);
                  const exactTimes = getExactTimes(item);
                  return `
                    <tr class="hover:bg-slate-50/50">
                      <td class="p-4">
                        <p class="font-black text-slate-900 text-sm leading-tight">${item.medicineName}</p>
                        ${item.additionalInstructions ? `
                          <div class="mt-1.5 flex items-start gap-1 p-2 bg-amber-50/50 border border-amber-100 rounded-lg text-[10px] text-amber-800 font-medium">
                            <span class="leading-normal">${item.additionalInstructions}</span>
                          </div>
                        ` : ''}
                      </td>
                      <td class="p-4 text-center font-extrabold text-slate-800 text-sm">${item.dosage}</td>
                      <td class="p-4 text-center font-extrabold text-slate-800 text-sm">${timesPerDay} times</td>
                      <td class="p-4 text-center font-bold text-slate-600 text-xs">${exactTimes.join(', ')}</td>
                      <td class="p-4 text-center">
                        <div class="flex items-center justify-center gap-1">
                          ${itemsTimes.map(t => {
                            if (t.active) {
                              return `<span class="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg py-1 px-2 text-[9px] font-black">${t.icon} ${t.label}</span>`;
                            } else {
                              return `<span class="text-slate-200 rounded-lg py-1 px-2 text-[9px] font-normal border border-dashed border-slate-100">${t.label}</span>`;
                            }
                          }).join('')}
                        </div>
                      </td>
                      <td class="p-4 text-center">
                        <span class="inline-flex items-center px-2.5 py-1 text-[10px] font-black border rounded-xl ${item.beforeMeal ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-emerald-50 text-emerald-800 border-emerald-100'}">
                          ${item.beforeMeal ? '🍽️ BEFORE FOOD' : '🍛 AFTER FOOD'}
                        </span>
                      </td>
                      <td class="p-4 text-center font-extrabold text-slate-900 text-xs">${item.duration}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- clinical summary card -->
          ${scheduleObj.summary ? `
            <div class="bg-indigo-50/40 border border-indigo-100 p-5 rounded-2xl space-y-1.5">
              <span class="text-[10px] font-black uppercase text-indigo-700 tracking-wider block">Clinical Safety & Dietary Advisor</span>
              <p class="text-xs text-slate-600 leading-relaxed font-medium">${scheduleObj.summary}</p>
            </div>
          ` : ''}

          <!-- authorized signatory block -->
          <div class="grid grid-cols-2 gap-6 pt-10 border-t border-slate-100">
            <div class="text-xs text-slate-400 space-y-1">
              <p class="font-extrabold text-slate-600 uppercase tracking-wider text-[9px]">Patient Undertaking</p>
              <p class="leading-relaxed">I agree to follow the printed dosage timeline conscientiously as formulated above.</p>
              <div class="pt-8 w-44 border-b border-dashed border-slate-200"></div>
              <p class="text-[9px] text-slate-400">Patient / Guardian Signature</p>
            </div>
            
            <div class="text-right text-xs text-slate-400 space-y-1 ml-auto">
              <p class="font-extrabold text-slate-600 uppercase tracking-wider text-[9px] text-right">Medical stamp / authorization</p>
              <p class="leading-relaxed">Strictly verified under MediRec clinical protocols.</p>
              <div class="pt-8 ml-auto w-44 border-b border-dashed border-slate-200"></div>
              <p class="text-[9px] text-slate-400 text-right">Practitioner Signature & Seal</p>
            </div>
          </div>

          <!-- Bottom micro footer print disclosure -->
          <div class="pt-5 text-center text-[9px] text-slate-400 font-medium border-t border-slate-50">
            <p>MediRec Intelligent Healthcare Solutions. Generated autonomously under clinical prescription guidelines.</p>
            <p class="mt-0.5 text-slate-300 font-normal">Disclaimer: Always verify drug specifications with direct consultations of your practicing practitioner prior to taking drugs.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create a hidden printing iframe to bypass Safari/Chrome popup blockers completely
    let printFrame = document.getElementById('medirec-print-iframe') as HTMLIFrameElement;
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'medirec-print-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();
      
      // Delay printing slightly so the browser finishes rendering/loading stylesheets
      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      }, 350);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-6 space-y-7"
    >
      {/* Header */}
      <div className="space-y-1 pb-2 border-b border-slate-100/80">
        <h2 className="text-2xl font-display font-semibold text-slate-900 tracking-tight">
          Prescription Scheduler
        </h2>
        <p className="text-xs text-slate-400 font-medium">
          Plot therapy intake durations & construct printable medical dosage charts.
        </p>
      </div>

      {/* Select scanned prescription shortcuts */}
      {scannedHistory.length > 0 && (
        <div className="bg-slate-50 border border-slate-200/50 p-4.5 rounded-3xl space-y-3">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-400" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pick Scan for Auto-Schedule</h4>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1.5 snap-x">
            {scannedHistory.slice(0, 4).map((record) => (
              <button
                key={record.id}
                onClick={() => handleLoadFromScan(record)}
                className="snap-start shrink-0 bg-white hover:bg-brand-50/50 border border-slate-200 hover:border-brand-300 rounded-2xl p-3 text-left transition-colors text-xs font-semibold max-w-[200px]"
              >
                <p className="font-extrabold text-slate-800 truncate mb-1">
                  📄 {record.patientName || 'Unnamed Patient'}
                </p>
                <p className="text-[9px] text-slate-400 truncate mb-1">
                  👨‍⚕️ {record.doctorName || 'Doctor scrawl'}
                </p>
                <span className="text-[8px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded font-black uppercase tracking-wide">
                  {record.medicines?.length || 0} Meds
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form and Custom inputs */}
      <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl premium-shadow space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-500" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Create Intake Schedule</h3>
        </div>

        {error && (
          <div className="bg-red-50 text-red-800 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs font-semibold leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-800 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs font-semibold leading-relaxed">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Inputs row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Patient Name</label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand-500 font-semibold"
                placeholder="Patient Full Name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Patient Age</label>
            <input
              type="text"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand-500 font-semibold"
              placeholder="e.g., 42 Years / Children"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Doctor Name</label>
            <div className="relative">
              <Stethoscope className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand-500 font-semibold"
                placeholder="Dr. Shrikant Shah"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Prescription Date</label>
            <input
              type="text"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand-500 font-semibold"
              placeholder="e.g., 04 June, 2026"
              value={prescriptionDate}
              onChange={(e) => setPrescriptionDate(e.target.value)}
            />
          </div>
        </div>

        {/* Dynamic manual medication list inputs */}
        <div className="border-t border-slate-100 pt-4.5 space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">
            Prescribed Medicines List ({manualMedicines.length})
          </label>

          {manualMedicines.length > 0 && (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {manualMedicines.map((med, index) => (
                <div key={index} className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="truncate">
                    <p className="text-xs font-black text-slate-800 truncate">{med.name}</p>
                    <p className="text-[9px] text-slate-400 font-semibold">
                      {med.dosage} | {med.duration} | {med.frequency}
                    </p>
                  </div>
                  <button
                    onClick={() => removeManualMed(index)}
                    className="p-1.5 text-slate-300 hover:text-red-500 shrink-0 hover:bg-red-50 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick inline appender */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-200/60 text-xs">
            <div className="space-y-1 md:col-span-1">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block ml-1">Medicine Name</span>
              <input
                type="text"
                placeholder="e.g., Amoxycillin 500"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                value={tempMed.name}
                onChange={(e) => setTempMed({ ...tempMed, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block ml-1">Dosage Units</span>
              <input
                type="text"
                placeholder="e.g., 1 Tablet"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                value={tempMed.dosage}
                onChange={(e) => setTempMed({ ...tempMed, dosage: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block ml-1">Duration</span>
              <input
                type="text"
                placeholder="e.g., 5 Days"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                value={tempMed.duration}
                onChange={(e) => setTempMed({ ...tempMed, duration: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-1.5">
              <div className="space-y-1 flex-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block ml-1">Frequency</span>
                <input
                  type="text"
                  placeholder="e.g., Twice daily"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                  value={tempMed.frequency}
                  onChange={(e) => setTempMed({ ...tempMed, frequency: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={addManualMed}
                disabled={!tempMed.name.trim()}
                className="bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white p-2.5 rounded-lg h-9 flex items-center justify-center transition-colors"
              >
                <Plus className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* Generate Intake button */}
        <button
          onClick={() => triggerGeneration()}
          disabled={isGenerating || manualMedicines.length === 0}
          className="w-full py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs shadow-xl flex items-center justify-center gap-2 transition-all shadow-slate-900/10"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Medication Grid...
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4" />
              Generate Medication Intake Schedule ({manualMedicines.length} Medicines)
            </>
          )}
        </button>
      </div>

      {/* Latest Schedule Result Display */}
      <AnimatePresence>
        {scheduleResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white border border-slate-205 border-slate-200 rounded-[2.5rem] p-6 space-y-6 premium-shadow"
            id="medirec-active-schedule-chart"
          >
            {/* Header controls for schedule result */}
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-brand-600 animate-pulse shrink-0" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Clinical Treatment Planner</h4>
              </div>
              
              {/* Toggles between Tabular Timetable and Interactive Daily Checklist */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/50 no-print">
                <button
                  type="button"
                  onClick={() => setActiveViewMode('table')}
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all ${activeViewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Timetable Grid
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewMode('timeline')}
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all ${activeViewMode === 'timeline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Daily Timeline
                </button>
              </div>

              {/* Actions: Download PDF & Print directly */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrint(scheduleResult)}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-700/10"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Schedule
                </button>
                <button
                  onClick={() => handleDownloadPDF(scheduleResult)}
                  className="bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-brand-600/10"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Patients details badge summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[11px] font-semibold text-slate-705">
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Patient Name</span>
                <span className="font-extrabold text-slate-900">{scheduleResult.patientName || 'Patient'}</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Patient Age</span>
                <span className="font-extrabold text-slate-900">{scheduleResult.patientAge || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Practitioner</span>
                <span className="font-extrabold text-slate-900">{scheduleResult.doctorName || 'Dr. Shah'}</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Prescription Date</span>
                <span className="font-extrabold text-slate-900">{scheduleResult.prescriptionDate || 'N/A'}</span>
              </div>
            </div>

            {/* View renders */}
            {activeViewMode === 'table' ? (
              /* TABULAR TIMETABLE VIEW REDESIGNED AS AN INTERACTIVE MS EXCEL FILE */
              <div className="border border-[#107c41]/30 rounded-3xl overflow-hidden bg-white shadow-lg font-sans">
                {/* Excel Title & Ribbon Header */}
                <div className="bg-[#107c41] text-white px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white text-[#107c41] p-1.5 rounded-xl">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M2.25 2.25a.75.75 0 0 0-.75.75v18a.75.75 0 0 0 .75.75h19.5a.75.75 0 0 0 .75-.75V3a.75.75 0 0 0-.75-.75H2.25zM12 6.75h6v1.5h-6v-1.5zm0 4.5h6v1.5h-6v-1.5zm0 4.5h6v1.5h-6v-1.5zM6 6.75h3.75v1.5H6v-1.5zm0 4.5h3.75v1.5H6v-1.5zm0 4.5h3.75v1.5H6v-1.5z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <span className="text-[9px] uppercase font-bold tracking-widest text-[#a3e635]">Interactive Spreadsheet Mode</span>
                      <h5 className="text-xs font-black tracking-tight text-white leading-tight">Patient_Intake_Matrix.xlsx</h5>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-[10px] bg-emerald-800/60 px-2 py-1 border border-emerald-600/40 rounded-lg select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse"></span>
                    Formula Engine Active
                  </div>
                </div>

                {/* Ribbon menus */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex gap-4 text-[10px] font-black text-slate-400 uppercase tracking-wider overflow-x-auto select-none no-print">
                  <span className="text-[#107c41] border-b-2 border-[#107c41] pb-1 cursor-pointer">File</span>
                  <span className="hover:text-slate-700 cursor-pointer">Sheet1</span>
                  <span className="hover:text-slate-700 cursor-pointer">Formula-Bar</span>
                  <span className="text-emerald-700 font-black cursor-pointer bg-emerald-50 px-1 rounded">Pivot-Mode</span>
                </div>

                {/* Formula Bar Section */}
                <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-2 text-xs font-medium text-slate-600 no-print select-none">
                  <div className="bg-white border border-slate-200 py-1 px-3 rounded text-slate-800 min-w-[50px] text-center font-mono font-bold shadow-sm">
                    {activeCell.ref}
                  </div>
                  <div className="h-5 w-[1px] bg-slate-300" />
                  <span className="font-serif italic font-extrabold text-slate-400 text-sm select-none px-1">f<sub>x</sub></span>
                  <div className="flex-1 bg-white border border-slate-200 py-1.5 px-3 rounded shadow-sm text-stone-700 font-mono text-[11px] truncate flex items-center justify-between">
                    <span className="text-slate-900 font-bold truncate leading-none mr-2">{activeCell.formula}</span>
                    <span className="text-[8px] text-[#107c41] font-black uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded shrink-0 select-none">Evaluated</span>
                  </div>
                </div>

                {/* Spreadsheet Table Grid */}
                <div className="overflow-x-auto animate-fade-in">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      {/* Cell Coordinate Grid Identifiers */}
                      <tr className="bg-slate-50 border-b border-slate-200 select-none">
                        <th className="w-10 bg-slate-100 border-r border-slate-200 relative hover:bg-slate-200 cursor-pointer">
                          <div className="absolute right-0.5 bottom-0.5 w-0 h-0 border-t-[6px] border-t-transparent border-l-[6px] border-l-transparent border-r-[6px] border-r-slate-400 border-b-[6px] border-b-slate-400" />
                        </th>
                        <th className="border-r border-slate-200 p-1 text-center text-[10px] font-mono text-slate-450 font-black hover:bg-slate-200">A</th>
                        <th className="border-r border-slate-200 p-1 text-center text-[10px] font-mono text-slate-450 font-black hover:bg-slate-200">B</th>
                        <th className="border-r border-slate-200 p-1 text-center text-[10px] font-mono text-slate-450 font-black hover:bg-slate-200">C</th>
                        <th className="border-r border-slate-200 p-1 text-center text-[10px] font-mono text-slate-450 font-black hover:bg-slate-200">D</th>
                        <th className="border-r border-slate-200 p-1 text-center text-[10px] font-mono text-slate-450 font-black hover:bg-slate-200">E</th>
                        <th className="border-r border-slate-200 p-1 text-center text-[10px] font-mono text-slate-450 font-black hover:bg-slate-200">F</th>
                        <th className="border-r border-slate-200 p-1 text-center text-[10px] font-mono text-slate-450 font-black hover:bg-slate-200">G</th>
                        <th className="border-r border-slate-200 p-1 text-center text-[10px] font-mono text-slate-450 font-black hover:bg-slate-200">H</th>
                        <th className="border-r border-slate-200 p-1 text-center text-[10px] font-mono text-slate-450 font-black hover:bg-slate-200">I</th>
                        <th className="border-r border-slate-200 p-1 text-center text-[10px] font-mono text-slate-450 font-black hover:bg-slate-200">J</th>
                        <th className="p-1 text-center text-[10px] font-mono text-slate-450 font-black hover:bg-slate-200">K</th>
                      </tr>

                      {/* Spreadsheet Labels header row */}
                      <tr className="bg-slate-50 border-b border-slate-200 select-none">
                        <th className="bg-slate-100 text-center font-mono text-[9px] text-slate-450 py-2 border-r border-slate-200">#</th>
                        <th className="p-3 border-r border-slate-200 text-left font-black text-slate-600 uppercase text-[9px] tracking-wider select-none">Medicine Name</th>
                        <th className="p-3 border-r border-slate-200 text-center font-black text-slate-600 uppercase text-[9px] tracking-wider select-none">Dosage</th>
                        <th className="p-3 border-r border-slate-200 text-center font-black text-slate-600 uppercase text-[9px] tracking-wider select-none bg-slate-50/80">Times / Day</th>
                        <th className="p-3 border-r border-slate-200 text-center font-black text-slate-600 uppercase text-[9px] tracking-wider select-none bg-slate-50/80">Exact Times</th>
                        <th className="p-3 border-r border-slate-200 text-center font-black text-amber-800 uppercase text-[9px] tracking-wider bg-amber-50/5 select-none font-bold">Morning</th>
                        <th className="p-3 border-r border-slate-200 text-center font-black text-orange-850 uppercase text-[9px] tracking-wider bg-orange-50/5 select-none font-bold">Afternoon</th>
                        <th className="p-3 border-r border-slate-200 text-center font-black text-rose-800 uppercase text-[9px] tracking-wider bg-rose-50/5 select-none font-bold">Evening</th>
                        <th className="p-3 border-r border-slate-200 text-center font-black text-indigo-900 uppercase text-[9px] tracking-wider bg-indigo-50/5 select-none font-bold">Night</th>
                        <th className="p-3 border-r border-slate-200 text-center font-black text-slate-600 uppercase text-[9px] tracking-wider select-none">Meal Guideline</th>
                        <th className="p-3 border-r border-slate-200 text-center font-black text-slate-600 uppercase text-[9px] tracking-wider select-none">Duration</th>
                        <th className="p-3 text-left font-black text-slate-600 uppercase text-[9px] tracking-wider select-none">Additional Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-700 font-semibold bg-white">
                      {scheduleResult.schedule.map((item, idx) => {
                        const rowNum = idx + 1;
                        const tpd = getTimesPerDay(item);
                        const ets = getExactTimes(item).join(', ');
                        return (
                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                            {/* Row selector index cell */}
                            <td className="bg-slate-50 text-center font-mono text-[10px] text-slate-400 font-bold border-r border-slate-200 select-none py-3 h-full">
                              {rowNum}
                            </td>

                            {/* Medicine (Cell A) */}
                            <td 
                              onClick={() => selectCell(`A${rowNum}`, `=UPPER("${item.medicineName}")`, item.medicineName)}
                              className={`p-3 border-r border-slate-200 text-left transition-all cursor-cell select-none ${activeCell.ref === `A${rowNum}` ? 'ring-2 ring-inset ring-[#107c41] bg-emerald-50/20 font-black text-slate-900' : 'font-extrabold text-slate-900 text-sm'}`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#107c41]" />
                                <span>{item.medicineName}</span>
                              </div>
                            </td>

                            {/* Dosage (Cell B) */}
                            <td 
                              onClick={() => selectCell(`B${rowNum}`, `=DOSAGE_UNITS("${item.dosage}")`, item.dosage)}
                              className={`p-3 border-r border-slate-200 text-center transition-all cursor-cell select-none font-extrabold text-slate-800 ${activeCell.ref === `B${rowNum}` ? 'ring-2 ring-inset ring-[#107c41] bg-emerald-50/20' : ''}`}
                            >
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold">
                                {item.dosage}
                              </span>
                            </td>

                            {/* Times/Day (Cell C) */}
                            <td 
                              onClick={() => selectCell(`C${rowNum}`, `=COUNT_ACTIVE_DOSES(E${rowNum}:H${rowNum})`, `${tpd} times`)}
                              className={`p-3 border-r border-slate-200 text-center transition-all cursor-cell select-none font-extrabold text-slate-800 ${activeCell.ref === `C${rowNum}` ? 'ring-2 ring-inset ring-[#107c41] bg-emerald-50/20' : ''}`}
                            >
                              <span className="bg-slate-50 text-slate-800 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-extrabold">
                                {tpd} times/day
                              </span>
                            </td>

                            {/* Exact Times (Cell D) */}
                            <td 
                              onClick={() => selectCell(`D${rowNum}`, `=GET_EXACT_TIMES(E${rowNum}:H${rowNum})`, ets)}
                              className={`p-3 border-r border-slate-200 text-center transition-all cursor-cell select-none font-mono text-[10px] text-slate-600 ${activeCell.ref === `D${rowNum}` ? 'ring-2 ring-inset ring-[#107c41] bg-emerald-50/20' : ''}`}
                            >
                              {ets}
                            </td>

                            {/* Morning (Cell E) */}
                            <td 
                              onClick={() => selectCell(`E${rowNum}`, `=IF(${item.morning ? 'TRUE' : 'FALSE'}, "☀️ Morning Intake", "—")`, item.morning ? 'Morning' : '—')}
                              className={`p-3 border-r border-slate-200 text-center transition-all cursor-cell select-none ${activeCell.ref === `E${rowNum}` ? 'ring-2 ring-inset ring-[#107c41] bg-emerald-50/15' : ''} ${item.morning ? 'bg-amber-50/20' : ''}`}
                            >
                              {item.morning ? (
                                <div className="flex flex-col items-center justify-center gap-0.5 text-amber-600 font-black">
                                  <span className="text-[11px]">✔️</span>
                                  <span className="text-[8px] uppercase tracking-wider text-amber-800 font-bold">Morning</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-normal">—</span>
                              )}
                            </td>

                            {/* Afternoon (Cell F) */}
                            <td 
                              onClick={() => selectCell(`F${rowNum}`, `=IF(${item.afternoon ? 'TRUE' : 'FALSE'}, "🌤️ Afternoon Intake", "—")`, item.afternoon ? 'Afternoon' : '—')}
                              className={`p-3 border-r border-slate-200 text-center transition-all cursor-cell select-none ${activeCell.ref === `F${rowNum}` ? 'ring-2 ring-inset ring-[#107c41] bg-emerald-50/15' : ''} ${item.afternoon ? 'bg-orange-50/20' : ''}`}
                            >
                              {item.afternoon ? (
                                <div className="flex flex-col items-center justify-center gap-0.5 text-orange-600 font-black">
                                  <span className="text-[11px]">✔️</span>
                                  <span className="text-[8px] uppercase tracking-wider text-orange-800 font-bold">Afternoon</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-normal">—</span>
                              )}
                            </td>

                            {/* Evening (Cell G) */}
                            <td 
                              onClick={() => selectCell(`G${rowNum}`, `=IF(${item.evening ? 'TRUE' : 'FALSE'}, "🌆 Evening Intake", "—")`, item.evening ? 'Evening' : '—')}
                              className={`p-3 border-r border-slate-200 text-center transition-all cursor-cell select-none ${activeCell.ref === `G${rowNum}` ? 'ring-2 ring-inset ring-[#107c41] bg-emerald-50/15' : ''} ${item.evening ? 'bg-rose-50/20' : ''}`}
                            >
                              {item.evening ? (
                                <div className="flex flex-col items-center justify-center gap-0.5 text-rose-600 font-black">
                                  <span className="text-[11px]">✔️</span>
                                  <span className="text-[8px] uppercase tracking-wider text-rose-800 font-bold">Evening</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-normal">—</span>
                              )}
                            </td>

                            {/* Night (Cell H) */}
                            <td 
                              onClick={() => selectCell(`H${rowNum}`, `=IF(${item.night ? 'TRUE' : 'FALSE'}, "🌙 Night Intake", "—")`, item.night ? 'Night' : '—')}
                              className={`p-3 border-r border-slate-200 text-center transition-all cursor-cell select-none ${activeCell.ref === `H${rowNum}` ? 'ring-2 ring-inset ring-[#107c41] bg-emerald-50/15' : ''} ${item.night ? 'bg-indigo-50/30' : ''}`}
                            >
                              {item.night ? (
                                <div className="flex flex-col items-center justify-center gap-0.5 text-indigo-900 font-black">
                                  <span className="text-[11px]">✔️</span>
                                  <span className="text-[8px] uppercase tracking-wider text-indigo-950 font-bold">Bedtime</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-normal">—</span>
                              )}
                            </td>

                            {/* Meal Guideline (Cell I) */}
                            <td 
                              onClick={() => selectCell(`I${rowNum}`, `=IF(${item.beforeMeal ? 'TRUE' : 'FALSE'}, "🍽️ BEFORE MEAL", "🍛 AFTER MEAL")`, item.beforeMeal ? 'Before Meal' : 'After Meal')}
                              className={`p-3 border-r border-slate-200 text-center transition-all cursor-cell select-none ${activeCell.ref === `I${rowNum}` ? 'ring-2 ring-inset ring-[#107c41] bg-emerald-50/20' : ''}`}
                            >
                              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-md text-[10px] font-bold text-slate-800 shadow-sm relative pr-6 select-none cursor-pointer">
                                <span className={`w-1.5 h-1.5 rounded-full ${item.beforeMeal ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                                {item.beforeMeal ? 'Before Food' : 'After Food'}
                                <span className="absolute right-1 text-[8px] text-slate-400 border-l border-slate-100 pl-1">▼</span>
                              </div>
                            </td>

                            {/* Duration (Cell J) */}
                            <td 
                              onClick={() => selectCell(`J${rowNum}`, `=DURATION_DAYS("${item.duration}")`, item.duration)}
                              className={`p-3 border-r border-slate-200 text-center font-mono font-black text-slate-800 select-none cursor-cell transition-all ${activeCell.ref === `J${rowNum}` ? 'ring-2 ring-inset ring-[#107c41] bg-emerald-50/20' : ''}`}
                            >
                              {item.duration}
                            </td>

                            {/* Instructions (Cell K) */}
                            <td 
                              onClick={() => selectCell(`K${rowNum}`, `=PRO_ADVICE("${item.additionalInstructions || 'None'}")`, item.additionalInstructions || 'No instructions')}
                              className={`p-3 text-left transition-all overflow-hidden whitespace-normal cursor-cell select-none ${activeCell.ref === `K${rowNum}` ? 'ring-2 ring-inset ring-[#107c41] bg-emerald-50/20 font-medium' : ''}`}
                            >
                              {item.additionalInstructions ? (
                                <div className="p-1 px-1.5 bg-amber-50/50 border border-amber-100 rounded text-[10px] font-semibold text-amber-800 leading-normal">
                                  {item.additionalInstructions}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-normal italic">None</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* INTERACTIVE DAILY ROUTINE TIMELINE VIEW */
              <div className="space-y-4">
                {[
                  { title: 'Morning Intake', time: '6:00 AM - 9:00 AM', filter: (m: ScheduleItem) => m.morning, color: 'border-amber-200 bg-amber-50/10 hover:border-amber-300', tagColor: 'bg-amber-100 text-amber-800', bulletColor: 'bg-amber-500', icon: '☀️' },
                  { title: 'Afternoon Intake', time: '12:00 PM - 2:00 PM', filter: (m: ScheduleItem) => m.afternoon, color: 'border-orange-200 bg-orange-50/10 hover:border-orange-300', tagColor: 'bg-orange-100 text-orange-800', bulletColor: 'bg-orange-500', icon: '☀️' },
                  { title: 'Evening Intake', time: '5:00 PM - 7:00 PM', filter: (m: ScheduleItem) => m.evening, color: 'border-rose-200 bg-rose-50/10 hover:border-rose-300', tagColor: 'bg-rose-100 text-rose-800', bulletColor: 'bg-rose-500', icon: '🌆' },
                  { title: 'Bedtime Intake', time: '9:00 PM - 10:30 PM', filter: (m: ScheduleItem) => m.night, color: 'border-indigo-200 bg-indigo-50/10 hover:border-indigo-300', tagColor: 'bg-indigo-950 text-indigo-100', bulletColor: 'bg-indigo-700', icon: '🌙' }
                ].map((slot, sIdx) => {
                  const medicinesForSlot = scheduleResult.schedule.filter(slot.filter);
                  return (
                    <div key={sIdx} className={`p-4 border rounded-2xl flex flex-col gap-3 transition-colors ${slot.color}`}>
                      <div className="flex items-center justify-between border-b border-slate-100/70 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{slot.icon}</span>
                          <span className="text-xs font-black uppercase text-slate-800 tracking-wider font-semibold">{slot.title}</span>
                        </div>
                        <span className={`text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full ${slot.tagColor}`}>
                          {slot.time}
                        </span>
                      </div>

                      {medicinesForSlot.length === 0 ? (
                        <p className="text-[10px] text-slate-400 font-medium italic pl-1 py-1">No medication structured for this routine slot.</p>
                      ) : (
                        <div className="space-y-2 pl-1">
                          {medicinesForSlot.map((med, mIdx) => (
                            <div key={mIdx} className="flex items-start justify-between bg-white/60 p-2.5 rounded-xl border border-slate-100 hover:border-slate-150 transition-colors">
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-slate-200 text-brand-600 focus:ring-brand-500/30 mt-0.5 cursor-pointer accent-[#2563eb]"
                                />
                                <div className="space-y-0.5">
                                  <p className="font-extrabold text-xs text-slate-900 leading-tight">{med.medicineName}</p>
                                  <div className="flex items-center gap-2 font-black text-[9px] text-slate-400">
                                    <span>Dosage: {med.dosage}</span>
                                    <span>•</span>
                                    <span>For: {med.duration}</span>
                                  </div>
                                  {med.additionalInstructions && (
                                    <p className="text-[9px] font-semibold text-amber-800 bg-amber-50/50 p-1 rounded border border-amber-100 mt-1 leading-normal max-w-sm">
                                      💡 {med.additionalInstructions}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className={`text-[8px] font-black px-2 py-0.5 border rounded uppercase ${med.beforeMeal ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-800 border-emerald-100'}`}>
                                {med.beforeMeal ? 'Before Meal' : 'After Meal'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary disclaimer panel */}
            {scheduleResult.summary && (
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex gap-3 text-xs text-slate-700 font-semibold leading-relaxed">
                <BookOpen className="w-4.5 h-4.5 shrink-0 text-brand-600 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-black uppercase tracking-wider text-[9px] text-brand-700 block">Clinical Therapy Intake Advisor</span>
                  <p className="text-slate-600 font-medium">{scheduleResult.summary}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Past Saved Schedules list */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-1.5 pl-1">
          <Calendar className="w-4.5 h-4.5 text-slate-400" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Medication Calendars Log ({savedSchedules.length})
          </span>
        </div>

        {isLoadingSchedules ? (
          <div className="py-8 text-center bg-white border border-slate-100 rounded-3xl">
            <Loader2 className="w-8 h-8 text-slate-300 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 mt-2">Syncing schedules log...</p>
          </div>
        ) : savedSchedules.length === 0 ? (
          <div className="bg-white border border-slate-150 rounded-[2.5rem] p-6 text-center space-y-2 premium-shadow">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-bold">No saved medication schedules found.</p>
            <p className="text-[10px] text-slate-400">Add medicines and hit generate to sync charts on Cloud.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedSchedules.map((record) => {
              const isSelected = selectedScheduleId === record.id;
              
              return (
                <div
                  key={record.id}
                  onClick={() => setSelectedScheduleId(isSelected ? null : record.id)}
                  className="bg-white border border-slate-200 rounded-3xl p-4.5 cursor-pointer hover:border-brand-200 transition-all premium-shadow space-y-3 text-slate-850"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 truncate flex-1">
                      <span className="text-[8px] font-black text-brand-600 bg-brand-50 border border-brand-100 px-1.5 py-0.5 rounded uppercase tracking-wider block w-fit mb-1">
                        Intake Chart
                      </span>
                      <h4 className="text-xs font-black text-slate-900 truncate">
                        👤 {record.patientName || 'Unnamed Patient'} {record.patientAge ? `(${record.patientAge})` : ''}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                        Attending Doctor: {record.doctorName || 'Dr. Not Listed'} | {record.schedule?.length || 0} Medicines Prescribed
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrint(record);
                        }}
                        className="p-1.5 text-slate-300 hover:text-[#107c41] hover:bg-emerald-50 rounded-lg transition-colors shrink-0"
                        title="Print Intake Chart"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPDF(record);
                        }}
                        className="p-1.5 text-slate-300 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors shrink-0"
                        title="Download PDF Report"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteSchedule(record.id, e)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail schedule layout inside card */}
                  <AnimatePresence initial={false}>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-t border-slate-100 pt-3 flex flex-col gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Table preview redesigned as structured Excel Grid */}
                        <div className="border border-[#107c41]/20 rounded-2xl overflow-hidden text-[10px] shadow-sm bg-white">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                 {/* Grid column coords indicator */}
                                <tr className="bg-slate-50 border-b border-slate-200 select-none text-[8px] font-mono text-slate-400">
                                  <th className="p-1 px-1.5 w-8 bg-slate-100 border-r border-slate-200 text-center border-b border-slate-150">#</th>
                                  <th className="p-1 border-r border-slate-200 text-center w-1/4 border-b border-slate-150">A</th>
                                  <th className="p-1 border-r border-slate-200 text-center border-b border-slate-150">B</th>
                                  <th className="p-1 border-r border-slate-200 text-center border-b border-slate-150">C</th>
                                  <th className="p-1 border-r border-slate-200 text-center border-b border-slate-150">D</th>
                                  <th className="p-1 border-r border-slate-200 text-center border-b border-slate-150">E</th>
                                  <th className="p-1 border-r border-slate-200 text-center border-b border-slate-150">F</th>
                                  <th className="p-1 border-r border-slate-200 text-center border-b border-slate-150">G</th>
                                  <th className="p-1 border-r border-slate-200 text-center border-b border-slate-150">H</th>
                                  <th className="p-1 border-r border-slate-200 text-center border-b border-slate-150">I</th>
                                  <th className="p-1 text-center w-20 border-b border-slate-150">J</th>
                                </tr>
                                <tr className="bg-slate-100/50 text-[8px] font-black text-slate-500 uppercase border-b border-slate-200">
                                  <th className="bg-slate-100 text-center font-mono py-2 border-r border-slate-200">#</th>
                                  <th className="p-2 border-r border-slate-200 font-extrabold text-left">Medicine Name</th>
                                  <th className="p-2 border-r border-slate-200 font-extrabold text-center">Dosage</th>
                                  <th className="p-2 border-r border-slate-200 font-extrabold text-center">Times/Day</th>
                                  <th className="p-2 border-r border-slate-200 font-extrabold text-center">Exact Times</th>
                                  <th className="p-2 border-r border-slate-200 font-extrabold text-center">AM</th>
                                  <th className="p-2 border-r border-slate-200 font-extrabold text-center">PM</th>
                                  <th className="p-2 border-r border-slate-200 font-extrabold text-center">EV</th>
                                  <th className="p-2 border-r border-slate-200 font-extrabold text-center font-semibold text-indigo-900">NT</th>
                                  <th className="p-2 border-r border-slate-200 font-extrabold text-center">Meal Guideline</th>
                                  <th className="p-2 font-extrabold text-center">Duration</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-600 font-semibold bg-white animate-fade-in">
                                {record.schedule?.map((item, i) => {
                                  const rNum = i + 1;
                                  const tpd = getTimesPerDay(item);
                                  const ets = getExactTimes(item).join(', ');
                                  return (
                                    <tr key={i} className="hover:bg-slate-50/20">
                                      <td className="bg-slate-50/80 text-center font-mono text-[9px] text-slate-400 font-bold border-r border-slate-200 select-none py-2.5">
                                        {rNum}
                                      </td>
                                      <td className="p-2.5 border-r border-slate-200">
                                        <span className="font-extrabold text-slate-900 block leading-tight text-xs">{item.medicineName}</span>
                                        {item.additionalInstructions && (
                                          <p className="text-[9px] font-medium text-amber-800 bg-amber-50/20 border border-amber-100/50 p-1 rounded leading-normal mt-1 max-w-xs truncate" title={item.additionalInstructions}>
                                            💡 {item.additionalInstructions}
                                          </p>
                                        )}
                                      </td>
                                      <td className="p-2.5 border-r border-slate-200 text-center">
                                        <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[8px] font-black border border-slate-200">{item.dosage}</span>
                                      </td>
                                      <td className="p-2.5 border-r border-slate-200 text-center font-bold text-slate-800">{tpd}x</td>
                                      <td className="p-2.5 border-r border-slate-200 text-center text-[9px] text-slate-500 font-mono">{ets}</td>
                                      <td className="p-2.5 border-r border-slate-200 text-center text-amber-700">{item.morning ? '✔️' : '—'}</td>
                                      <td className="p-2.5 border-r border-slate-200 text-center text-orange-700">{item.afternoon ? '✔️' : '—'}</td>
                                      <td className="p-2.5 border-r border-slate-200 text-center text-rose-700">{item.evening ? '✔️' : '—'}</td>
                                      <td className="p-2.5 border-r border-slate-200 text-center text-indigo-950 font-black">{item.night ? '✔️' : '—'}</td>
                                      <td className="p-2.5 border-r border-slate-200 text-center">
                                        <span className={`px-1.5 py-0.5 text-[8px] rounded uppercase font-black border ${item.beforeMeal ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                          {item.beforeMeal ? 'Before' : 'After'}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-center font-bold text-slate-900">{item.duration}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {record.summary && (
                          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-[10px] text-slate-500 leading-relaxed">
                            <span className="font-extrabold text-slate-800 uppercase text-[8px] block mb-0.5">Clinical Recap Advice</span>
                            {record.summary}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>



    </motion.div>
  );
}
