import { Router, Request, Response } from 'express'
import { UserModel } from '../../../models/user'
import intel from 'intel'
import nodemailer from 'nodemailer'
import config from 'config'
import jwt from 'jsonwebtoken'
import ResetTokenData from '../../../interfaces/reset-token-data'
import RequestError from '../../../util/request-error'

const router: Router = Router()

router.post('/set_new/:token', async (req, res) => {
  const log = intel.getLogger('REST.API.USERS.RESET_PASSWORD.RESET')

  try {
    const data = <ResetTokenData>jwt.verify(req.params.token, UserModel.SECRET)
    if (data.type !== 'reset') { throw new RequestError(400, `Invalid token type`) }

    const user: UserModel | null = await UserModel.findById(data.email)
    if (!user) { throw new RequestError(404, `User ${data.email} does not exist`) }

    if (user.resetId !== data.resetId) { throw new RequestError(400, `Invalid reset token for ${user.email}`) }

    log.info(`Reseting password for ${user.email}`)
    await user.update({ password: req.body.password })
    log.info(`Successfully changed password for ${user.email}`)

    res.status(200).json({ success: true, message: 'OK' })
  } catch (err: any) {
    log.error(`Error reseting password: ${err.message}`)
    res.status(err.status || 500).json({ success: false, message: err.message })
  }
})

router.post('/:email', async (req: Request, res: Response) => {
  const log = intel.getLogger('REST.API.USERS.RESET_PASSWORD.MAIL')

  try {
    const user: UserModel | null = await UserModel.findById(req.params.email)
    if (!user) {
      res.status(200).json({ success: true, message: 'OK' })
      return
    }

    const token = await user.generateResetToken()

    log.info(`Sending password reset email to ${user.email}`)

    const transport = nodemailer.createTransport(config.get('email'))
    await transport.sendMail({
      to: user.email,
      subject: 'Password reset for sceleton app',
      text: token // In real life email message should be a link that is processed by web interface
    })

    res.status(200).json({ success: true, message: 'OK' })
  } catch (err: any) {
    log.error(`Error reseting password for ${req.params.email}: ${err.message}`)
    res.status(err.status || 500).json({ success: false, message: err.message })
  }
})

export default router