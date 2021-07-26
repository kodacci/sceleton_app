import { Router } from 'express'
import { UserModel } from '../../../models/user'
import intel from 'intel'
import RequestError from '../../../util/request-error'
import { log } from 'dynamodb'

const router: Router = Router()

router.get('/:email', (req, res) : void => {
  const email = req.params.email

  UserModel.findById(email)
    .then(user => {
      if (user) {
        res.status(200).json(user.json())
      } else {
        res.status(404).json({ success: false, message: `User with ${email} does not exist` })
      }
    })
    .catch((err: any) => {
      log.error(`Error getting user ${email}: ${err.message}`)
      res.status(err.status || 500).json({ success: false, message: err.message })
    })
})

router.patch('/:email', (req, res) => {
  const log = intel.getLogger('REST.API.USERS.PATCH')

  let user: UserModel
  UserModel.findById(req.params.email)
    .then(found => {
      if (!found) { throw new RequestError(404, `User ${req.params.email} does not exist`) }
      user = found
      return user.update(req.body)
    })
    .then(() => res.status(200).json(user.json()))
    .catch((err: any) => {
      log.error(`Error updating user with email ${req.params.email}: ${err.message}`)
      res.status(err.status || 500).json({ succuss: false, message: err.message })
    })
})

router.delete('/:email', (req, res) => {
  const log = intel.getLogger('REST.API.USERS.DELETE')

  UserModel.findById(req.params.email)
    .then((user: UserModel | null) => {
      if (!user) { throw new RequestError(404, `User with email ${req.params.email} does not exsit`) }
      return user.delete()
    })
    .then(() => {
      log.info(`Successfully deleted user ${req.params.email}`)
      res.status(200).json({ success: true, message: 'OK' })
    })
    .catch((err: any) => {
      log.error(`Error deleting user ${req.params.email}: ${err.message}`)
      res.status(err.status || 500).json({ success: false, message: err.message })
    })
})

export default router