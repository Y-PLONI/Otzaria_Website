'use client'

import { useState, useEffect } from 'react'
import { uploadBookAction } from '@/app/library/admin/upload-action'
import { validateRequired, validateFile } from '@/lib/validation-utils'
import Modal from './Modal'

export default function AddBookDialog({ isOpen, onClose, onBookAdded }) {
    const [bookName, setBookName] = useState('')
    const [file, setFile] = useState(null)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState(null)
    const [category, setCategory] = useState('כללי')
    const [statusMessage, setStatusMessage] = useState('')

    const [layoutType, setLayoutType] = useState('single_column')
    const [scriptType, setScriptType] = useState('square')
    const [customPrompt, setCustomPrompt] = useState('')
    const [availableScriptTypes, setAvailableScriptTypes] = useState([])

    useEffect(() => {
        if (isOpen) {
            fetch('/api/admin/ocr-examples')
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.types) {
                        setAvailableScriptTypes(data.types)
                    }
                })
                .catch(console.error)
        }
    }, [isOpen])

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            if (!bookName) {
                setBookName(e.target.files[0].name.replace(/\.[^/.]+$/, ""))
            }
        }
    }

    const handleSubmit = async () => {
        const bookNameCheck = validateRequired(bookName, 'שם הספר')
        if (!bookNameCheck.isValid) {
            setError(bookNameCheck.error)
            return
        }

        const fileCheck = validateFile(file)
        if (!fileCheck.isValid) {
            setError(fileCheck.error)
            return
        }

        setIsUploading(true)
        setError(null)
        setStatusMessage('מעלה ומעבד PDF (זה עלול לקחת זמן)...')

        const formData = new FormData()
        formData.append('pdf', file)
        formData.append('bookName', bookName)
        formData.append('category', category)
        formData.append('layoutType', layoutType)
        formData.append('scriptType', scriptType)
        formData.append('customPrompt', customPrompt)

        try {
            const result = await uploadBookAction(formData)

            if (!result.success) {
                throw new Error(result.error || 'שגיאה בהעלאה')
            }

            if (onBookAdded) onBookAdded()
            handleClose()

        } catch (err) {
            console.error(err)
            setError('שגיאה: ' + err.message)
        } finally {
            setIsUploading(false)
            setStatusMessage('')
        }
    }

    const handleClose = () => {
        if (!isUploading) {
            setError(null)
            setFile(null)
            setBookName('')
            setCategory('כללי')
            setCustomPrompt('')
            onClose()
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="הוספת ספר חדש ועיבוד OCR"
            size="lg"
            closeable={!isUploading}
            buttons={[
                {
                    label: isUploading ? 'מעבד...' : 'העלה ופענח',
                    onClick: handleSubmit,
                    disabled: isUploading,
                    variant: 'primary'
                },
                {
                    label: 'ביטול',
                    onClick: handleClose,
                    disabled: isUploading,
                    variant: 'secondary'
                }
            ]}
        >
            <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">שם הספר</label>
                        <input
                            type="text"
                            value={bookName}
                            onChange={(e) => setBookName(e.target.value)}
                            disabled={isUploading}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">קטגוריה</label>
                        <input
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            disabled={isUploading}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">קובץ PDF</label>
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileSelect}
                        disabled={isUploading}
                        className="w-full block text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                </div>

                <div className="border-t border-gray-200 my-4 pt-4 bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600">smart_toy</span>
                        הגדרות בינה מלאכותית
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">פריסת עמוד (Layout)</label>
                            <select
                                value={layoutType}
                                onChange={(e) => setLayoutType(e.target.value)}
                                disabled={isUploading}
                                className="w-full px-3 py-2 border rounded-lg bg-white"
                            >
                                <option value="single_column">טור אחד</option>
                                <option value="double_column">שני טורים (שטוח)</option>
                                <option value="complex_columns">מבנה מורכב (אובייקטים)</option>
                            </select>
                            <p className="text-[10px] text-gray-500 mt-1">
                                'מבנה מורכב' מאפשר זיהוי חכם של טורים וחלקי טקסט נפרדים.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">סוג כתב (לדוגמאות)</label>
                            <select
                                value={scriptType}
                                onChange={(e) => setScriptType(e.target.value)}
                                disabled={isUploading}
                                className="w-full px-3 py-2 border rounded-lg bg-white"
                            >
                                <option value="square">כתב מרובע רגיל</option>
                                <option value="rashi">כתב רש"י</option>
                                {availableScriptTypes.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">הוראות מיוחדות ל-AI</label>
                        <textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            disabled={isUploading}
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                            placeholder="למשל: שים לב שהטור הימני הוא רש''י והשמאלי תוספות..."
                        />
                    </div>
                </div>

                {isUploading && (
                    <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-center gap-3 animate-pulse border border-blue-200">
                        <span className="material-symbols-outlined animate-spin text-2xl">sync</span>
                        <span className="font-medium">{statusMessage}</span>
                    </div>
                )}

                {error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200 flex items-start gap-2">
                        <span className="material-symbols-outlined">error</span>
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </Modal>
    )
}