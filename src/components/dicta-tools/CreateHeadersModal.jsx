'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import FormInput from '@/components/FormInput'

export default function CreateHeadersModal({ isOpen, onClose, content, onContentChange }) {
  const [findWord, setFindWord] = useState('דף')
  const [endNumber, setEndNumber] = useState(999)
  const [level, setLevel] = useState(2)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const handleSubmit = () => {
    setResult('')
    setLoading(true)
    
    try {
      // ביצוע הלוגיקה מקומית
      let newContent = content
      let count = 0
      
      // חיפוש והחלפה של דפוסים כמו "דף א" עד "דף תתקצט"
      const regex = new RegExp(`${findWord}\\s*([א-ת]+|\\d+)`, 'g')
      
      newContent = newContent.replace(regex, (match, number) => {
        // המרת מספר עברי למספר רגיל (פשטני)
        let numValue = 0
        if (/^\d+$/.test(number)) {
          numValue = parseInt(number)
        } else {
          // המרה פשוטה של אותיות עבריות למספרים
          const hebrewNumerals = {
            'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
            'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90,
            'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
          }
          for (let char of number) {
            numValue += hebrewNumerals[char] || 0
          }
        }
        
        if (numValue <= endNumber) {
          count++
          return `<h${level}>${match}</h${level}>`
        }
        return match
      })
      
      if (count > 0) {
        setResult(`נוצרו ${count} כותרות בהצלחה!`)
        onContentChange(newContent)
        setTimeout(() => {
          onClose()
          setResult('')
        }, 1500)
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
      title="יצירת כותרות"
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700 space-y-2">
          <p>בתיבת 'מילה לחפש' יש לבחור או להקליד את המילה בה אנו רוצים שתתחיל הכותרת.</p>
          <p>לדוג': פרק/פסוק/סימן/סעיף/הלכה/שאלה/עמוד/סק/ענף</p>
          <p className="font-bold text-red-600">שים לב!</p>
          <p>אין להקליד רווח אחרי המילה, וכן אין להקליד את התו גרש (') או גרשיים (") וכן אין להקליד יותר ממילה אחת</p>
        </div>

        <FormInput
          label="מילה לחיפוש"
          value={findWord}
          onChange={(e) => setFindWord(e.target.value)}
          placeholder="דף"
        />

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="עד מספר"
            type="number"
            value={endNumber}
            onChange={(e) => setEndNumber(parseInt(e.target.value) || 0)}
          />
          
          <FormInput
            label="רמת כותרת"
            type="number"
            value={level}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 2;
              setLevel(Math.min(Math.max(val, 1), 6));
            }}
            min="1"
            max="6"
            placeholder="1-6"
          />
        </div>

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
