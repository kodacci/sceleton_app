/**
 * User model module
 * @modlue src/models/user
 * @see UserModel
 * @see UserParams
 * @see Model
 * @see ModelParams
 */

import { Model } from './model'
import dynamoManager from '../util/dynamo-manager'
import crypto from 'crypto'
import RequestError from '../util/request-error'
import jwt from 'jsonwebtoken'
import { v1 as genUuid } from 'uuid'
import validator from 'validator'

interface UserParams {
  email: string,
  username: string,
  password?: string,
  salt?: string,
  sessionId?: string
  resetId?: string
}

/**
 * @class UserModel implements auth user
 * @alias UserModel
 */
class UserModel extends Model {
  // Static members

  /** Db table name */
  public static readonly DB_NAME: string = 'Users'
  /** Db table description */
  public static readonly DB_DESCRIPTION: any = {
    TableName: UserModel.DB_NAME,
    AttributeDefinitions: [
      {
        AttributeName: 'email',
        AttributeType: 'S'
      }
    ],
    KeySchema: [
      {
        AttributeName: 'email',
        KeyType: 'HASH'
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 2
    }
  }
  public static SECRET = 'top_secret'

  /** Access token expiration timeout */
  private static readonly ACCESS_EXP: number = 3600
  /** Refresh token expiration timeout */
  private static readonly REFRESH_EXP: number = 86400
  /** Reset token expiration timeout */
  private static readonly RESET_EXP: number = 600

  // Instance members

  public readonly DB_NAME: string = UserModel.DB_NAME
  private readonly UPDATE_PROPS: string[] = ['username', 'password']

  // Static functions

  /**
   * Find user by email in db
   * @param partition - user email
   * @returns promise with found user or null
   */
  public static async findById(partition: string) : Promise<UserModel | null> {
    const data: UserParams | null = await dynamoManager.getModel(UserModel.DB_NAME, 'email', partition)
    if (!data) { return null }

    return new UserModel(data)
  }

  /**
   * Find user in db and authenticate it with supplied password
   * @param email - user email
   * @param password - user password
   * @returns promise with successfully authenticated user
   */
  public static async findAndAuth(email: string, password: string) : Promise<UserModel | null> {
    const user: UserModel | null = await this.findById(email)

    if (user && user.salt && (await UserModel.makeHash(password, user.salt) === user.password)) {
      return user
    } else {
      return null
    }
  }

  /**
   * Create salted hash
   * @param password - password to hash
   * @param salt - salt to add to password
   * @returns promise with hash string
   */
  private static makeHash(password: string, salt: string) : Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, key) => {
        if (err) { reject(new Error(`Error creating password hash: ${err.message}`)) }
        else { resolve(key.toString('hex')) }
      })
    })
  }

  /**
   * Create new instance of UserModel
   * @param data_ - user raw data
   */
  constructor(private data_: UserParams) {
    super()
  }

  // Getters
  public get email(): string { return this.data_.email }
  public get username(): string { return this.data_.username }
  public get password(): string | undefined { return this.data_.password }
  public get salt(): string | undefined { return this.data_.salt }
  public get sessionId(): string | undefined { return this.data_.sessionId }
  public get resetId(): string | undefined { return this.data_.resetId }

  public isValid(): boolean {
    return !!(validator.isEmail(this.email) && this.username && typeof this.username === 'string' && this.username.length > 3
              && this.password && typeof this.password === 'string' && this.password.length >= 8)
  }

  /**
   * Create new instance of UserModel in database
   * @returns emtpy promise
   */
  public async create() : Promise<void> {
    await this.makeCredentials()
    const success = await dynamoManager.createModel(UserModel.DB_NAME, this.data_, 'email')
    if (!success) { throw new RequestError(409, `User ${this.data_.email} already exists`) }
  }

  /**
   * Update user data
   * @param newData - user data update
   * @returns empty promise
   */
  public async update(newData: { [key: string]: any }) : Promise<void> {
    delete newData.email

    const update = <any>this.UPDATE_PROPS.reduce((acc: { [key: string]: any }, prop: string) => {
      if (prop in newData) {
        acc[prop] = newData[prop]
      }
      return acc
    }, {})

    this.data_ = {
      ...this.data_,
      ...update
    }

    if (!this.isValid()) {
      throw new RequestError(400, 'Bad input parameters')
    }

    if ('password' in newData) {
      await this.makeCredentials()
      // Drop current session if any
      this.data_.sessionId = ''
      this.data_.resetId = ''
    }

    return dynamoManager.updateModel(UserModel.DB_NAME, this.data_, 'email')
  }

  /**
   * Delete user from db
   * @returns emtpy promise
   */
  public delete() : Promise<void> {
    return dynamoManager.deleteModel(UserModel.DB_NAME, 'email', this.data_.email)
  }

  /**
   * Get raw user data for API
   * @returns API user data as json object
   */
  public json() : UserParams {
    const ret: UserParams = { ...this.data_ }
    delete ret.salt
    delete ret.password
    delete ret.sessionId
    delete ret.resetId

    return ret
  }

  /**
   * Generate pair of access and refresh tokens
   * @returns promise with access and refresh tokens
   */
  public async generateAccessTokens() : Promise<{ accessToken: string, refreshToken: string }> {
    this.data_.sessionId = genUuid()

    const tokenData = {
      type: 'access',
      email: this.email,
      sessionId: this.sessionId,
      username: this.username,
      exp: Math.floor(Date.now()/1000) + UserModel.ACCESS_EXP
    }
    const accessToken: string = jwt.sign(tokenData, UserModel.SECRET)

    tokenData.type = 'refresh'
    tokenData.exp = Math.floor(Date.now()/1000) + UserModel.REFRESH_EXP
    const refreshToken: string = jwt.sign(tokenData, UserModel.SECRET)

    await dynamoManager.updateModel(UserModel.DB_NAME, { email: this.email, sessionId: this.sessionId }, 'email')

    return { accessToken, refreshToken }
  }

  public async generateResetToken() : Promise<string> {
    this.data_.resetId = genUuid()

    const tokenData = {
      type: 'reset',
      email: this.email,
      resetId: this.resetId,
      exp: Math.floor(Date.now()/1000) + UserModel.RESET_EXP
    }

    await dynamoManager.updateModel(UserModel.DB_NAME, { email: this.email, resetId: this.resetId }, 'email')

    return jwt.sign(tokenData, UserModel.SECRET)
  }

  /**
   * Generate salt and password salted hash to save to db
   * @returns empty promise
   */
  private async makeCredentials() : Promise<void> {
    await new Promise<void>((resolve, reject) => {
      crypto.randomBytes(128, (err: Error | null, buf: Buffer) => {
        if (err) { reject(new Error(`Error generating random bytes: ${err.message}`)); return }

        this.data_.salt = buf.toString('hex').slice(0, 256)
        resolve()
      })
    })

    if (!this.data_.password || !this.data_.salt) { throw new Error('Trying to make credentials without password or salt') }
    this.data_.password = await UserModel.makeHash(this.data_.password, this.data_.salt)
  }
}

export { UserModel }
export { UserParams }