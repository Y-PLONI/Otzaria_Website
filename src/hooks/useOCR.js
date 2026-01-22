import { useState } from 'react'

export function useOCR() {
  const [isProcessing, setIsProcessing] = useState(false)

  const performGeminiOCR = async (croppedBlob, apiKey, model, prompt) => {
    const reader = new FileReader()
    const base64Promise = new Promise((resolve) => {
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.readAsDataURL(croppedBlob)
    })

    const imageBase64 = await base64Promise

    const response = await fetch('/api/gemini-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        model,
        userApiKey: apiKey || undefined,
        customPrompt: prompt || undefined
      })
    })

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Gemini OCR failed')
    }
    return result.text
  }

  const performTesseractOCR = async (croppedBlob, onProgress) => {
    const Tesseract = (await import('tesseract.js')).default
    const result = await Tesseract.recognize(
      croppedBlob,
      'heb',
      {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(Math.round(m.progress * 100))
          }
        }
      }
    )
    return result.data.text.trim()
  }
  // בתוך ה-Hook useOCR
  const performOCRWin = async (croppedBlob) => {
    // 1. יוצרים טופס וירטואלי
    const formData = new FormData();
    // 2. שמים בפנים את חתיכת התמונה שגזרנו
    formData.append('file', croppedBlob);

    // 3. שולחים את הטופס ל-API שלנו
    const response = await fetch('/api/ocrwin', {
      method: 'POST',
      // שים לב: לא שמים Headers של Content-Type, ה-fetch יודע לזהות לבד שזה FormData
      body: formData
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'OCRWIN failed');
    }
    return result.text;
  };

  return {
    isProcessing,
    setIsProcessing,
    performGeminiOCR,
    performTesseractOCR,
    performOCRWin // ייצוא הפונקציה החדשה
  }
}