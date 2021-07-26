import { Router } from 'express'
import { UserModel } from '../../../models/user'
import intel from 'intel'

const router: Router = Router()
const log = intel.getLogger('REST.API.USERS.SIGNIN')

router.post('/', async (req, res) => {
  try {
    if (!req.body.email || !req.body.password || typeof req.body.email !== 'string' || typeof req.body.password !== 'string') {
      log.warn(`Bad credentials input: ${JSON.stringify(req.body)}`)
      res.status(400).json({ success: false, message: 'Bad parameters' })
      return
    }

    const user: UserModel | null = await UserModel.findAndAuth(req.body.email, req.body.password)
    if (!user) {
      log.warning(`Bad login for ${req.body.email} from ${req.ip}`)
      res.status(401).json({ success: false, message: 'Signin failed'})
      return
    }

    log.info(`User ${req.body.email} successfully logged in from ${req.ip}`)

    const ret = await user.generateAccessTokens()
    res.status(200).json(ret)
  } catch (err: any) {
    log.error(`Error while authorization of ${req.body.email}: ${err.message}`)
    res.status(500).json({ success: false, message: err.message })
  }
})

export default router