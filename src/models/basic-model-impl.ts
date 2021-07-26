/**
 * Basic db model implementation
 * @module src/model/basic-model-impl
 * @see BasicModelImpl
 * @see BasicModelParams
 * @see Model
 * @see ModelParams
 */

import { Model } from './model'
import dynamoManager from '../util/dynamo-manager'
import RequestError from '../util/request-error'

interface BasicModelParams {
  user?: string,
  [key: string]: any
}

/**
 * @class BasicModelImpl represents basic db model implementation which has user as partition key and some other sort key
 * @abstract
 * @alias BasicModelImpl
 */
abstract class BasicModelImpl extends Model {
  /** Props description to validate */
  protected abstract readonly PROPS_DCS: { name: string, type: 'string'|'number' }[]
  /** Props that can be update */
  protected abstract readonly UPDATE_PROPS: string[]
  /** Model sort key for DynamoDB */
  protected abstract readonly SORT_KEY: string

  /**
   * Create new instance of BasicModelImpl
   * @param data_ - raw model data
   */
  constructor(protected data_: BasicModelParams) {
    super()
  }

  public get user() : string | undefined { return this.data_.user }
  public get name() : string { return this.data_.name }

  /**
   * Validate model data
   * @returns true if valid
   */
  public isValid() : boolean {
    return this.PROPS_DCS.every(prop => typeof this.data_[prop.name as 'user'] === prop.type)
  }

  /**
   * Create new instance of model
   */
  public async create() : Promise<void> {
    const success = await dynamoManager.createModel(this.DB_NAME, this.data_, 'user', this.SORT_KEY)
    if (!success) { throw new RequestError(409, `Instance ${this.data_.user} already exists`) }

    return
  }

  /**
   * Update model data
   * @param newData update data
   */
  public update(newData: { [key: string]: any }) : Promise<void> {
    this.UPDATE_PROPS.forEach(prop => {
      if (prop in newData) {
        this.data_[prop] = newData[prop]
      }
    })

    if (!this.isValid()) {
      throw new RequestError(400, 'Bad parameters')
    }

    return dynamoManager.updateModel(this.DB_NAME, { ...newData, name: this.name, user: this.user }, 'user', this.SORT_KEY)
  }

  /**
   * Delete model from db
   */
  public delete() : Promise<void> {
    if (!this.data_.user) { return Promise.resolve() }
    return dynamoManager.deleteModel(this.DB_NAME, 'user', this.data_.user, this.SORT_KEY, this.data_[this.SORT_KEY])
  }

  /**
   * Return model raw data as json object
   */
  public json(): BasicModelParams {
    const ret = { ...this.data_ }
    delete ret.user

    return ret
  }
}

export { BasicModelImpl, BasicModelParams }