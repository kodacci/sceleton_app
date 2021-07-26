import express from 'express'
import config from 'config'
import intel from 'intel'
import dynamoManager from './util/dynamo-manager'
import { UserModel } from './models/user'
import { PetModel } from './models/pet'
import passport from 'passport'
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'
import RequestError from './util/request-error'
import users from './routes/api/users/index'
import signin from './routes/api/users/signin'
import refresh_token from './routes/api/users/refresh_token'
import signup from './routes/api/users/signup'
import pets from './routes/api/pets'
import reset_password from './routes/api/users/reset_password'

const log = intel.getLogger('REST')

async function verifyAuthToken(jwtPayload: { [key: string]: any }, done: any): Promise<void> {
  try {
    if (jwtPayload.exp*1000 < Date.now()) {
      log.warning(`Trying to login with expired token as ${jwtPayload.email}`)
      done(new RequestError(401, `${jwtPayload.email} token expired`), false)
      return
    }

    if (jwtPayload.type !== 'access') {
      done(new RequestError(401, `Wrong token type for ${jwtPayload.email}`), false)
      return
    }

    const user = await UserModel.findById(jwtPayload.email)
    if (user) {
      if (user.sessionId !== jwtPayload.sessionId) {
        log.warn(`Session id mismatch for ${user.email}`)
        done(new RequestError(401, 'Unauthorized'), false)
        return
      }

      done(null, user)
    } else {
      log.warn(`Trying to log in as a non-existant user ${jwtPayload.email}`)
      done(new RequestError(401, 'Unauthorized'), false)
    }
  } catch (err: any) {
    const message = `Error getting user ${jwtPayload.email} from db to authenticate: ${err.message}`
    log.error(message)
    done(new Error(message), false)
  }
}

async function startServer() {
  // Configure database
  await dynamoManager.init()
  log.info('Successfully connected to db')

  // Setup tables
  await dynamoManager.registerModel(UserModel.DB_NAME, UserModel.DB_DESCRIPTION)
  await dynamoManager.registerModel(PetModel.DB_NAME, PetModel.DB_DESCRIPTION)

  log.info('Successfully configured db')

  // Configure passport
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: UserModel.SECRET
  }, verifyAuthToken))

  const app = express()
  app.use(express.json())
  app.use(passport.initialize())

  // Configure API routes
  app.use('/api/v1/users/signin', signin)
  app.use('/api/v1/users/refresh_token', refresh_token)
  app.use('/api/v1/users/signup', signup)
  app.use('/api/v1/users/reset_password', reset_password)

  app.use('/api/v1/users', passport.authenticate('jwt', { session: false }), users)
  app.use('/api/v1/pets', passport.authenticate('jwt', { session: false }), pets)

  // 404 error for unexpected paths
  app.use((_req: any, res: any) => {
    res.status(404).json({ success: false, message: 'Path out of service' })
  })

  // Error handler if something went wrong and was not handled properly
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err.status !== 401) {
      log.error(`API error with status ${err.status}: ${err.message}`)
    }
    res.status(err.status || 500).json({ success: false, message: err.message })
  })

  const port = config.get('port')
  app.listen(port, () => {
    log.info(`Successfully started server on port ${port}`)
  })
}

startServer()
  .catch((err: any) => {
    log.critical(`Could not start server: ${err.message}`)
  })
