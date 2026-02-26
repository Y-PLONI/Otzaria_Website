'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'

export default function AddPageNumberModal({ isOpen, onClose, content, onContentChange }) {
  const [replaceWith, setReplaceWith] = useState('נקודה ונקודותיים')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const handleSubmit = () => {
    setResult('')
    setLoading(true)
    
    try {
      let newContent = content
      let count = 0
      
      // חיפוש דפוס של כותרת "דף X" ואחריה שורה עם "עמוד א/ב"
      const lines = newContent.split('\n')
      const processedLines = []
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const nextLine = i < lines.length - 1 ? lines[i + 1] : ''
        
        // בדיקה אם זו כותרת דף
        const pageMatch = line.match(/<h(\d+)>דף\s+([א-ת]+|\d+)<\/h\1>/)
        
        if (pageMatch && nextLine) {
          // בדיקה אם השורה הבאה היא "עמוד א" או "עמוד ב"
          const columnMatch = nextLine.match(/^\s*עמוד\s+([אב])\s*$/)
          
          if (columnMatch) {
            const column = columnMatch[1]
            let suffix = ''
            
            if (replaceWith === 'נקודה ונקודותיים') {
              suffix = column === 'א' ? '.' : ':'
            } else {
              suffix = column === 'א' ? ' ע"א' : ' ע"ב'
            }
            
            // החלפת הכותרת
            const newHeader = line.replace(/<\/h(\d+)>$/, `${suffix}</h$1>`)
            processedLines.push(newHeader)
            i++ // דילוג על השורה הבאה
            count++
            continue
          }
        }
        
        processedLines.push(line)
      }
      
      if (count > 0) {
        newContent = processedLines.join('\n')
        setResult(`בוצעו ${count} מיזוגים בהצלחה!`)
        onContentChange(newContent)
        setTimeout(() => {
          onClose()
          setResult('')
        }, 1500)
      } else {
        setResult('לא נמצאו דפוסים תואמים למיזוג')
      }
    } catch (error) {
      setResult('שגיאה בביצוע הפעולה')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setResult('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="מיזוג מספרי דפים"
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
          <p>כלי זה מחפש כותרות "דף X" ואחריהן שורה עם "עמוד א/ב", וממזג אותם לכותרת אחת.</p>
          <p className="mt-2 font-bold">דוגמה:</p>
          <p className="opacity-70">&lt;h2&gt;דף כ&lt;/h2&gt;</p>
          <p className="opacity-70">עמוד א</p>
          <p className="mt-1 font-bold">יהפוך ל:</p>
          <p className="opacity-70">&lt;h2&gt;דף כ.&lt;/h2&gt;</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">פורמט המיזוג</label>
          <select
            value={replaceWith}
            onChange={(e) => setReplaceWith(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="נקודה ונקודותיים">נקודה (.) לעמוד א' / נקודותיים (:) לעמוד ב'</option>
            <option value='ע"א וע"ב'>הוספת הסיומת ע"א / ע"ב</option>
          </select>
        </div>

        {result && (
          <div className={`p-3 rounded ${result.includes('שגיאה') || result.includes('אין') ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-700'}`}>
            {result}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'מעבד...' : 'הפעל'}
          </button>
          <button
            onClick={handleClose}
            className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </Modal>
  )
}