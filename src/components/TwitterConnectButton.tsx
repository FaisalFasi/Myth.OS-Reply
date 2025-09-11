"use client";
import { useState, useEffect } from "react";
import { toast } from 'react-hot-toast';

interface TwitterConnectButtonProps {
  callbackUrl?: string;
  className?: string;
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export default function TwitterConnectButton({ 
  callbackUrl = "/dashboard", 
  className = "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200",
  children,
  onSuccess
}: TwitterConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [twitterUsername, setTwitterUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkTwitterConnection();
  }, []);

  const checkTwitterConnection = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/twitter/accounts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const accounts = await response.json();
        if (accounts.length > 0) {
          setIsConnected(true);
          setTwitterUsername(accounts[0].twitterUsername);
        }
      }
    } catch (error) {
      console.error('Error checking Twitter connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in first');
        return;
      }

      // Get OAuth authorization URL
      const response = await fetch('/api/twitter/oauth', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get OAuth URL');
      }

      const { authUrl } = await response.json();

      // Open OAuth popup window
      const popup = window.open(
        authUrl,
        'twitter-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      // Listen for messages from the popup
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.success) {
          setIsConnected(true);
          setTwitterUsername(event.data.account.twitterUsername);
          onSuccess?.();
          popup?.close();
        } else if (event.data.error) {
          alert(`Twitter connection failed: ${event.data.error}`);
          popup?.close();
        }
      };

      window.addEventListener('message', messageListener);

      // Clean up listener when popup closes
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          setIsConnecting(false);
        }
      }, 1000);

    } catch (error) {
      console.error('Twitter connection error:', error);
      alert('Failed to connect to Twitter');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // First, get the current accounts to find the account ID
      const accountsResponse = await fetch('/api/twitter/accounts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (accountsResponse.ok) {
        const accounts = await accountsResponse.json();
        if (accounts.length > 0) {
          // Disconnect the first account (or all accounts)
          for (const account of accounts) {
            const response = await fetch(`/api/twitter/accounts?id=${account.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (response.ok) {
              console.log(`Disconnected account: ${account.twitterUsername}`);
            }
          }
          
          setIsConnected(false);
          setTwitterUsername(null);
          toast.success('✅ Twitter account disconnected successfully!');
        }
      }
    } catch (error) {
      console.error('Error disconnecting Twitter:', error);
      toast.error('❌ Failed to disconnect Twitter account');
    }
  };

  if (loading) {
    return (
      <button disabled className={`${className} opacity-50 cursor-not-allowed`}>
        Loading...
      </button>
    );
  }

  if (isConnected && twitterUsername) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">
          Connected as @{twitterUsername}
        </span>
        <button 
          onClick={handleDisconnect}
          className="text-red-600 hover:text-red-700 text-sm underline"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className={`${className} ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {isConnecting ? 'Connecting...' : (children || 'Connect X')}
    </button>
  );
}