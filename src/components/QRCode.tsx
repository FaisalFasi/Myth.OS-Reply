'use client'

import { useEffect, useRef, useState } from 'react'
import QRCodeLib from 'qrcode'

interface QRCodeProps {
  text: string
  size?: number
  className?: string
}

export default function QRCode({ text, size = 200, className = '' }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !text) return

    const canvas = canvasRef.current

    // Generate QR code using the qrcode library
    QRCodeLib.toCanvas(canvas, text, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    }).catch((err) => {
      console.error('Error generating QR code:', err)
      setError('Failed to generate QR code')
    })
  }, [text, size])

  if (error) {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div className="w-48 h-48 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm">{error}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Scan with Theta Wallet</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="border border-gray-200 rounded-lg shadow-sm"
      />
      <p className="text-xs text-gray-500 mt-2">Scan with Theta Wallet</p>
    </div>
  )
}
