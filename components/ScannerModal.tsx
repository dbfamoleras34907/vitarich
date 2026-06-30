'use client';
import { Scanner } from '@yudiel/react-qr-scanner';
import React, { useRef } from 'react';

interface Props {
  onResult: (text: string) => void;
  onClose: () => void;
}

export default function ScannerModal({ onResult, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to handle image upload and decoding
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Create a Bitmap from the uploaded file
      const imageBitmap = await createImageBitmap(file);
      
      // Use the browser's native BarcodeDetector (Supported in most 2026 browsers)
      // @ts-ignore - BarcodeDetector is a global browser API
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const results = await detector.detect(imageBitmap);

      if (results.length > 0) {
        onResult(results[0].rawValue);
      } else {
        alert("No QR code found in this image.");
      }
    } catch (err) {
      console.error("Manual scan failed:", err);
      alert("Error reading image file.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      
      {/* UI Controls Overlay */}
      <div className="absolute top-10 w-full px-5 flex justify-between items-center z-60">
        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileUpload}
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-blue-600 px-5 py-2 font-bold text-white shadow-md"
        >
          Upload QR
        </button>

        <button 
          onClick={onClose}
          className="rounded-md bg-white px-5 py-2 font-bold text-black shadow-md"
        >
          Close
        </button>
      </div>

      {/* The Live Scanner */}
      <div className="w-full h-full">
        <Scanner
          onScan={(detectedCodes) => {
            if (detectedCodes.length > 0) {
              onResult(detectedCodes[0].rawValue);
            }
          }}
          styles={{
            container: { width: '100%', height: '100%' }
          }}
          components={{ 
            finder: true,
            torch: true // Added flashlight for better mobile use
          }}
          constraints={{ facingMode: 'environment' }}
        />
      </div>

      <div className="absolute bottom-10 text-white text-sm opacity-70">
        Point at a QR code or upload an image
      </div>
    </div>
  );
}
