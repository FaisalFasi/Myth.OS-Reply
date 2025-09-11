'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

interface WalletInfo {
  address: string
  balance: string
  network: string
  connected: boolean
}

interface WalletIntegrationProps {
  paymentAddress: string
  amount: number
  onTransactionSent?: (txHash: string) => void
}

export default function WalletIntegration({ paymentAddress, amount, onTransactionSent }: WalletIntegrationProps) {
  const [wallet, setWallet] = useState<WalletInfo>({
    address: '',
    balance: '0',
    network: '',
    connected: false
  })
  const [connecting, setConnecting] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    checkWalletConnection()
  }, [])

  const checkWalletConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          const balance = await window.ethereum.request({
            method: 'eth_getBalance',
            params: [accounts[0], 'latest']
          })
          const network = await window.ethereum.request({ method: 'eth_chainId' })
          
          setWallet({
            address: accounts[0],
            balance: (parseInt(balance, 16) / 1e18).toFixed(4),
            network: network === '0x169' ? 'Theta Testnet' : 'Unknown',
            connected: true
          })
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error)
      }
    }
  }

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      toast.error('MetaMask is not installed. Please install MetaMask to continue.')
      return
    }

    setConnecting(true)
    setError('')

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      
      if (accounts.length > 0) {
        const balance = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [accounts[0], 'latest']
        })
        
        const network = await window.ethereum.request({ method: 'eth_chainId' })
        
        setWallet({
          address: accounts[0],
          balance: (parseInt(balance, 16) / 1e18).toFixed(4),
          network: network === '0x169' ? 'Theta Testnet' : 'Unknown',
          connected: true
        })

        toast.success('✅ Wallet connected successfully!')

        // Switch to Theta Testnet if not already connected
        if (network !== '0x169') {
          await switchToThetaTestnet()
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to connect wallet'
      setError(errorMessage)
      toast.error(`❌ ${errorMessage}`)
    } finally {
      setConnecting(false)
    }
  }

  const switchToThetaTestnet = async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed')
      return
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x169' }]
      })
    } catch (error: any) {
      if (error.code === 4902) {
        // Chain doesn't exist, add it
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x169',
              chainName: 'Theta Testnet',
              nativeCurrency: {
                name: 'Theta',
                symbol: 'THETA',
                decimals: 18
              },
              rpcUrls: ['https://eth-rpc-api-testnet.thetatoken.org/rpc'],
              blockExplorerUrls: ['https://explorer.thetatoken.org']
            }]
          })
        } catch (addError) {
          setError('Failed to add Theta Testnet to wallet')
        }
      } else {
        setError('Failed to switch to Theta Testnet')
      }
    }
  }

  const sendTransaction = async () => {
    if (!wallet.connected) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!window.ethereum) {
      toast.error('MetaMask is not installed')
      return
    }

    if (parseFloat(wallet.balance) < amount) {
      const errorMessage = `Insufficient balance. You need ${amount} THETA but have ${wallet.balance} THETA`
      setError(errorMessage)
      toast.error(`❌ ${errorMessage}`)
      return
    }

    setSending(true)
    setError('')

    try {
      toast.loading('🔄 Sending transaction...', { duration: 5000 })
      
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: wallet.address,
          to: paymentAddress,
          value: `0x${(amount * 1e18).toString(16)}`,
          gas: '0x5208', // 21000 gas limit
          gasPrice: '0x3b9aca00' // 1 gwei gas price
        }]
      })

      onTransactionSent?.(txHash)
      toast.success('✅ Transaction sent successfully! Waiting for confirmation...')
      setError('')
    } catch (error: any) {
      const errorMessage = error.message || 'Transaction failed'
      setError(errorMessage)
      toast.error(`❌ ${errorMessage}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Wallet Integration</h3>
      
      {!wallet.connected ? (
        <div className="text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-600 mb-4">Connect your wallet to send payment directly</p>
          </div>
          
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto"
          >
            {connecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect MetaMask
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-500 mt-3">
            MetaMask or compatible wallet required
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Wallet Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Connected Wallet</span>
              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                Connected
              </span>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Address:</span>
                <span className="font-mono text-xs">
                  {wallet.address.substring(0, 6)}...{wallet.address.substring(38)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Balance:</span>
                <span className="font-semibold">{wallet.balance} THETA</span>
              </div>
              <div className="flex justify-between">
                <span>Network:</span>
                <span className={wallet.network === 'Theta Testnet' ? 'text-green-600' : 'text-red-600'}>
                  {wallet.network}
                </span>
              </div>
            </div>
          </div>

          {/* Send Transaction */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Payment Amount</span>
              <span className="text-lg font-bold text-gray-900">{amount} THETA</span>
            </div>
            
            <button
              onClick={sendTransaction}
              disabled={sending || parseFloat(wallet.balance) < amount || wallet.network !== 'Theta Testnet'}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending Transaction...
                </>
              ) : (
                'Send Payment'
              )}
            </button>
            
            {wallet.network !== 'Theta Testnet' && (
              <button
                onClick={switchToThetaTestnet}
                className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600"
              >
                Switch to Theta Testnet
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Wallet Instructions</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Make sure you're connected to Theta Testnet</li>
          <li>• Ensure you have sufficient THETA balance</li>
          <li>• Transaction will be sent to the payment address</li>
          <li>• Wait for confirmation before closing this page</li>
        </ul>
      </div>
    </div>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, callback: (accounts: string[]) => void) => void
      removeListener: (event: string, callback: (accounts: string[]) => void) => void
    }
  }
}
