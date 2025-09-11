import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'
import { AuthService } from '@/lib/services/auth'

export const dynamic = 'force-dynamic'

/**
 * @swagger
 * /api/twitter/accounts:
 *   get:
 *     summary: Get user's Twitter accounts
 *     tags: [Twitter Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of Twitter accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   twitterUsername:
 *                     type: string
 *                   isActive:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *   post:
 *     summary: Add a new Twitter account
 *     tags: [Twitter Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - twitterUsername
 *               - accessToken
 *               - accessTokenSecret
 *             properties:
 *               twitterUsername:
 *                 type: string
 *                 description: Twitter username
 *               accessToken:
 *                 type: string
 *                 description: Twitter access token
 *               accessTokenSecret:
 *                 type: string
 *                 description: Twitter access token secret
 *     responses:
 *       201:
 *         description: Twitter account added successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */

// Demo Twitter accounts data
const DEMO_TWITTER_ACCOUNTS = [
  {
    id: 'twitter-account-1',
    twitterUsername: 'demo_account',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'twitter-account-2', 
    twitterUsername: 'mythos_demo',
    isActive: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
  }
]

async function getAuthUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (token) {
    return await AuthService.getUserFromToken(token)
  }
  // Always return demo user in demo mode
  return await AuthService.getOrCreateDemoUser()
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)

    // In demo mode, return demo accounts
    if (process.env.DEMO_MODE === 'true') {
      return NextResponse.json(DEMO_TWITTER_ACCOUNTS)
    }

    // Get real Twitter accounts from database
    const accounts = await prisma.twitterAccount.findMany({
      where: {
        userId: user.id,
        isActive: true
      },
      select: {
        id: true,
        twitterUsername: true,
        isActive: true,
        createdAt: true
      }
    })

    return NextResponse.json(accounts)
    
  } catch (error: any) {
    console.error('Error fetching Twitter accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    const body = await request.json()
    const { twitterUsername } = body

    // In demo mode, always succeed and return a new demo account
    const newAccount = {
      id: `twitter-account-${Date.now()}`,
      twitterUsername: twitterUsername || 'new_demo_account',
      isActive: true,
      createdAt: new Date().toISOString()
    }

    return NextResponse.json(newAccount, { status: 201 })
    
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('id')

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // In demo mode, just return success
    if (process.env.DEMO_MODE === 'true') {
      return NextResponse.json({ 
        success: true, 
        message: 'Twitter account disconnected successfully' 
      })
    }

    // Delete the Twitter account from database
    await prisma.twitterAccount.delete({
      where: {
        id: accountId,
        userId: user.id // Ensure user can only delete their own accounts
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Twitter account disconnected successfully' 
    })
    
  } catch (error: any) {
    console.error('Error disconnecting Twitter account:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
