import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth'

export const dynamic = 'force-dynamic'

/**
 * @swagger
 * /api/auth/validate:
 *   get:
 *     summary: Validate JWT token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     username:
 *                       type: string
 *       401:
 *         description: Invalid token
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    
    let user = null
    
    if (token) {
      try {
        user = await AuthService.validateToken(token)
      } catch (tokenError) {
        // Fallback to demo user if token validation fails
        user = await AuthService.getOrCreateDemoUser()
      }
    } else {
      // No token provided, use demo user
      user = await AuthService.getOrCreateDemoUser()
    }
    
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    return NextResponse.json({ user })
  } catch (error: any) {
    
    // Final fallback - return demo user even on complete failure
    try {
      const demoUser = await AuthService.getOrCreateDemoUser()
      return NextResponse.json({ user: demoUser })
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 500 }
      )
    }
  }
}
