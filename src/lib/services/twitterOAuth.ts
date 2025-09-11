import { TwitterService } from './twitter'
import { prisma } from '@/lib/database'
import crypto from 'crypto'

// Check if demo mode is enabled for Twitter OAuth specifically
// We want to use real Twitter OAuth even in demo mode for authentication
const isTwitterOAuthDemoMode = () => {
  // Check if we have OAuth 1.0a credentials (for Twitter API v1.1)
  const hasTwitterOAuthCredentials = process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET
  
  // TEMPORARY: Force demo mode until callback URL is configured
  console.log('Twitter OAuth demo mode: Forcing demo mode until callback URL is configured')
  return true
  
  // Use demo mode if:
  // 1. We don't have OAuth credentials OR
  // 2. Demo mode is explicitly enabled
  if (!hasTwitterOAuthCredentials) {
    console.log('Twitter OAuth demo mode: No API credentials found')
    return true // No credentials, use demo mode
  }
  
  if (process.env.TWITTER_OAUTH_DEMO_MODE === 'true') {
    console.log('Twitter OAuth demo mode: Explicitly enabled')
    return true // Demo mode explicitly enabled
  }
  
  console.log('Twitter OAuth demo mode: Using real OAuth with credentials')
  return false // We have credentials and demo mode is not enabled, use real OAuth
}

// Demo OAuth state storage (in-memory for demo)
const demoOAuthStates = new Map<string, {
  userId: string
  state: string
  requestToken: string
  requestSecret: string
  callbackUrl: string
  expiresAt: Date
}>()

// Cleanup expired demo states
const cleanupDemoStates = () => {
  const now = new Date()
  const keysToDelete: string[] = []
  
  demoOAuthStates.forEach((value, key) => {
    if (value.expiresAt < now) {
      keysToDelete.push(key)
    }
  })
  
  keysToDelete.forEach(key => {
    demoOAuthStates.delete(key)
  })
}

export class TwitterOAuthService {
  
  /**
   * Step 1: Get authorization URL for user
   */
  static async getAuthorizationUrl(userId: string, callbackUrl: string): Promise<{
    authUrl: string
    state: string
  }> {
    // In demo mode, return mock authorization URL
    if (isTwitterOAuthDemoMode()) {
      const state = crypto.randomBytes(32).toString('hex')
      const mockRequestToken = 'demo_oauth_token_' + Date.now()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      
      // Store in demo state storage
      demoOAuthStates.set(state, {
        userId,
        state,
        requestToken: mockRequestToken,
        requestSecret: 'demo_oauth_secret',
        callbackUrl,
        expiresAt
      })
      
      // Return demo authorization URL
      return {
        authUrl: `${callbackUrl}?oauth_token=${mockRequestToken}&oauth_verifier=demo_verifier&state=${state}`,
        state
      }
    }

    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    
    if (!apiKey || !apiSecret) {
      console.error('Twitter OAuth credentials not found:', {
        TWITTER_API_KEY: !!apiKey,
        TWITTER_API_SECRET: !!apiSecret
      })
      throw new Error('Twitter OAuth credentials not configured. Please set TWITTER_API_KEY and TWITTER_API_SECRET environment variables.')
    }
    
    console.log('Attempting Twitter OAuth with credentials:', {
      apiKey: apiKey.substring(0, 8) + '...',
      apiSecret: apiSecret.substring(0, 8) + '...',
      callbackUrl
    })
    
    const requestTokenData = await TwitterService.getRequestToken(
      apiKey, 
      apiSecret, 
      callbackUrl
    )
    
    // Generate secure state parameter
    const state = crypto.randomBytes(32).toString('hex')
    
    // Store OAuth state temporarily (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    await prisma.oAuthState.create({
      data: {
        userId,
        state,
        requestToken: requestTokenData.oauth_token,
        requestSecret: requestTokenData.oauth_token_secret,
        callbackUrl,
        expiresAt
      }
    })
    
    const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${requestTokenData.oauth_token}`
    
    return {
      authUrl,
      state
    }
  }
  
  /**
   * Step 2: Exchange callback tokens for access tokens
   */
  static async completeOAuth(
    state: string,
    oauthToken: string,
    oauthVerifier: string
  ): Promise<{
    accessToken: string
    accessSecret: string
    userId: string
    screenName: string
    twitterUserId: string
  }> {
    // In demo mode, return mock access tokens
    if (isTwitterOAuthDemoMode()) {
      cleanupDemoStates()
      const oauthState = demoOAuthStates.get(state)
      
      if (!oauthState) {
        throw new Error('Invalid OAuth state')
      }
      
      if (oauthState.expiresAt < new Date()) {
        demoOAuthStates.delete(state)
        throw new Error('OAuth state expired')
      }
      
      if (oauthState.requestToken !== oauthToken) {
        throw new Error('OAuth token mismatch')
      }
      
      // Clean up demo state
      demoOAuthStates.delete(state)
      
      return {
        accessToken: 'demo_access_token_' + Date.now(),
        accessSecret: 'demo_access_secret_' + Date.now(),
        userId: oauthState.userId,
        screenName: 'demo_twitter_user',
        twitterUserId: 'demo_twitter_id_' + oauthState.userId
      }
    }

    // Retrieve and validate OAuth state
    const oauthState = await prisma.oAuthState.findUnique({
      where: { state }
    })
    
    if (!oauthState) {
      throw new Error('Invalid OAuth state')
    }
    
    if (oauthState.expiresAt < new Date()) {
      // Clean up expired state
      await prisma.oAuthState.delete({ where: { state } })
      throw new Error('OAuth state expired')
    }
    
    if (oauthState.requestToken !== oauthToken) {
      throw new Error('OAuth token mismatch')
    }
    
    const apiKey = process.env.TWITTER_API_KEY!
    const apiSecret = process.env.TWITTER_API_SECRET!
    
    const accessTokenData = await TwitterService.getAccessToken(
      apiKey,
      apiSecret,
      oauthState.requestToken,
      oauthState.requestSecret,
      oauthVerifier
    )
    
    // Clean up OAuth state
    await prisma.oAuthState.delete({ where: { state } })
    
    return {
      accessToken: accessTokenData.oauth_token,
      accessSecret: accessTokenData.oauth_token_secret,
      userId: oauthState.userId,
      screenName: accessTokenData.screen_name,
      twitterUserId: accessTokenData.user_id
    }
  }
  
  /**
   * Clean up expired OAuth states
   */
  static async cleanupExpiredStates(): Promise<void> {
    if (isDemoMode()) {
      cleanupDemoStates()
      return
    }

    await prisma.oAuthState.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
  }
}
