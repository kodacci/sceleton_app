import { Router } from 'express'
import jwt from 'jsonwebtoken'
import intel from 'intel'
import { UserModel } from '../../../models/user'
import TokenData from '../../../interfaces/token-data'
import RequestError from '../../../util/request-error'

const router: Router = Router()
const log = intel.getLogger('REST.API.USERS.REFRESH_TOKEN')

router.post('/', async (req, res) => {
  try {
    let token: TokenData
    try {
      token = <TokenData>jwt.verify(req.body.refreshToken, UserModel.SECRET)
      if (token.type !== 'refresh') { throw new Error() } // not a refresh token
    } catch (err: any) {
      log.warn(`Invalid refresh token from ${req.ip}`)
      throw new RequestError(401, 'Invalid refresh token')
    }

    const user = await UserModel.findById(token.email)
    if (!user || user.sessionId !== token.sessionId) {
      throw new RequestError(401, `Invalid refresh token for ${token.email}`)
    }

    const ret = await user.generateAccessTokens()
    res.status(200).json(ret)
  } catch (err: any) {
    log.error(`Error refreshing token: ${err.message}`)
    res.status(err.status || 500).json({ success: false, message: err.message })
  }
})

export default router