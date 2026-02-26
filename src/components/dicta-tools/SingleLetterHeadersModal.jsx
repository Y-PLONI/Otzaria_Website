'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import FormInput from '@/components/FormInput'

export default function SingleLetterHeadersModal({ isOpen, onClose, content, onContentChange }) {
  const [startChar, setStartChar] = useState('')
  const [endChar, setEndChar] = useState('')
  const [level, setLevel] = useState(3)
  const [maxNum, setMaxNum] = useState(999)
  const [ignoreTags, setIgnoreTags] = useState('<big> </big> <i> </i> <small> </small> <span> </span> <br> </br> <p> </p>')
  const [removeTags, setRemoveTags] = useState(', : " \' . ( ) [ ] { }')
  const [boldOnly, setBoldOnly] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const handleSubmit = () => {
    setResult('')
    setLoading(true)
    
    try {
      const ignoreArray = ignoreTags.split(' ').filter(Boolean)
      const removeArray = removeTags.split(' ').filter(Boolean)
      
      let newContent = content
      let count = 0
      
      // יצירת regex לחיפוש שורות שמתחילות באות בודדת
      const lines = newContent.split('\n')
      const processedLines = lines.map(line => {
        // בדיקה אם השורה מתחילה באות בודדת
        let testLine = line
        
        // הסרת תגים להתעלמות
        ignoreArray.forEach(tag => {
          testLine = testLine.replace(new RegExp(tag, 'g'), '')
        })
        
        // הסרת תווים להסרה
        removeArray.forEach(char => {
          testLine = testLine.replace(new RegExp(`\\${char}`, 'g'), '')
        })
        
        // בדיקה אם מדובר בשורה מודגשת (אם נדרש)
        const isBold = line.includes('<b>') || !boldOnly
        
        // בדיקה אם השורה מתחילה באות בודדת
        const match = testLine.trim().match(/^([א-ת])/)
        
        if (match && isBold && startChar && match[1] >= startChar) {
          if (!endChar || line.includes(endChar)) {
            count++
            return `<h${level}>${line}</h${level}>`
          }
        }
        
        return line
      })
      
      if (count > 0 && count <= maxNum) {
        newContent = processedLines.join('\n')
        setResult(`נוצרו ${count} כותרות בהצלחה!`)
        onContentChange(newContent)
        setTimeout(() => {
          onClose()
          setResult('')
        }, 1500)
      } else if (count > maxNum) {
        setResult(`נמצאו ${count} כותרות, אך המקסימום הוא ${maxNum}`)
      } else {
        setResult('לא נמצאו תוצאות תואמות')
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
      title="כותרות אותיות"
      size="lg"
    >
      <div className="space-y-4">
        <div className="bg-red-50 p-4 rounded-lg text-sm text-red-700 font-bold">
          ⚠️ מומלץ מאוד ליצור גיבוי של הספר לפני הפעלת כלי זה!
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="תו התחלה"
            value={startChar}
            onChange={(e) => setStartChar(e.target.value)}
            placeholder='למשל: "א"'
          />
          
          <FormInput
            label="תו סוף"
            value={endChar}
            onChange={(e) => setEndChar(e.target.value)}
            placeholder='למשל: "."'
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="רמת כותרת"
            type="number"
            value={level}
            onChange={(e) => setLevel(parseInt(e.target.value) || 3)}
          />
          
          <FormInput
            label="מקסימום"
            type="number"
            value={maxNum}
            onChange={(e) => setMaxNum(parseInt(e.target.value) || 999)}
          />
        </div>

        <FormInput
          label="התעלם מ:"
          value={ignoreTags}
          onChange={(e) => setIgnoreTags(e.target.value)}
        />

        <FormInput
          label="הסר:"
          value={removeTags}
          onChange={(e) => setRemoveTags(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={boldOnly}
            onChange={(e) => setBoldOnly(e.target.checked)}
            className="w-4 h-4"
          />
          <span>לחפש מודגש בלבד</span>
        </label>

        {result && (
          <div className={`p-3 rounded ${result.includes('שגיאה') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
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
