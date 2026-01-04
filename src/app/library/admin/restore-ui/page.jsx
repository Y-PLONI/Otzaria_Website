'use client'

import { useState } from 'react'

export default function RestoreUIPage() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setStatus('מעלה...')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/admin/upload-backup', {
        method: 'POST',
        body: formData
      })
      
      const data = await res.json()
      if (data.success) {
        setStatus(`✅ הקובץ הועלה בהצלחה ל: ${data.path}`)
      } else {
        setStatus('❌ שגיאה: ' + data.error)
      }
    } catch (err) {
      setStatus('❌ שגיאה בתקשורת')
    }
  }

  return (
    <div className="p-10 max-w-md mx-auto bg-white rounded-xl shadow-lg mt-10 text-center">
      <h1 className="text-2xl font-bold mb-4">העלאת קובץ גיבוי לשרת</h1>
      <form onSubmit={handleUpload} className="space-y-4">
        <input 
          type="file" 
          onChange={(e) => setFile(e.target.files[0])}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button 
          type="submit" 
          disabled={!file}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          העלה קובץ
        </button>
      </form>
      {status && <div className="mt-4 font-bold text-gray-700">{status}</div>}
    </div>
  )
}