'use client'

import { useState, useEffect } from 'react'

export default function OcrSettingsPage() {
  const [examples, setExamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
      name: '',
      scriptType: 'rashi',
      layoutType: 'single_column',
      expectedOutput: '{\n  "page_number": 1,\n  "content": "טקסט לדוגמה..."\n}'
  })
  const [file, setFile] = useState(null)

  useEffect(() => {
      fetchExamples()
  }, [])

  const fetchExamples = async () => {
      try {
        const res = await fetch('/api/admin/ocr-examples')
        const data = await res.json()
        if (data.success) setExamples(data.examples)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
  }

  const handleSubmit = async (e) => {
      e.preventDefault()
      if (!file) return alert('בחר תמונה')

      const body = new FormData()
      body.append('image', file)
      Object.keys(formData).forEach(key => body.append(key, formData[key]))

      try {
          const res = await fetch('/api/admin/ocr-examples', {
              method: 'POST',
              body
          })
          if (res.ok) {
              alert('נוסף בהצלחה')
              fetchExamples()
              setFormData({...formData, name: ''})
              setFile(null)
              // איפוס שדה הקובץ בדפדפן
              document.getElementById('fileInput').value = ''
          } else {
              alert('שגיאה בהוספה')
          }
      } catch (err) {
          console.error(err)
          alert('שגיאת תקשורת')
      }
  }

  return (
    <div className="glass-strong p-6 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8">
            <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">smart_toy</span>
                ניהול דוגמאות OCR (Few-Shot Learning)
            </h2>
            <p className="text-on-surface/60 mt-2">
                כאן ניתן להעלות דוגמאות של דפים והפלט המצופה מהם, כדי ללמד את מודל ה-AI כיצד לפענח כתבים ופריסות מיוחדות.
            </p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8">
            {/* טופס הוספה */}
            <div className="bg-surface/50 border border-surface-variant p-6 rounded-xl">
                <h3 className="text-xl font-bold mb-4 text-on-surface">הוספת דוגמה חדשה</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1">שם מזהה</label>
                        <input 
                            type="text" 
                            className="w-full border border-surface-variant p-2 rounded-lg focus:outline-none focus:border-primary"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            required
                            placeholder="למשל: רש''י דפוס וילנא"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1">סוג כתב</label>
                            <input 
                                type="text" 
                                list="scriptTypes"
                                className="w-full border border-surface-variant p-2 rounded-lg focus:outline-none focus:border-primary"
                                value={formData.scriptType}
                                onChange={e => setFormData({...formData, scriptType: e.target.value})}
                                placeholder="rashi, square..."
                            />
                            <datalist id="scriptTypes">
                                <option value="rashi" />
                                <option value="square" />
                                <option value="handwriting" />
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">פריסה (Layout)</label>
                            <select 
                                className="w-full border border-surface-variant p-2 rounded-lg focus:outline-none focus:border-primary bg-white"
                                value={formData.layoutType}
                                onChange={e => setFormData({...formData, layoutType: e.target.value})}
                            >
                                <option value="single_column">טור אחד</option>
                                <option value="double_column">שני טורים (פשוט)</option>
                                <option value="complex_columns">מבנה מורכב (אובייקטים)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">תמונה לדוגמה</label>
                        <input 
                            id="fileInput"
                            type="file" 
                            accept="image/*"
                            onChange={e => setFile(e.target.files[0])}
                            className="w-full text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">פלט JSON צפוי</label>
                        <textarea 
                            className="w-full border border-surface-variant p-2 rounded-lg font-mono text-xs focus:outline-none focus:border-primary h-48"
                            value={formData.expectedOutput}
                            onChange={e => setFormData({...formData, expectedOutput: e.target.value})}
                            required
                            dir="ltr"
                        />
                        <p className="text-xs text-gray-500 mt-1">יש להזין JSON תקין התואם לסכמה של הפריסה שנבחרה.</p>
                    </div>
                    <button type="submit" className="w-full bg-primary text-on-primary py-2.5 rounded-lg hover:bg-accent transition-colors font-bold shadow-md">
                        שמור דוגמה
                    </button>
                </form>
            </div>

            {/* רשימת דוגמאות */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-on-surface">דוגמאות קיימות ({examples.length})</h3>
                <div className="space-y-4 max-h-[800px] overflow-y-auto custom-scrollbar pr-2">
                    {loading ? (
                        <div className="text-center py-10">טוען...</div>
                    ) : examples.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">אין דוגמאות עדיין</div>
                    ) : (
                        examples.map(ex => (
                            <div key={ex._id} className="bg-white border border-surface-variant p-4 rounded-xl shadow-sm flex gap-4 hover:border-primary/50 transition-colors">
                                <div className="w-24 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                                    <img src={ex.imagePath} alt={ex.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-lg text-primary">{ex.name}</h4>
                                    <div className="flex gap-2 mt-1 mb-2">
                                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{ex.scriptType}</span>
                                        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">{ex.layoutType}</span>
                                    </div>
                                    <details className="mt-2 group">
                                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-primary list-none flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm transition-transform group-open:rotate-90">chevron_right</span>
                                            הצג JSON
                                        </summary>
                                        <pre className="text-[10px] bg-gray-50 p-2 rounded mt-1 overflow-x-auto max-h-32 border border-gray-200 text-gray-700" dir="ltr">
                                            {JSON.stringify(ex.expectedOutput, null, 2)}
                                        </pre>
                                    </details>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    </div>
  )
}