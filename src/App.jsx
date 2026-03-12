import { useState, useCallback } from 'react';
import { Upload, FileText, Download, FileDown, Trash2, FileOutput } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import JSZip from 'jszip';
import './App.css';

function App() {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // Handle file selection
  const handleFiles = async (selectedFiles) => {
    const newFiles = Array.from(selectedFiles).map((file) => ({
      original: file,
      name: file.name,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending', // pending, converting, done, error
      content: null,
      utf8Content: null,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    processFiles(newFiles);
  };

  // Process files: Read and detect encoding -> Convert to UTF-8
  const processFiles = async (fileList) => {
    for (const fileObj of fileList) {
      try {
        updateFileStatus(fileObj.id, 'converting');
        const buffer = await fileObj.original.arrayBuffer();
        let decodedText = '';

        // Try decoding as UTF-8 first (it throws if it's invalid UTF-8 and fatal is true)
        try {
          const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
          decodedText = utf8Decoder.decode(buffer);
        } catch (e) {
          // If it fails, it's likely Big5 so we decode it using Big5
          const big5Decoder = new TextDecoder('big5');
          decodedText = big5Decoder.decode(buffer);
        }

        // Fix: Replace charset meta tags in the HTML to specific UTF-8
        // Covers: <meta charset="big5"> and <meta http-equiv="Content-Type" content="... charset=big5">
        decodedText = decodedText.replace(/charset\s*=\s*['"]?big5['"]?/gi, 'charset=utf-8');

        updateFileState(fileObj.id, {
          status: 'done',
          utf8Content: decodedText
        });
      } catch (error) {
        console.error("Conversion error:", error);
        updateFileStatus(fileObj.id, 'error');
      }
    }
  };

  const updateFileStatus = (id, status) => {
    setFiles((prev) => prev.map(f => f.id === id ? { ...f, status } : f));
  };

  const updateFileState = (id, updates) => {
    setFiles((prev) => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  // Drag and Drop handlers
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Download single UTF-8 and Big5 files separately
  const downloadFile = (fileObj) => {
    if (!fileObj.utf8Content) return;

    // 1. Download UTF-8 converted file (original name)
    const utf8Blob = new Blob([fileObj.utf8Content], { type: 'text/html;charset=utf-8' });
    const utf8Url = URL.createObjectURL(utf8Blob);
    const a1 = document.createElement('a');
    a1.href = utf8Url;
    a1.download = fileObj.name;
    document.body.appendChild(a1);
    a1.click();
    document.body.removeChild(a1);
    URL.revokeObjectURL(utf8Url);

    // 2. Download Original Big5 file (big5- prefix)
    const big5Url = URL.createObjectURL(fileObj.original);
    const a2 = document.createElement('a');
    a2.href = big5Url;
    a2.download = `big5-${fileObj.name}`;
    document.body.appendChild(a2);
    a2.click();
    document.body.removeChild(a2);
    URL.revokeObjectURL(big5Url);
  };

  // Download PDF
  const downloadPDF = (fileObj) => {
    if (!fileObj.utf8Content) return;

    // Create a temporary container to render HTML for PDF
    const element = document.createElement('div');
    // Inject CSS to ensure table borders are visible in PDF
    const style = `
      <style>
        body, div, table, th, td, p, span { color: #000000 !important; }
        table { border-collapse: collapse; width: 100%; }
        table, th, td { border: 1px solid black; }
        th, td { padding: 4px; }
      </style>

    `;
    element.innerHTML = style + fileObj.utf8Content;

    // Apply some basic styles to ensure it looks okay in PDF
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.fontSize = '12pt';
    element.style.lineHeight = '1.5';

    const opt = {
      margin: 10,
      filename: `${fileObj.name.substring(0, fileObj.name.lastIndexOf('.')) || fileObj.name}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  // Download All as Zip
  const downloadAllZip = async () => {
    const zip = new JSZip();

    const zipPromises = files.map(async (f) => {
      if (f.status === 'done' && f.utf8Content) {
        // Add UTF-8 HTML
        zip.file(f.name, f.utf8Content);

        // Generate PDF
        const element = document.createElement('div');
        const style = `
          <style>
            body, div, table, th, td, p, span { color: #000000 !important; }
            table { border-collapse: collapse; width: 100%; }
            table, th, td { border: 1px solid black; }
            th, td { padding: 4px; }
          </style>
        `;
        element.innerHTML = style + f.utf8Content;
        // Apply some basic styles to ensure it looks okay in PDF
        element.style.fontFamily = 'Arial, sans-serif';
        element.style.fontSize = '12pt';
        element.style.lineHeight = '1.5';

        const opt = {
          margin: 10,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
        const pdfFilename = `${f.name.substring(0, f.name.lastIndexOf('.')) || f.name}.pdf`;
        zip.file(pdfFilename, pdfBlob);
      }
    });

    await Promise.all(zipPromises);

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = "converted_files.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const completedCount = files.filter(f => f.status === 'done').length;

  return (
    <div className="container">
      <h1 className="header-title">Big5 to UTF-8 Converter</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Drag & drop Big5 encoded HTML files to convert them to UTF-8 and PDF.
      </p>

      <div
        className={`glass-panel dropzone ${isDragging ? 'active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => document.getElementById('fileInput').click()}
      >
        <Upload size={48} color={isDragging ? 'var(--accent-color)' : 'var(--text-secondary)'} />
        <div>
          <span style={{ fontWeight: 600, fontSize: '1.2rem' }}>Click to upload</span> or drag and drop
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>HTML files (Big5 encoded)</div>
        <input
          type="file"
          id="fileInput"
          multiple
          accept=".html,.htm"
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
      </div>

      {files.length > 0 && (
        <div className="glass-panel" style={{ marginTop: '2rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Files ({files.length})</h2>
            {completedCount > 0 && (
              <button className="primary-btn" onClick={downloadAllZip} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Download size={18} /> Download All (ZIP)
              </button>
            )}
          </div>

          <div className="file-list">
            {files.map((file) => (
              <div key={file.id} className="file-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
                  <FileText size={24} color="var(--accent-color)" />
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                    {file.name}
                  </div>
                  {file.status === 'converting' && <span className="status-badge">Converting...</span>}
                  {file.status === 'done' && <span className="status-badge status-success">Ready</span>}
                  {file.status === 'error' && <span className="status-badge" style={{ background: 'rgba(248, 81, 73, 0.3)', color: '#ff7b72' }}>Error</span>}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {file.status === 'done' && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); downloadFile(file); }} title="Download HTML">
                        <FileDown size={18} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); downloadPDF(file); }} title="Export PDF">
                        <FileOutput size={18} />
                      </button>
                    </>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); removeFile(file.id); }} style={{ color: 'var(--danger-color)', borderColor: 'rgba(248, 81, 73, 0.3)' }} title="Remove">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
