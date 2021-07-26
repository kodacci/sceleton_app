import { Router } from 'express'
import { UserModel } from '../../../models/user'
import intel from 'intel'

const router: Router = Router()
const log = intel.getLogger('REST.API.USERS.SIGNUP')

router.post('/', (req, res) => {
  const user = new UserModel(req.body)

  if (!user.isValid()) {
    log.error(`Bad user parameters: ${JSON.stringify(req.body)}`)
    res.status(400).json({ success: false, message: 'Bad user parameters' })
    return
  }

  user.create()
    .then(() => res.status(201).json(user.json()))
    .catch((err: any) => {
      log.error(`Error signing up new user with email ${user.email}: ${err.message}`)
      res.status(err.status || 500).json({ success: false, message: err.message })
    })
})

export default router