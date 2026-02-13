'use client'
import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'

export default function Features() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  const features = [
    {
      icon: 'auto_stories',
      title: 'מאגר עצום',
      description: 'אלפי ספרי קודש זמינים לקריאה ולימוד'
    },
    {
      icon: 'verified',
      title: 'דיוק מקסימלי',
      description: 'מערכת בקרת איכות מתקדמת לטקסטים מדויקים'
    },
    {
      icon: 'search',
      title: 'חיפוש מתקדם',
      description: 'מצאו כל פסוק, מאמר או מושג בקלות'
    },
    {
      icon: 'edit_note',
      title: 'עריכה משותפת',
      description: 'ספרים רבים נוספו על ידי הקהילה'
    },
    {
      icon: 'public',
      title: 'נגיש לכולם',
      description: 'זמין לכל מערכות ההפעלה בקלות'
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  }

  return (
    <section id="features" className="py-20 px-4 bg-surface relative overflow-hidden">
      <div className="container mx-auto relative z-10" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-bold text-center mb-4 text-on-surface">
            למה לבחור באוצריא?
          </h2>
          <p className="text-center text-on-surface/70 mb-12 max-w-2xl mx-auto">
            פלטפורמה מתקדמת המשלבת טכנולוגיה חדישה עם כבוד למסורת
          </p>
        </motion.div>
        
        <motion.div 
          className="flex flex-wrap justify-center gap-6"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ 
                scale: 1.05, 
                y: -8,
                transition: { type: "spring", stiffness: 300 }
              }}
              className="glass p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow cursor-pointer group w-full md:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)]"
            >
              <motion.span 
                className="material-symbols-outlined text-6xl text-primary mb-4 block"
                whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                transition={{ duration: 0.5 }}
              >
                {feature.icon}
              </motion.span>
              <h3 className="text-xl font-bold mb-2 text-on-surface group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-on-surface/70">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
