'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'

export default function ReplacePageBModal({ isOpen, onClose, content, onContentChange }) {
  const [replaceType, setReplaceType] = useState('נקודותיים')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const handleSubmit = () => {
    setResult('')
    setLoading(true)
    
    try {
      let newContent = content
      let count = 0
      
      // חיפוש כותרות "עמוד ב" והחלפתן
      const patterns = [
        /<h\d+>עמוד ב<\/h\d+>/g,
        /<h\d+>ע"ב<\/h\d+>/g,
        /<h\d+>ע״ב<\/h\d+>/g
      ]
      
      const replacement = replaceType === 'נקודותיים' ? ':' : 'ע"ב'
      
      patterns.forEach(pattern => {
        const matches = newContent.match(pattern)
        if (matches) {
          count += matches.length
          newContent = newContent.replace(pattern, (match) => {
            return match.replace(/עמוד ב|ע"ב|ע״ב/, replacement)
          })
        }
      })
      
      if (count > 0) {
        setResult(`בוצעו ${count} החלפות בהצלחה!`)
        onContentChange(newContent)
        setTimeout(() => {
          onClose()
          setResult('')
        }, 1500)
      } else {
        setResult('לא נמצאו כותרות "עמוד ב" להחלפה')
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
      title='החלפת כותרות "עמוד ב"'
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
          <p>כלי זה מחליף כותרות "עמוד ב" בפורמט מותאם.</p>
          <p className="mt-2">דורש הרצה מוקדמת של "יצירת כותרות עמוד ב".</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">סוג החלפה</label>
          <select
            value={replaceType}
            onChange={(e) => setReplaceType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="נקודותיים">נקודותיים (:)</option>
            <option value='ע"ב'>ע"ב</option>
          </select>
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
