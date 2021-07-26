/**
 * Abstract model module
 * @module src/models/model
 * @see Model
 */

/**
 * @class Model implements abstract model interface, all db entities should inherit this class
 * @abstract
 * @alias Model
 */
abstract class Model {
  /** Db table name */
  public static readonly DB_NAME: string
  /** Db table description */
  public static readonly DB_DESCRIPTION: any

  /** Db table name for accessing in model instances methods */
  public abstract readonly DB_NAME: string

  /**
   * Find model in db by id
   * @param partition - partition key
   * @param sort      - sort key
   * @returns promise with model instance or null
   */
  public static findById(_partition: string, _sort: string | undefined) : Promise<Model | null> {
    return Promise.reject(new Error('Abstract function findById called!'))
  }

  /**
   * Check model data for validity
   */
  public abstract isValid() : boolean

  /**
   * Create new instance of model
   */
  public abstract create() : Promise<void>

  /**
   * Update model data
   * @param newData update data
   */
  public abstract update(newData: { [key: string]: any }) : Promise<void>

  /**
   * Delete model from db
   */
  public abstract delete() : Promise<void>

  /**
   * Return model raw data as json object
   */
  public abstract json(): { [key: string]: any }
}

export { Model }