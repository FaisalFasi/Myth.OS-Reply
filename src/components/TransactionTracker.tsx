'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'

interface TransactionStatus {
  status: 'pending' | 'confirmed' | 'failed' | 'expired'
  transactionHash?: string
  confirmations?: number
  blockNumber?: number
  timestamp?: string
}

interface TransactionTrackerProps {
  paymentAddress: string
  onStatusChange?: (status: TransactionStatus) => void
}

export default function TransactionTracker({ paymentAddress, onStatusChange }: TransactionTrackerProps) {
  const [status, setStatus] = useState<TransactionStatus>({ status: 'pending' })
  const [manualHash, setManualHash] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const checkTransactionStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/payments/status?address=${paymentAddress}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        const previousStatus = status.status
        setStatus(data)
        onStatusChange?.(data)

        // Show notifications for status changes
        if (previousStatus !== data.status) {
          switch (data.status) {
            case 'confirmed':
              toast.success('🎉 Payment confirmed! Your subscription has been activated.')
              break
            case 'failed':
              toast.error('❌ Payment failed. Please try again or contact support.')
              break
            case 'expired':
              toast.error('⏰ Payment address expired. Please generate a new one.')
              break
            case 'pending':
              toast.loading('⏳ Payment pending... Waiting for confirmation.', { duration: 3000 })
              break
          }
        }
      }
    } catch (error) {
      console.error('Error checking transaction status:', error)
    }
  }, [paymentAddress, onStatusChange, status.status])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(checkTransactionStatus, 30000) // Check every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh, checkTransactionStatus])

  const verifyTransactionManually = async () => {
    if (!manualHash.trim()) {
      toast.error('Please enter a transaction hash')
      return
    }

    setVerifying(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          address: paymentAddress,
          transactionHash: manualHash
        })
      })

      if (response.ok) {
        const data = await response.json()
        setStatus(data)
        onStatusChange?.(data)
        setManualHash('')
        toast.success('✅ Transaction verified successfully!')
      } else {
        const error = await response.json()
        toast.error(`Verification failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Error verifying transaction:', error)
      toast.error('Error verifying transaction')
    } finally {
      setVerifying(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'confirmed': return 'text-green-600 bg-green-100'
      case 'failed': return 'text-red-600 bg-red-100'
      case 'expired': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        )
      case 'confirmed':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      case 'failed':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Transaction Status</h3>
        <div className="flex items-center space-x-2">
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh
          </label>
          <button
            onClick={checkTransactionStatus}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Status Display */}
      <div className="mb-6">
        <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${getStatusColor(status.status)}`}>
          {getStatusIcon(status.status)}
          <span className="ml-2 capitalize">{status.status}</span>
        </div>

        {status.transactionHash && (
          <div className="mt-3">
            <p className="text-sm text-gray-600 mb-1">Transaction Hash:</p>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-800 font-mono break-all">
                {status.transactionHash}
              </p>
              <a
                href={`https://explorer.thetatoken.org/tx/${status.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-xs mt-1 inline-block"
              >
                View on Explorer →
              </a>
            </div>
          </div>
        )}

        {status.confirmations !== undefined && (
          <div className="mt-3">
            <p className="text-sm text-gray-600">
              Confirmations: <span className="font-semibold">{status.confirmations}</span>
            </p>
          </div>
        )}

        {status.timestamp && (
          <div className="mt-3">
            <p className="text-sm text-gray-600">
              Timestamp: <span className="font-semibold">{new Date(status.timestamp).toLocaleString()}</span>
            </p>
          </div>
        )}
      </div>

      {/* Manual Verification */}
      <div className="border-t pt-6">
        <h4 className="text-md font-semibold text-gray-900 mb-3">Manual Verification</h4>
        <p className="text-sm text-gray-600 mb-4">
          If you've already sent the payment, enter the transaction hash to verify it manually.
        </p>
        
        <div className="space-y-3">
          <input
            type="text"
            value={manualHash}
            onChange={(e) => setManualHash(e.target.value)}
            placeholder="Enter transaction hash..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={verifyTransactionManually}
            disabled={verifying}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying ? 'Verifying...' : 'Verify Transaction'}
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {status.status === 'pending' && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⏳ Waiting for payment confirmation. This may take a few minutes.
          </p>
        </div>
      )}

      {status.status === 'confirmed' && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            ✅ Payment confirmed! Your subscription has been activated.
          </p>
        </div>
      )}

      {status.status === 'failed' && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            ❌ Transaction failed. Please try again or contact support.
          </p>
        </div>
      )}

      {status.status === 'expired' && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-800">
            ⏰ Payment address expired. Please generate a new one.
          </p>
        </div>
      )}
    </div>
  )
}
