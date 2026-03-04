"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Sparkles, Loader2 } from "lucide-react"

interface ProgressModalProps {
  isOpen: boolean
  onComplete: () => void
  duration?: number // duration in seconds
  title?: string
  message?: string
}

export function ProgressModal({
  isOpen,
  onComplete,
  duration = 10,
  title = "Gerando Resumo Comercial",
  message = "Nossa IA está analisando os dados do lead e gerando um resumo comercial personalizado...",
}: ProgressModalProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isOpen) {
      setProgress(0)
      return
    }

    const interval = 100 // Update every 100ms
    const totalSteps = (duration * 1000) / interval
    const increment = 100 / totalSteps

    let currentProgress = 0

    const timer = setInterval(() => {
      currentProgress += increment

      if (currentProgress >= 100) {
        setProgress(100)
        clearInterval(timer)
        setTimeout(() => {
          onComplete()
        }, 500)
      } else {
        setProgress(currentProgress)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [isOpen, duration, onComplete])

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-center justify-center">
            <Sparkles className="h-5 w-5 text-purple-500 animate-pulse" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-spin-slow flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Processando...</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">{message}</p>

          <div className="text-center text-xs text-muted-foreground">
            Aguarde, isso pode levar até {duration} segundos
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
